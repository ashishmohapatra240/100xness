import { Router } from "express";
import { getOrders, createOrder, closeOrder, getOrderById} from "../controller/order.controller";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/orders", getOrders);
router.post("/orders", createOrder);
router.get("/orders/:id", getOrderById);
router.post("/orders/:id/close", closeOrder);

export default router;