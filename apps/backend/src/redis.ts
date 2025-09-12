import Redis from 'ioredis';
import { config } from './config.js';

export function createRedis() {
  if (!config.redis.url) {
    // Allow running without Redis in dev (no-ops)
    const noop = {
      async set() {},
      async get() { return null as any; },
      async publish() {},
      async duplicate() { return noop; },
      async subscribe() {},
      on() {},
      quit() {}
    } as unknown as Redis;
    return noop;
  }
  return new Redis(config.redis.url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1
  });
}
