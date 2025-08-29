import { Router } from "express";
import { getOrders, createOrder, closeOrder, getOrderById, borrowAsset, closeBorrow, getBorrows } from "../controller/order.controller";

const router = Router();

router.get("/orders", getOrders);
router.post("/orders", createOrder);
router.get("/orders/:id", getOrderById);
router.post("/orders/:id/close", closeOrder);
router.post("/orders/:id/borrow", borrowAsset);
router.post("/orders/:id/borrow/close", closeBorrow);
router.get("/orders/:id/borrows", getBorrows);

export default router;