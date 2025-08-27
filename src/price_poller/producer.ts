import Websocket from "ws";
import Redis from "ioredis";
import { REDIS_URL, SYMBOLS, QUEUE_KEY, LOG } from "../lib/env";

async function producer() {
    const redis = new Redis(REDIS_URL);
    redis.on('error', (e) => LOG('[producer][redis:error]', e));


    const streams = SYMBOLS.map(s => `${s}@aggTrade`).join('/');
    const url = `wss://fstream.binance.com/stream?streams=${streams}`;
    LOG('[producer] connection upstream', url);


    const ws = new Websocket(url);
    ws.on('open', () => LOG('[producer] upstream open'));
    ws.on('error', (e) => LOG('[producer] upstream error', e));
    ws.on('close', () => LOG('[producer] upstream closed'));

    ws.on('message', async (raw) => {
        try {
            const msg = JSON.parse(String(raw));
            const d = msg.data;
            if (!d || d.e !== 'aggTrade') return;

            // Push to Redis list for database upload
            await redis.lpush(QUEUE_KEY, JSON.stringify(d));

            // Publish to pubsub channel for real-time subscribers
            await redis.publish('market:trades', JSON.stringify({
                type: 'aggTrade',
                data: d,
                timestamp: new Date().toISOString()
            }));

        } catch (e) {
            LOG('[producer] parse/lpush/publish error', e);
        }
    });

    const shutdown = async () => {
        LOG('[producer] shutdown');
        try {
            ws.close();
        } catch (e) { }
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}


producer();