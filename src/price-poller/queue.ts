import Redis from "ioredis";
import { REDIS_URL, SYMBOLS, QUEUE_KEY } from "../lib/env";


const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true
});

redis.on('error', (e) => console.log('[producer][redis:error]', e));
redis.on('connect', () => console.log('[producer][redis] connected'));
redis.on('reconnecting', () => console.log('[producer][redis] reconnecting'));

export function redisQueue() {
    return {
        push: (key: string, value: string) => redis.lpush(key, value),
        pop: (key: string) => redis.rpop(key),
        size: (key: string) => redis.llen(key),
        clear: (key: string) => redis.del(key),
        list: (key: string) => redis.lrange(key, 0, -1),
        exists: (key: string) => redis.exists(key),
        keys: (pattern: string) => redis.keys(pattern),
        publish: (channel: string, message: string) => redis.publish(channel, message),
    }
}