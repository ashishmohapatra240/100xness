import Redis from 'ioredis';
import { pool, schema } from '../lib/db';
import { REDIS_URL, QUEUE_KEY, BATCH_SIZE, BLOCK_TIMEOUT } from '../lib/env';
import { redisQueue } from './queue';
import { redis } from '../lib/redis';

type Row = {
    ts: Date; symbol: string; price: number; qty: number;
    agg_id: number; first_id?: number; last_id?: number;
    maker?: boolean; event_ts?: Date;
};

async function uploader() {

    redis.on('error', (e) => console.log('[uploader][redis:error]', e));
    redis.on('connect', () => console.log('[uploader][redis] connected'));
    redis.on('reconnecting', () => console.log('[uploader][redis] reconnecting'));

    await pool.query('SELECT 1');
    await schema();

    console.log('[uploader] consuming from list', { QUEUE_KEY, BATCH_SIZE, BLOCK_TIMEOUT });

    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;

    const shutdown = async () => {
        console.log('[uploader] shutdown');
        try {
            await redis.quit();
            await pool.end();
            console.log('[uploader] connections closed');
        } catch (e) {
            console.log('[uploader] shutdown error', e);
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    while (true) {
        try {
            const batch: any[] = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                const res = await redisQueue().pop(QUEUE_KEY);
                console.log('[uploader] res', res);
                if (!res) break;
                batch.push(res[1]);
            }
            if (batch.length === 0) continue;

            const rows: Row[] = batch.map(d => {
                const tradeTime = d.T && !isNaN(Number(d.T)) ? new Date(Number(d.T)) : new Date();
                const eventTime = d.E && !isNaN(Number(d.E)) ? new Date(Number(d.E)) : undefined;

                if (!d.T || isNaN(Number(d.T))) {
                    console.log('[uploader] warning: invalid trade timestamp', { T: d.T, data: d });
                }
                if (d.E && isNaN(Number(d.E))) {
                    console.log('[uploader] warning: invalid event timestamp', { E: d.E, data: d });
                }

                return {
                    ts: tradeTime,
                    symbol: String(d.s).toLowerCase(),
                    price: Number(d.p),
                    qty: Number(d.q),
                    agg_id: Number(d.a),
                    first_id: d.f ? Number(d.f) : undefined,
                    last_id: d.l ? Number(d.l) : undefined,
                    maker: d.m,
                    event_ts: eventTime,
                };
            }).filter(row => {
                // Filter out rows with invalid data
                const isValid = !isNaN(row.price) &&
                    !isNaN(row.qty) &&
                    !isNaN(row.agg_id) &&
                    row.symbol &&
                    row.symbol.length > 0;

                if (!isValid) {
                    console.log('[uploader] warning: filtering out invalid row', row);
                }

                return isValid;
            });

            if (rows.length === 0) {
                console.log('[uploader] warning: no valid rows after filtering, skipping batch');
                continue;
            }

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

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

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

                await client.query(sql, values);
                await client.query('COMMIT');

                console.log('[uploader] inserted', rows.length, 'rows');
                consecutiveErrors = 0; // Reset error counter on success

            } catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            } finally {
                client.release();
            }

        } catch (e) {
            consecutiveErrors++;
            console.log('[uploader] error', e);

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.log(`[uploader] ${MAX_CONSECUTIVE_ERRORS} consecutive errors, pausing for 30 seconds`);
                await new Promise(resolve => setTimeout(resolve, 30000));
                consecutiveErrors = 0;
            } else {
                const delay = Math.min(1000 * Math.pow(2, consecutiveErrors - 1), 10000);
                console.log(`[uploader] retrying in ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

uploader();