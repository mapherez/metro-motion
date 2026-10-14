import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildServer } from '../dist/server.js';
import { toSnapshot, buildStationEtaSnapshot } from '@metro/shared-utils';
import { FakeRedis, settings, nextTurn } from './helpers.mjs';

test('HTTP snapshots, line ETAs, invalid cache data and dependency readiness', async t => {
  const redis = new FakeRedis();
  const config = settings({ frontendDist: '/missing-frontend' });
  const app = buildServer(config, { redis, logger: false });
  t.after(() => app.close());
  assert.equal((await app.inject('/api/now')).statusCode, 204);
  assert.equal((await app.inject('/api/lines/azul/etas')).statusCode, 204);
  const snapshot = toSnapshot([]);
  await redis.set(config.redis.snapshotKey, JSON.stringify(snapshot), 'EX', 15);
  assert.deepEqual((await app.inject('/api/now')).json(), snapshot);
  for (const line of ['azul', 'verde', 'vermelha', 'amarela']) {
    const response = await app.inject(`/api/lines/${line}/etas`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().line, line);
    assert.equal(response.json().schemaVersion, 2);
    assert.deepEqual(response.json().stations, snapshot.lines[line].stations);
  }
  const station = (await app.inject('/api/stations/AM')).json();
  assert.equal(station.station.id, 'AM');
  assert.deepEqual(station.station.lines, ['verde', 'vermelha']);
  assert.ok(station.station.lat && station.station.lon);
  assert.equal((await app.inject('/api/stations/UNKNOWN')).statusCode, 404);
  assert.equal((await app.inject('/api/lines/invalid/etas')).statusCode, 404);
  await redis.set(config.redis.snapshotKey, '{broken', 'EX', 15);
  assert.equal((await app.inject('/api/now')).statusCode, 500);
  await redis.set(config.redis.snapshotKey, '{}', 'EX', 15);
  assert.equal((await app.inject('/api/now')).statusCode, 500);
  assert.equal((await app.inject('/readyz')).statusCode, 200);
  redis.outage();
  assert.equal((await app.inject('/healthz')).statusCode, 200);
  for (const url of ['/readyz', '/api/now', '/api/lines/azul/etas', '/api/stream']) {
    assert.equal((await app.inject(url)).statusCode, 503);
  }
  redis.restore();
  await nextTurn();
  assert.equal((await app.inject('/readyz')).statusCode, 200);
});
test('SPA navigation works without swallowing missing APIs or assets', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'metro-spa-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'index.html'), '<html>metro</html>');
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'assets', 'app.js'), 'console.log("metro")');
  const app = buildServer(settings({ production: true, frontendDist: dir }), { redis: new FakeRedis(), logger: false });
  t.after(() => app.close());
  for (const url of ['/', '/about', '/line/azul', '/station/AM']) {
    const response = await app.inject({ url, headers: { accept: 'text/html' } });
    assert.equal(response.statusCode, 200, url);
    assert.equal(response.body, '<html>metro</html>');
  }
  assert.equal((await app.inject('/assets/app.js')).statusCode, 200);
  for (const url of ['/api', '/api/missing', '/assets/missing.js', '/missing.svg', '/assets/missing']) {
    assert.equal((await app.inject({ url, headers: { accept: 'text/html' } })).statusCode, 404, url);
  }
  assert.equal((await app.inject({ method: 'POST', url: '/about', headers: { accept: 'text/html' } })).statusCode, 404);
});
test('production fails clearly when frontend is missing', () => {
  assert.throws(() => buildServer(settings({ production: true, frontendDist: '/missing-build' })), /Frontend build missing/);
});
test('real HTTP SSE shares a subscription, reconnects after Redis restart and closes on shutdown', { timeout: 10000 }, async t => {
  const redis = new FakeRedis();
  const config = settings({ frontendDist: '/missing-build' });
  const snapshot = toSnapshot([]);
  await redis.set(config.redis.snapshotKey, JSON.stringify(snapshot), 'EX', 15);
  const app = buildServer(config, { redis, logger: false });
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const readers = [];
  t.after(async () => { for (const reader of readers) await reader.cancel().catch(() => {}); await app.close(); });
  const connect = async () => {
    const response = await fetch(`${address}/api/stream`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const reader = response.body.getReader();
    readers.push(reader);
    assert.match(new TextDecoder().decode((await reader.read()).value), /data:/);
    return reader;
  };
  const first = await connect();
  const second = await connect();
  assert.equal(redis.shared.clients.size, 2, 'one command connection plus one shared subscriber');
  const updated = { ...snapshot, t: snapshot.t + 1 };
  await redis.publish(config.redis.channel, JSON.stringify(updated));
  for (const reader of [first, second]) assert.match(new TextDecoder().decode((await reader.read()).value), new RegExp(`"t":${updated.t}`));
  await first.cancel();
  await redis.publish(config.redis.channel, JSON.stringify(snapshot));
  assert.match(new TextDecoder().decode((await second.read()).value), /data:/);
  redis.outage();
  await second.read().catch(() => {});
  assert.equal((await fetch(`${address}/api/stream`)).status, 503);
  redis.restore();
  await nextTurn();
  await redis.set(config.redis.snapshotKey, JSON.stringify(snapshot), 'EX', 15);
  const third = await connect();
  await app.close();
  await third.read().catch(() => {});
  assert.equal(redis.shared.clients.size, 0);
});
