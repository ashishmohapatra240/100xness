import { prisma } from "../lib/config";
import { redis } from "../lib/redis"

type Side = "long" | "short";
const sign = (side: Side) => (side === "long" ? 1 : -1);

function hitTP(side: Side, price: number, TP?: number | null) {
    if (TP == null) return false;
    const s = sign(side);
    return s * (price - TP) >= 0;
}


function hitSL(side: Side, price: number, SL?: number | null) {
    if (SL == null) return false;
    const s = sign(side);
    return s * (price - SL) <= 0;
}

function hitMargin(side: Side, entryPrice: number, qty: number, price: number, margin: number | null) {
    if (margin == null) return false;
    const pnl = sign(side) * (price - entryPrice) * qty;
    const loss = Math.max(0, -pnl);
    return loss >= margin;
}

async function closeOrder(orderId: string, current: number, reason: "takeProfit" | "stopLoss" | "margin") {
    await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });

        if (!order || order.status !== "open") return;
        const entry = Number(order.price);
        const qty = Number(order.quantity);
        const pnl = order.orderType === "long" ? (current - entry) * qty : (entry - current) * qty;


        await tx.order.update({
            where: { id: orderId },
            data: {
                status: "closed",
                exitPrice: current,
                pnl,
                closeReason: reason,
                closedAt: new Date()
            }
        })
    })
}

async function handleTick(symbolU: string, price: number, eventTs?: number) {
    const symbolDb = symbolU.toLowerCase() as any;
    const orders = await prisma.order.findMany({
        where: { symbol: symbolDb, status: "open" },
        select: { id: true, orderType: true, price: true, quantity: true, takeProfit: true, margin: true, stopLoss: true }
    });

    for (const order of orders) {
        const side: Side = (order.orderType === "long" ? "long" : "short");
        const qty = Number(order.quantity);
        const entry = Number(order.price);
        const tp = order.takeProfit == null ? null : Number(order.takeProfit);
        const sl = order.stopLoss == null ? null : Number(order.stopLoss);
        const mg = order.margin == null ? null : Number(order.margin);


        let reason: "takeProfit" | "stopLoss" | "margin" | null = null;
        if (hitTP(side, price, tp)) reason = "takeProfit";
        else if (hitSL(side, price, sl)) reason = "stopLoss";
        else if (hitMargin(side, entry, qty, price, mg)) reason = "margin";

        if (reason) {
            await closeOrder(order.id, price, reason);
        }
    }

}


async function start() {
    const sub = redis.duplicate();
    await sub.subscribe("market:trades")

    console.log("[liquidator] subscribed to market:trades");


    sub.on("message", async (_ch, raw) => {
        try {
            const msg = JSON.parse(raw);
            const d = msg?.data;
            if (!d || d.e !== "aggTrade") return;

            const symbolU = d.s;
            const price = Number(d.p);
            const ts = Number(d.T);
            if (!price || !symbolU) return;

            await handleTick(symbolU, price, ts);
        } catch (e) {
            console.error("[liquidator] error", e);
        }
    })

    const shutdown = async () => {
        try { await sub.unsubscribe("market:trades"); } catch { }
        try { await sub.quit(); } catch { }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

start();



