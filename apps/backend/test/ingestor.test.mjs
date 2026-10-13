import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Ingestor } from '../dist/ingestor.js';
import { normalizeTempoEspera, buildStationEtaSnapshot } from '@metro/shared-utils';
import { Snapshot, StationEtaSnapshot } from '@metro/shared-types';
import { FakeRedis, logger, settings, nextTurn } from './helpers.mjs';

const fixture = JSON.parse(await readFile(new URL('../../../tools/assets/tempoEspera_Estacao_todos.json', import.meta.url), 'utf8'));
const open = () => new Date('2026-01-15T12:00:00Z');

test('fixture normalization produces valid trains and ETAs for all four lines', () => {
  const trains = normalizeTempoEspera(fixture, new Map(), new Map(), 25);
  assert.ok(trains.length > 0);
  assert.ok(trains.every(train => train.progress01 >= 0 && train.progress01 <= 1));
  const etas = StationEtaSnapshot.parse(buildStationEtaSnapshot(fixture));
  assert.equal(Object.keys(etas.lines).length, 4);
  assert.ok(Object.values(etas.lines).every(line => line.stations.length > 0));
});
test('mock bypasses closed hours and never calls the real data source', async () => {
  const redis = new FakeRedis();
  const config = settings();
  let calls = 0;
  const ingestor = new Ingestor(config, redis, logger, {
    now: () => new Date('2026-01-15T03:00:00Z'), fetchData: async () => { calls++; throw new Error(); }
  });
  await ingestor.pollOnce();
  const snapshot = Snapshot.parse(JSON.parse(await redis.get(config.redis.snapshotKey)));
  assert.equal(snapshot.serviceOpen, true);
  assert.equal(Object.keys(snapshot.lines).length, 4);
  assert.equal(calls, 0);
  await ingestor.stop();
});
test('missing mock fixture fails startup without a network fallback', async () => {
  const ingestor = new Ingestor(settings({ mockFile: '/missing-metro-fixture.json' }), new FakeRedis(), logger);
  await assert.rejects(ingestor.start(), /ENOENT/);
  await ingestor.stop();
});
test('API failure preserves snapshot and ETA timestamps and applies backoff', async () => {
  const redis = new FakeRedis();
  const config = settings({ mock: false });
  let calls = 0;
  const ingestor = new Ingestor(config, redis, logger, {
    now: open, fetchData: async () => { if (++calls === 1) return fixture; throw Object.assign(new Error(), { status: 429 }); }
  });
  await ingestor.pollOnce();
  const before = await redis.get(config.redis.snapshotKey);
  const etas = await redis.get(config.redis.stationEtaKey);
  assert.ok(await ingestor.pollOnce() >= 7900);
  assert.equal(await redis.get(config.redis.snapshotKey), before);
  assert.equal(await redis.get(config.redis.stationEtaKey), etas);
  assert.ok(await ingestor.pollOnce() >= 13900);
});
test('closed snapshots refresh before TTL and recover after a Redis outage', async () => {
  const redis = new FakeRedis();
  let clock = Date.parse('2026-01-15T03:00:00Z');
  redis.shared.now = () => clock;
  const config = settings({ mock: false, redis: { ...settings().redis, ttlSeconds: 1 } });
  let calls = 0;
  const ingestor = new Ingestor(config, redis, logger, {
    now: () => new Date(clock), fetchData: async () => { calls++; return fixture; }
  });
  for (let i = 0; i < 5; i++) {
    const next = await ingestor.pollOnce();
    assert.equal(next, 500);
    clock += next;
    assert.equal(JSON.parse(await redis.get(config.redis.snapshotKey)).serviceOpen, false);
  }
  redis.outage();
  await ingestor.pollOnce();
  redis.restore();
  await ingestor.pollOnce();
  assert.equal(JSON.parse(await redis.get(config.redis.snapshotKey)).serviceOpen, false);
  assert.equal(calls, 0);
});
test('invalid upstream data does not become a fresh empty snapshot', async () => {
  const redis = new FakeRedis();
  const config = settings({ mock: false });
  const ingestor = new Ingestor(config, redis, logger, { now: open, fetchData: async () => ({ unexpected: true }) });
  await ingestor.pollOnce();
  assert.equal(await redis.get(config.redis.snapshotKey), null);
});
test('opening during an upstream outage changes service state without refreshing old data', async () => {
  const redis = new FakeRedis();
  const config = settings({ mock: false });
  let clock = new Date('2026-01-15T06:29:59Z');
  const ingestor = new Ingestor(config, redis, logger, {
    now: () => clock, fetchData: async () => { throw new Error('offline'); }
  });
  await ingestor.pollOnce();
  const closed = JSON.parse(await redis.get(config.redis.snapshotKey));
  assert.equal(closed.serviceOpen, false);
  clock = new Date('2026-01-15T06:30:00Z');
  await ingestor.pollOnce();
  const opened = JSON.parse(await redis.get(config.redis.snapshotKey));
  assert.equal(opened.serviceOpen, true);
  assert.equal(opened.t, closed.t);
});
test('a partially valid response cannot replace either last-good snapshot', async () => {
  const redis = new FakeRedis();
  const config = settings({ mock: false });
  let calls = 0;
  const ingestor = new Ingestor(config, redis, logger, {
    now: open, fetchData: async () => ++calls === 1 ? fixture : {
      resposta: [{ stop_id: 'RM', hora: '20260115120000', comboio: '7C', tempoChegada1: '-1', destino: '54' }]
    }
  });
  await ingestor.pollOnce();
  const before = await redis.get(config.redis.snapshotKey);
  const etas = await redis.get(config.redis.stationEtaKey);
  await ingestor.pollOnce();
  assert.equal(await redis.get(config.redis.snapshotKey), before);
  assert.equal(await redis.get(config.redis.stationEtaKey), etas);
});
test('stop aborts in-flight polling and does not schedule another request', async () => {
  const config = settings({ mock: false, pollIntervalMs: 1 });
  let signal;
  let calls = 0;
  const ingestor = new Ingestor(config, new FakeRedis(), logger, {
    now: open, fetchData: async (abortSignal) => {
      signal = abortSignal; calls++;
      return new Promise((_, reject) => abortSignal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    }
  });
  await ingestor.start();
  await nextTurn();
  await ingestor.stop();
  assert.equal(signal.aborted, true);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(calls, 1);
});
