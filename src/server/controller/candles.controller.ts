import { Request, Response } from "express";
import { pool } from "../../lib/db";

export const getCandles = async (req: Request, res: Response) => {
  try {
    const { ts, startTime, endTime, asset, limit = 1000 } = req.query;

    if (!startTime)
      return res.status(400).json({
        success: false,
        message: "startTime parameter is required"
      });
    if (!endTime)
      return res.status(400).json({
        success: false,
        message: "endTime parameter is required"
      });

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: "'from' timestamp must be before 'to' timestamp"
      });
    }

    let tableName: string;
    switch (ts) {
      case "5m":
        tableName = "md_candles_5m";
        break;
      case "30m":
        tableName = "md_candles_30m";
        break;
      case "1h":
        tableName = "md_candles_1h";
        break;
      case "1d":
        tableName = "md_candles_1d";
        break;
      default:
        tableName = "md_candles_5m";
    }

    const query = `
      SELECT
        bucket,
        symbol,
        open,
        high,
        low,
        close,
        volume
      FROM ${tableName}
      WHERE symbol = $1
        AND bucket >= $2
        AND bucket <= $3
      ORDER BY bucket DESC
      LIMIT $4
    `;

    const symbolStr = typeof asset === 'string' ? asset : 'btcusdt';
    const result = await pool.query(query, [symbolStr.toLowerCase(), startTime, endTime, limit]);
    const candles = result.rows.map(row => ({
      bucket: row.bucket,
      symbol: row.symbol,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume)
    }));

    const response = {
      success: true,
      data: candles,
      meta: {
        symbol: symbolStr,
        ts,
        from: startTime,
        to: endTime,
        count: candles.length
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching candles:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

export const getAvailableSymbols = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT DISTINCT symbol
      FROM md_trades
      ORDER BY symbol
    `;

    const result = await pool.query(query);
    const symbols = result.rows.map(row => row.symbol);

    res.status(200).json({
      success: true,
      data: symbols,
      count: symbols.length
    });

  } catch (error) {
    console.error("Error fetching symbols:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
