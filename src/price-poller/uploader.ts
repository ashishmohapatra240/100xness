import { pool, schema } from '../lib/db';
import { QUEUE_KEY, BATCH_SIZE } from '../lib/env';
import { redisQueue } from './queue';

type AggTradeEvent = {
    e: "aggTrade";
    E: number;
    a: number;
    s: string;
    p: string;
    q: string;
    f?: number;
    l?: number;
    T: number;
    m?: boolean;
};

type Row = {
    ts: Date;
    symbol: string;
    price: number;
    qty: number;
    agg_id: number;
    first_id?: number | null;
    last_id?: number | null;
    maker?: boolean | null;
    event_ts: Date;
};

async function uploader() {
    await pool.query('SELECT 1');
    await schema();

    console.log('[uploader] consuming from queue', { QUEUE_KEY, BATCH_SIZE });

    while (true) {
        try {
            const queueSizeBefore = await redisQueue().size(QUEUE_KEY);
            console.log('[uploader] queue size before processing:', queueSizeBefore);
            
            if (queueSizeBefore > 2000) {
                console.warn('[uploader] HIGH QUEUE SIZE - consider scaling:', queueSizeBefore);
            }
            
            const batch: AggTradeEvent[] = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                const res = await redisQueue().pop(QUEUE_KEY);
                if (!res) break;

                const raw = res;

                if (!raw) continue;

                try {
                    let ev: AggTradeEvent;
                    if (typeof raw === 'string') {
                        const trimmed = raw.trim();
                        if (!trimmed || trimmed.length < 2) {
                            console.log('[uploader] Empty or too short raw data:', raw);
                            continue;
                        }
                        ev = JSON.parse(trimmed);
                    } else {
                        ev = raw;
                    }

                    if (ev && ev.e === 'aggTrade') batch.push(ev);
                } catch (parseError) {
                    console.log('[uploader] JSON parse error for raw data:', raw);
                    console.log('[uploader] Parse error details:', parseError);
                    continue;
                }
            }
            if (batch.length === 0) {
                console.log('[uploader] no items in queue, waiting 1 second...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            // Uncomment below to enforce minimum batch size (reduces real-time performance)
            // const MIN_BATCH_SIZE = 50; 
            // if (batch.length < MIN_BATCH_SIZE) {
            //     console.log(`[uploader] batch too small (${batch.length}), waiting for more items...`);
            //     await new Promise(resolve => setTimeout(resolve, 2000));
            //     continue;
            // }

            console.log('[uploader] processed batch size:', batch.length);

            const rows: Row[] = batch.map((ev) => {
                const ts = new Date(ev.T);
                const event_ts = new Date(ev.E);

                return {
                    ts,
                    symbol: String(ev.s).toLowerCase(),
                    price: Number(ev.p),
                    qty: Number(ev.q),
                    agg_id: Number(ev.a),
                    first_id: ev.f !== undefined ? Number(ev.f) : null,
                    last_id: ev.l !== undefined ? Number(ev.l) : null,
                    maker: ev.m ?? null,
                    event_ts,
                };
            }).filter(r =>
                !isNaN(r.price) && !isNaN(r.qty) && !isNaN(r.agg_id) && !!r.symbol &&
                !isNaN(r.ts.getTime()) && !isNaN(r.event_ts.getTime())
            );

            console.log('[uploader] valid rows after filtering:', rows.length, 'from', batch.length, 'batch items');
            if (rows.length === 0) continue;



            const placeholders: string[] = [];
            const values: any[] = [];
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i];
                const base = i * 9;
                placeholders.push(
                    `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`
                );
                values.push(
                    r.ts,
                    r.symbol,
                    r.price,
                    r.qty,
                    r.agg_id,
                    r.first_id,
                    r.last_id,
                    r.maker,
                    r.event_ts
                );
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
                const queueSizeAfter = await redisQueue().size(QUEUE_KEY);
                console.log('[uploader] inserted', rows.length, 'rows');
                console.log('[uploader] queue size after processing:', queueSizeAfter);
                const newItemsAdded = queueSizeAfter - (queueSizeBefore - rows.length);
                if (newItemsAdded > 0) {
                    console.log('[uploader] new items added during processing:', newItemsAdded);
                }
            } catch (dbError) {
                await client.query('ROLLBACK');
                throw dbError;
            } finally {
                client.release();
            }
        } catch (e) {
            console.log('[uploader] error', e);
            if (e instanceof Error) {
                console.log('[uploader] error stack:', e.stack);
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

uploader();
