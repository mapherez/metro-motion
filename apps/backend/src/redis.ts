import Redis from 'ioredis';
import { config } from './config.js';

// Minimal shape the app uses from a Redis client.
type RedisLike = {
  set: (...args: any[]) => Promise<any> | any;
  get: (...args: any[]) => Promise<any> | any;
  publish: (...args: any[]) => Promise<any> | any;
  duplicate: () => Promise<RedisLike> | RedisLike;
  subscribe: (...args: any[]) => Promise<any> | any;
  on: (...args: any[]) => any;
  quit: () => Promise<any> | any;
};

export function createRedis(): RedisLike {
  if (!config.redis.url) {
    // Allow running without Redis in dev (no-ops)
    const noop: RedisLike = {
      async set() {},
      async get() { return null as any; },
      async publish() {},
      async duplicate() { return noop; },
      async subscribe() {},
      on() {},
      quit() {}
    };
    return noop;
  }
  // ioredis typing under NodeNext/ESM can mark the default export as non-constructable.
  // Cast the constructor to keep TS happy while preserving runtime behavior.
  const RedisCtor = Redis as unknown as new (...args: any[]) => any;
  return new RedisCtor(config.redis.url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1
  }) as unknown as RedisLike;
}
