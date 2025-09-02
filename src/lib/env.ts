import 'dotenv/config';
export const config = {
    REDIS_URL: process.env.REDIS_URL!,
    TIMESCALE_URL: process.env.TIMESCALE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    SYMBOLS: ['btcusdt', 'ethusdt', 'solusdt'] as const,
    QUEUE_KEY: 'md:aggtrades:queue',
    BATCH_SIZE: 500,
    BLOCK_TIMEOUT: Number(process.env.BLOCK_TIMEOUT) || 5,
} as const;

export const REDIS_URL = config.REDIS_URL;
export const TIMESCALE_URL = config.TIMESCALE_URL;
export const JWT_SECRET = config.JWT_SECRET;
export const SYMBOLS = config.SYMBOLS;
export const QUEUE_KEY = config.QUEUE_KEY;
export const BATCH_SIZE = config.BATCH_SIZE;
export const BLOCK_TIMEOUT = config.BLOCK_TIMEOUT;
