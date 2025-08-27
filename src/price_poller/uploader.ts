import Redis from 'ioredis';
import { pool, schema } from '../lib/db';
import { REDIS_URL, QUEUE_KEY, BATCH_SIZE, BLOCK_TIMEOUT, LOG } from '../lib/env';

type Row = {
    ts: Date; symbol: string; price: number; qty: number;
    agg_id: number; first_id?: number; last_id?: number;
    maker?: boolean; event_ts?: Date;
};

async function uploader() {
    const redis = new Redis(REDIS_URL);
    redis.on('error', (e) => LOG('[uploader][redis:error]', e));

    await pool.query('SELECT 1');
    await schema();

    LOG('[uploader] consuming from list', { QUEUE_KEY, BATCH_SIZE, BLOCK_TIMEOUT });

    while (true) {
        try {
            const batch: any[] = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                // ioredis BRPOP → [key, value] | null on timeout (seconds)
                const res = await redis.brpop(QUEUE_KEY, BLOCK_TIMEOUT);
                if (!res) break;
                batch.push(JSON.parse(res[1]));
            }
            if (batch.length === 0) continue;

            const rows: Row[] = batch.map(d => ({
                ts: new Date(d.T),
                symbol: String(d.s).toLowerCase(),
                price: Number(d.p),
                qty: Number(d.q),
                agg_id: Number(d.a),
                first_id: d.f ? Number(d.f) : undefined,
                last_id: d.l ? Number(d.l) : undefined,
                maker: d.m,
                event_ts: d.E ? new Date(d.E) : undefined,
            }));

            const values: any[] = [];
            const placeholders: string[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const base = i * 9;
                placeholders.push(
                    `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`
                );
                values.push(r.ts, r.symbol, r.price, r.qty, r.agg_id,
                    r.first_id ?? null, r.last_id ?? null, r.maker ?? null, r.event_ts ?? null);
            }

            const sql = `
            INSERT INTO md_trades (ts, symbol, price, qty, agg_id, first_id, last_id, maker, event_ts)
            VALUES ${placeholders.join(',')}
            ON CONFLICT (symbol, agg_id, ts) DO UPDATE SET
              ts = EXCLUDED.ts,
              price = EXCLUDED.price,
              qty   = EXCLUDED.qty,
              first_id = COALESCE(md_trades.first_id, EXCLUDED.first_id),
              last_id  = COALESCE(md_trades.last_id,  EXCLUDED.last_id),
              maker    = COALESCE(md_trades.maker,    EXCLUDED.maker),
              event_ts = COALESCE(md_trades.event_ts, EXCLUDED.event_ts);
          `;
            await pool.query(sql, values);

            LOG('[uploader] inserted', rows.length, 'rows');
        } catch (e) {
            LOG('[uploader] error', e);
        }
    }
}

uploader();