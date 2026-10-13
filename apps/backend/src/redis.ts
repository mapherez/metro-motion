import { Redis } from 'ioredis';
import type { Config } from './config.js';

export type RedisClient = Pick<Redis, 'get' | 'set' | 'publish' | 'ping' | 'duplicate' | 'subscribe' | 'on' | 'off' | 'quit' | 'disconnect' | 'status'>;

export function createRedis(config: Config): RedisClient {
  return new Redis(config.redis.url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000)
  });
}

export async function closeRedis(redis: RedisClient) {
  try {
    if (redis.status === 'ready') await redis.quit();
  } catch {
    // Always stop reconnection, including when Redis is unavailable on shutdown.
  } finally {
    redis.disconnect();
  }
}
