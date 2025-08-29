import { Router } from "express";
import { getCandles, getAvailableSymbols } from "../controller/candles.controller";

const router = Router();

// GET /candles?time_frame=5m&symbol=btcusdt&from=1234567890&to=1234567899&limit=100
router.get("/candles", getCandles);

// GET /candles/symbols - Get available symbols
router.get("/candles/symbols", getAvailableSymbols);

export default router;
