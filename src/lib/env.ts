import 'dotenv/config';

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
export const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/market';
export const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt'];
export const QUEUE_KEY = 'md:aggtrades:queue';
export const BATCH_SIZE = 5000;
export const BLOCK_TIMEOUT = 5;
export const LOG = (...args: any[]) => console.log(new Date().toISOString(), ...args);
