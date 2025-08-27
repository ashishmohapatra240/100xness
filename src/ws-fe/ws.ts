import WebSocket, { WebSocketServer } from "ws";
import Redis from "ioredis";

import { REDIS_URL } from "../lib/env";

const PORT = Number(process.env.PORT ?? 8080);
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true
});

const CHANNELS = ["market:trades"];

const sub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true
});

redis.on("error", (e) => console.error("[redis:error]", e));
redis.on("connect", () => console.log("[redis] connected"));
redis.on("reconnecting", () => console.log("[redis] reconnecting"));

sub.on("error", (e) => console.error("[redis:sub:error]", e));
sub.on("connect", () => console.log("[redis:sub] connected"));
sub.on("reconnecting", () => console.log("[redis:sub] reconnecting"));

const wss = new WebSocketServer({ port: PORT });
console.log(`[ws] listening on :${PORT}`);

// Connection management
wss.on("connection", (ws: WebSocket) => {
    (ws as any).isAlive = true;
    (ws as any).connectionTime = Date.now();

    ws.on("pong", () => ((ws as any).isAlive = true));

    ws.on("error", (error) => {
        console.error("[ws] connection error:", error);
    });

    ws.on("close", () => {
        const duration = Date.now() - (ws as any).connectionTime;
        console.log(`[ws] client disconnected after ${duration}ms`);
    });

    ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});

const interval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {
        if ((ws as any).isAlive === false) {
            console.log("[ws] terminating stale connection");
            return ws.terminate();
        }
        (ws as any).isAlive = false;
        ws.ping();
    });
}, 30000);

// Subscribe to Redis channels
(async () => {
    try {
        await sub.subscribe(...CHANNELS);
        console.log("[redis] subscribed:", CHANNELS.join(", "));
    } catch (error) {
        console.error("[redis] subscription error:", error);
        process.exit(1);
    }
})();

// Handle Redis messages
sub.on("message", (channel, message) => {
    let activeClients = 0;
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
                activeClients++;
            } catch (error) {
                console.error("[ws] send error:", error);
            }
        }
    }
    if (activeClients > 0) {
        console.log(`[ws] sent message to ${activeClients} clients`);
    }
});

const shutdown = async () => {
    console.log("\n[shutdown] closing…");

    clearInterval(interval);

    wss.close();

    try {
        await redis.quit();
        await sub.quit();
        console.log("[shutdown] Redis connections closed");
    } catch (error) {
        console.error("[shutdown] Redis close error:", error);
    }

    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);