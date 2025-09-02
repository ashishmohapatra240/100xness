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

    const startTimeNum = parseInt(startTime as string);
    const endTimeNum = parseInt(endTime as string);

    if (isNaN(startTimeNum) || isNaN(endTimeNum)) {
      return res.status(400).json({
        success: false,
        message: "startTime and endTime must be valid Unix timestamps"
      });
    }

    const startTimestamp = new Date(startTimeNum * 1000);
    const endTimestamp = new Date(endTimeNum * 1000);

    if (startTimestamp >= endTimestamp) {
      return res.status(400).json({
        success: false,
        message: "'from' timestamp must be before 'to' timestamp"
      });
    }

    const now = new Date();
    const minDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
    const maxDate = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    if (startTimestamp < minDate || endTimestamp > maxDate) {
      return res.status(400).json({
        success: false,
        message: "Timestamp range is out of reasonable bounds (max 1 year ago to 1 day in future)"
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
    const result = await pool.query(query, [symbolStr.toLowerCase(), startTimestamp, endTimestamp, limit]);
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

    if (error && typeof error === 'object' && 'code' in error && error.code === '22008') {
      return res.status(400).json({
        success: false,
        message: "Invalid timestamp format. Please provide valid Unix timestamps.",
        error: "TIMESTAMP_PARSE_ERROR"
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

export const getAvailableSymbols = async (req: Request, res: Response) => {
  try {
    console.log("Fetching available symbols from md_trades table...");

    const query = `
      SELECT DISTINCT symbol
      FROM md_trades
      ORDER BY symbol
    `;

    const result = await pool.query(query);
    const symbols = result.rows.map(row => row.symbol);

    console.log(`Found ${symbols.length} symbols:`, symbols);

    res.status(200).json({
      success: true,
      data: symbols,
      count: symbols.length
    });

  } catch (error) {
    console.error("Error fetching symbols:", error);

    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === '42P01') {
        return res.status(500).json({
          success: false,
          message: "Database table md_trades does not exist. Please ensure database schema is initialized.",
          error: "TABLE_NOT_FOUND"
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
