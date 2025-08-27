import 'dotenv/config';

function validateEnv() {
    const required = ['REDIS_URL', 'DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

validateEnv();

export const config = {
    REDIS_URL: process.env.REDIS_URL!,
    DB_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    SYMBOLS: ['btcusdt', 'ethusdt', 'solusdt'] as const,
    QUEUE_KEY: 'md:aggtrades:queue',
    BATCH_SIZE: Number(process.env.BATCH_SIZE) || 5000,
    BLOCK_TIMEOUT: Number(process.env.BLOCK_TIMEOUT) || 5,
} as const;

export const REDIS_URL = config.REDIS_URL;
export const DB_URL = config.DB_URL;
export const JWT_SECRET = config.JWT_SECRET;
export const SYMBOLS = config.SYMBOLS;
export const QUEUE_KEY = config.QUEUE_KEY;
export const BATCH_SIZE = config.BATCH_SIZE;
export const BLOCK_TIMEOUT = config.BLOCK_TIMEOUT;

export const validateConfig = () => {
    if (BATCH_SIZE <= 0 || BATCH_SIZE > 10000) {
        throw new Error(`BATCH_SIZE must be between 1 and 10000, got ${BATCH_SIZE}`);
    }

    if (BLOCK_TIMEOUT <= 0 || BLOCK_TIMEOUT > 60) {
        throw new Error(`BLOCK_TIMEOUT must be between 1 and 60, got ${BLOCK_TIMEOUT}`);
    }
};
