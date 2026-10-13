import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../dist/config.js';
import { computeServiceStatus } from '../dist/service-hours.js';

const mock = { REDIS_URL: 'redis://redis:6379', METRO_MOCK: '1' };
test('configuration requires Redis and a real-mode Metro token without leaking values', () => {
  assert.throws(() => loadConfig({ METRO_MOCK: '1' }), /REDIS_URL/);
  assert.throws(() => loadConfig({ REDIS_URL: mock.REDIS_URL }), /METRO_API_KEY/);
  assert.equal(loadConfig(mock).mock, true);
  assert.equal(loadConfig({ REDIS_URL: mock.REDIS_URL, METRO_API_KEY: 'secret' }).mock, false);
  assert.throws(() => loadConfig({ ...mock, REDIS_URL: 'https://password@host' }), /REDIS_URL must/);
  assert.throws(() => loadConfig({ ...mock, METRO_API_BASE: 'http://host' }), /METRO_API_BASE/);
  assert.throws(() => loadConfig({ ...mock, METRO_MOCK: 'true' }), /METRO_MOCK/);
});
test('configuration rejects invalid integer ranges and disabled TLS', () => {
  for (const field of ['PORT', 'POLL_INTERVAL_MS', 'DWELL_SECONDS', 'REDIS_TTL_SECONDS']) {
    for (const value of ['-1', '0', '1.5', 'oops', 'Infinity']) {
      assert.throws(() => loadConfig({ ...mock, [field]: value }), new RegExp(field));
    }
  }
  assert.throws(() => loadConfig({ ...mock, PORT: '65536' }), /PORT/);
  assert.throws(() => loadConfig({ ...mock, METRO_TLS_INSECURE: '1' }), /TLS/);
  assert.throws(() => loadConfig({ ...mock, NODE_TLS_REJECT_UNAUTHORIZED: '0' }), /TLS/);
});
test('Lisbon service boundaries in winter and summer', () => {
  for (const [date, open] of [
    ['2026-01-15T00:59:59Z', true], ['2026-01-15T01:00:00Z', false],
    ['2026-01-15T06:29:59Z', false], ['2026-01-15T06:30:00Z', true],
    ['2026-07-15T23:59:59Z', true], ['2026-07-16T00:00:00Z', false],
    ['2026-07-16T05:29:59Z', false], ['2026-07-16T05:30:00Z', true],
    ['2026-10-25T00:30:00Z', false], ['2026-10-25T01:30:00Z', false],
    ['2026-03-29T00:30:00Z', true], ['2026-03-29T01:30:00Z', false]
  ]) assert.equal(computeServiceStatus(new Date(date)).open, open, date);
  assert.equal(computeServiceStatus(new Date('2026-01-15T06:29:59Z')).msUntilOpen, 1000);
});
