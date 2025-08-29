import Redis from "ioredis";
import { REDIS_URL } from "./env";

export const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});
