import Websocket from "ws";
import { SYMBOLS, QUEUE_KEY } from "../lib/env";
import { redisQueue } from "./queue";

async function producer() {

    const streams = SYMBOLS.map(s => `${s}@aggTrade`).join('/');
    const url = `wss://fstream.binance.com/stream?streams=${streams}`;
    console.log('[producer] connection upstream', url);

    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY_BASE = 1000;

    function connectWebSocket() {
        const ws = new Websocket(url);

        ws.on('open', () => {
            console.log('[producer] upstream open');
            reconnectAttempts = 0;
        });

        ws.on('error', (e) => {
            console.log('[producer] upstream error', e);
        });

        ws.on('close', () => {
            console.log('[producer] upstream closed');
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttempts - 1), 30000);
                console.log(`[producer] attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
                setTimeout(connectWebSocket, delay);
            } else {
                console.log('[producer] max reconnection attempts reached, exiting');
                process.exit(1);
            }
        });

        ws.on('message', async (raw) => {
            try {
                const msg = JSON.parse(String(raw));
                const d = msg.data;
                if (!d || d.e !== 'aggTrade') return;

                // Push to Redis list for database upload
                await redisQueue().push(QUEUE_KEY, JSON.stringify(d));

                // Publish to pubsub channel for real-time subscribers
                await redisQueue().publish('market:trades', JSON.stringify({
                    type: 'aggTrade',
                    data: d,
                    timestamp: new Date().toISOString()
                }));

            } catch (e) {
                console.log('[producer] parse/lpush/publish error', e);
            }
        });

        return ws;
    }

    const ws = connectWebSocket();

    const shutdown = async () => {
        console.log('[producer] shutdown');
        try {
            ws.close();
            await redisQueue().clear(QUEUE_KEY);
            console.log('[producer] connections closed');
        } catch (e) {
            console.log('[producer] shutdown error', e);
        }
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

producer();