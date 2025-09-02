import { Request, Response } from "express";
import { prisma } from "../../lib/config";
import { redis } from "../../lib/redis";

function validateTPSL(side: "long" | "short", entry: number, tp?: number | null, sl?: number | null) {
    if (tp != null) {
        if (side === "long" && tp < entry) throw new Error("For long, takeProfit must be ≥ entry price");
        if (side === "short" && tp > entry) throw new Error("For short, takeProfit must be ≤ entry price");
    }
    if (sl != null) {
        if (side === "long" && sl > entry) throw new Error("For long, stopLoss must be ≤ entry price");
        if (side === "short" && sl < entry) throw new Error("For short, stopLoss must be ≥ entry price");
    }
}

export const createOrder = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        let {
            quantity, price, orderType = "long",
            symbol, status = "open", margin, leverage = 1,
            stopLoss, takeProfit = null
        } = req.body as {
            quantity: number; price: number; orderType?: "long" | "short";
            symbol: string; status?: "open" | "closed"; margin?: number | null; leverage?: number;
            stopLoss?: number | null; takeProfit?: number | null;
        };

        if (status === "closed") return res.status(400).json({ message: "Order is closed" });

        const symDb = symbol.toLowerCase() as any; // matches SymbolTrade enum

        validateTPSL(orderType, Number(price),
            takeProfit == null ? null : Number(takeProfit),
            stopLoss == null ? null : Number(stopLoss)
        );

        const bal = await prisma.balance.findUnique({ where: { userId } });
        if (!bal) return res.status(400).json({ message: "Balance not found" });

        const notional = Number(quantity) * Number(price);
        const L = Math.max(1, Number(leverage));
        const requiredMargin = notional / L;

        if (bal.usd_balance.toNumber() < requiredMargin) {
            return res.status(400).json({ message: "Insufficient balance" });
        }

        const order = await prisma.order.create({
            data: {
                userId,
                symbol: symDb,
                quantity,
                price,
                orderType,        // long | short
                status: "open",
                margin: (margin ?? requiredMargin),
                leverage: L,
                stopLoss,
                takeProfit,
            },
        });

        return res.status(201).json(order);
    } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "Internal server error";
        const code = msg.includes("takeProfit") || msg.includes("stopLoss") ? 400 : 500;
        return res.status(code).json({ message: msg });
    }
};

export const getOrders = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.max(1, Number(req.query.limit ?? 10));
        const status = req.query.status as "open" | "closed" | undefined;

        const where = { userId, ...(status ? { status } : {}) };

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma.order.count({ where }),
        ]);

        return res.status(200).json({ orders, total });
    } catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;
        const order = await prisma.order.findFirst({ where: { id, userId } });
        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.status(200).json(order);
    } catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const closeOrder = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const o = await prisma.order.findFirst({
            where: { id, userId, status: "open" },
            select: { symbol: true, orderType: true, price: true, quantity: true }
        });
        if (!o) return res.status(404).json({ message: "Order not found or already closed" });

        const key = `last:price:${o.symbol.toUpperCase()}`;
        const raw = await redis.get(key);
        if (!raw) return res.status(404).json({ message: "Last price not available" });

        const { bid: lastPrice } = JSON.parse(raw);
        const entry = Number(o.price);
        const qty = Number(o.quantity);
        const lp = Number(lastPrice);

        const pnl = o.orderType === "long"
            ? (lp - entry) * qty
            : (entry - lp) * qty;

        const { count } = await prisma.order.updateMany({
            where: { id, userId, status: "open" },
            data: {
                status: "closed",
                exitPrice: lp,
                pnl,
                closeReason: "manual",
                closedAt: new Date(),
            },
        });
        if (count === 0) return res.status(404).json({ message: "Order not found or already closed" });

        const updated = await prisma.order.findUnique({ where: { id } });
        return res.status(200).json(updated);
    } catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const updateOrderTPSL = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id!;
        const { id } = req.params;
        const { takeProfit, stopLoss } = req.body as { takeProfit?: number | null; stopLoss?: number | null };

        const o = await prisma.order.findFirst({ where: { id, userId } });
        if (!o) return res.status(404).json({ message: "Order not found" });

        validateTPSL(
            o.orderType as "long" | "short",
            Number(o.price),
            takeProfit == null ? null : Number(takeProfit),
            stopLoss == null ? null : Number(stopLoss)
        );

        const updated = await prisma.order.update({
            where: { id },
            data: { takeProfit, stopLoss },
        });
        return res.json(updated);
    } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "Internal server error";
        const code = msg.includes("takeProfit") || msg.includes("stopLoss") ? 400 : 500;
        return res.status(code).json({ message: msg });
    }
};
