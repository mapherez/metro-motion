import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SnapshotStream } from '../dist/sse.js';
import { toSnapshot } from '@metro/shared-utils';
import { FakeRedis, logger, nextTurn } from './helpers.mjs';

class Client extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  writableLength = 0;
  frames = [];
  acceptsWrites = true;
  write(frame) { this.frames.push(frame); return this.acceptsWrites; }
  destroy() { this.destroyed = true; this.emit('close'); }
}
test('stream ignores invalid payloads and bounds slow-client buffering', async () => {
  const redis = new FakeRedis();
  const stream = new SnapshotStream(redis, 'events', logger);
  await nextTurn();
  const slow = new Client();
  const healthy = new Client();
  stream.add(slow, null);
  stream.add(healthy, null);
  await redis.publish('events', '{}');
  assert.equal(healthy.frames.length, 1);
  slow.acceptsWrites = false;
  await redis.publish('events', JSON.stringify(toSnapshot([])));
  assert.equal(slow.destroyed, true);
  assert.equal(healthy.frames.length, 2);
  await stream.close();
  assert.equal(healthy.destroyed, true);
  assert.equal(redis.shared.clients.size, 1);
});
