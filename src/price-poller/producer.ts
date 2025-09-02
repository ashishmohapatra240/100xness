import Websocket from "ws";
import { SYMBOLS, QUEUE_KEY } from "../lib/env";
import { redisQueue } from "./queue";
import { redis } from "../lib/redis";


type BidAsk = Record<string, { bid: number, ask: number }>;

async function producer() {

    const streams = SYMBOLS.map(s => `${s}@aggTrade/${s}@bookTicker`).join('/');
    const url = `wss://fstream.binance.com/stream?streams=${streams}`;
    console.log('[producer] connection upstream', url);

    let bids: BidAsk = {};


    function connectWebSocket() {
        const ws = new Websocket(url);
        ws.on('open', () => {
            console.log('[producer] upstream open');
        });
        ws.on('error', (e) => {
            console.log('[producer] upstream error', e);
        });
        ws.on('close', () => {
            console.log('[producer] upstream closed');
        });
        ws.on('message', async (raw) => {
            try {
                const msg = JSON.parse(String(raw));
                const d = msg.data;

                const bid = d.b;
                const ask = d.a;

                if (!d || d.e !== 'aggTrade' && d.e !== 'bookTicker') return;
                if (d.e === "bookTicker") {
                    bids[d.s] = {
                        bid,
                        ask
                    }
                    console.log("bid",bid,"ask", ask)

                    return;
                }
                if (d.e === "aggTrade") {
                    const { bid, ask } = bids[d.s] || { bid: null, ask: null };

                    await redisQueue().push(QUEUE_KEY, JSON.stringify(d));

                    await redisQueue().publish('market:trades', JSON.stringify({
                        data: d,
                        bid,
                        ask,
                        timestamp: new Date().toISOString()
                    }));

                    const ts = Number(d.T) || Date.now();
                    await redis.set(`last:price:${d.s}`, JSON.stringify({ ask, bid, ts }))
                    console.log(`[producer] updated last:price:${d.s}`, ask, bid, ts);

                }
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