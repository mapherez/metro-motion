import Redis from 'ioredis';

import { config } from './config.js';

type RedisCommand = (...args: unknown[]) => Promise<unknown> | unknown;
type RedisListener = (...args: unknown[]) => unknown;

// Minimal shape the app uses from a Redis client.
type RedisLike = {
  set: RedisCommand;
  get: RedisCommand;
  publish: RedisCommand;
  duplicate: () => Promise<RedisLike> | RedisLike;
  subscribe: RedisCommand;
  on: RedisListener;
  quit: RedisCommand;
};

export function createRedis(): RedisLike {
  if (!config.redis.url) {
    // Allow running without Redis in dev (no-ops)
    const noop: RedisLike = {
      async set() {},
      async get() { return null; },
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
  const RedisCtor = Redis as unknown as new (...args: unknown[]) => unknown;
  return new RedisCtor(config.redis.url, {
    lazyConnect: false,
    maxRetriesPerRequest: 1
  }) as unknown as RedisLike;
}
