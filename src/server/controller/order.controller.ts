import { prisma } from "../../lib/config"
import { Request, Response } from "express";


export const getOrders = async (req: Request, res: Response) => {

    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.max(1, Number(req.query.limit ?? 10));
        const status = req.query.status as "open" | "closed";


        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where: { userId, status: status },

                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: "desc" }
            }),
            prisma.order.count({ where: { userId, status: status } })
        ]);

        return res.status(200).json({ orders, total });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}


export const createOrder = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { quantity, price, orderType = "buy", symbol, status = "open", margin, leverage, stopLoss, takeProfit } = req.body;

        const order = await prisma.order.create({
            data: { userId, quantity, price, orderType, symbol, status, margin, leverage, stopLoss, takeProfit }
        })
        return res.status(201).json(order);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}


export const borrowAsset = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { symbol, quantity } = req.body;
        const { count } = await prisma.asset.updateMany({
            where: { userId, symbol },
            data: { quantity: { increment: quantity } }
        })

        if (count === 0) {
            return res.status(404).json({ message: "Asset not found" });
        }
        return res.status(200).json({ message: "Asset updated successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" })
    }
}


export const closeBorrow = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { id } = req.params;
        const borrow = await prisma.borrow.update({
            where: { id, userId },
            data: { status: "closed" }
        })
        if (!borrow) {
            return res.status(404).json({ message: "Borrow not found" });
        }
        return res.status(200).json(borrow);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}


export const getBorrows = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const page = Math.max(1, Number(req.query.page ?? 1));
        const limit = Math.max(1, Number(req.query.limit ?? 10));
        const status = req.query.status as "open" | "closed";


        const [borrows, total] = await Promise.all([
            prisma.borrow.findMany({
                where: { userId, status: status },

                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                orderBy: { createdAt: "desc" }
            }),
            prisma.borrow.count({ where: { userId, status: status } })
        ]);

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
}


export const closeOrder = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const order = await prisma.order.update({
            where: { id, userId },
            data: { status: "closed" }
        })
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        return res.status(200).json(order);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}


export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },

        })
        return res.status(200).json(order);
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}