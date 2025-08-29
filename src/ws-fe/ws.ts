import WebSocket, { WebSocketServer } from "ws";
import { redis } from "../lib/redis";

const PORT = 8080;

const CHANNELS = ["market:trades"];

const wss = new WebSocketServer({ port: PORT });

(async () => {
    try {
        await redis.subscribe(...CHANNELS);
        console.log(`[ws] connected to ${PORT}`);
    } catch (e) {
        console.error("[ws] error", e);
        process.exit(1)
    }
})();


wss.on("connection", (ws) => {
    console.log("[ws] connection");
    redis.on("message", (channel, message) => {
        let activeClients = 0;
        for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    console.log(`[ws] sending message to ${activeClients} clients`);
                    activeClients++;
                } catch (e) {
                    console.error("[ws] error", e);
                }
            }
        }
        ws.on("close", () => {
            console.log("[ws] connection closed");
        });
        ws.on("error", (e) => {
            console.error("[ws] error", e);
        });
    });
});