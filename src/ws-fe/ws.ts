import WebSocket, { WebSocketServer } from "ws";
import Redis from "ioredis";

import { REDIS_URL } from "../lib/env";

const PORT = Number(process.env.PORT ?? 8080);
const redis = new Redis(REDIS_URL);

const CHANNELS = ["market:trades"];

const sub = new Redis(REDIS_URL);
sub.on("error", (e) => console.error("[redis:sub:error]", e));


const wss = new WebSocketServer({ port: PORT });
console.log(`[ws] listening on :${PORT}`);

wss.on("connection", (ws: WebSocket) => {
    (ws as any).isAlive = true;
    ws.on("pong", () => ((ws as any).isAlive = true));
    ws.send(JSON.stringify({ type: "hello", ts: Date.now() }));
});


(async () => {
    await sub.subscribe(...CHANNELS);
    console.log("[redis] subscribed:", CHANNELS.join(", "));
})();


sub.on("message", (channel, message) => {
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
});

const shutdown = async () => {
    console.log("\n[shutdown] closing…");
    wss.close();
    await sub.quit();
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);