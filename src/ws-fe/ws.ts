import WebSocket, { WebSocketServer } from "ws";
import { redis } from "../lib/redis";

const PORT = 8080;
const CHANNELS = ["market:trades"];

const wss = new WebSocketServer({ port: PORT });

const sub = redis.duplicate();

(async () => {
    try {
        await sub.subscribe(...CHANNELS);
        console.log(`[ws] listening on ${PORT}, subscribed to ${CHANNELS.join(",")}`);
    } catch (e) {
        console.error("[ws] subscribe error", e);
        process.exit(1);
    }
})();


sub.on("message", (_channel, message) => {
    let sent = 0;
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
                sent++;
            } catch { }
        }
    }
    if (sent) console.log(`[ws] broadcast to ${sent} client(s)`);
});

wss.on("connection", (ws) => {
    console.log("[ws] client connected");
    ws.on("close", () => console.log("[ws] client closed"));
    ws.on("error", (e) => console.error("[ws] client error", e));
});

const shutdown = async () => {
    try { await sub.unsubscribe(...CHANNELS); } catch { }
    try { await sub.quit(); } catch { }
    wss.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);