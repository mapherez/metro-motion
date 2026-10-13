import { EventEmitter } from 'node:events';
import { loadConfig } from '../dist/config.js';

export const logger = { warn() {}, info() {}, error() {} };
export const settings = (overrides = {}) => ({ ...loadConfig({ METRO_MOCK: '1', REDIS_URL: 'redis://localhost:6379' }), ...overrides });

export class FakeRedis extends EventEmitter {
  status = 'ready';
  channels = new Set();
  constructor(shared = { values: new Map(), clients: new Set(), available: true, now: () => Date.now() }) {
    super();
    this.shared = shared;
    shared.clients.add(this);
  }
  async ping() { if (!this.shared.available) throw new Error('Offline'); return 'PONG'; }
  async get(key) {
    await this.ping();
    const entry = this.shared.values.get(key);
    return entry && entry.expires > this.shared.now() ? entry.value : null;
  }
  async set(key, value, _ex, ttl) {
    await this.ping();
    this.shared.values.set(key, { value, expires: this.shared.now() + ttl * 1000 });
    return 'OK';
  }
  async publish(channel, message) {
    await this.ping();
    for (const client of this.shared.clients) {
      if (client.channels.has(channel)) client.emit('message', channel, message);
    }
    return 1;
  }
  duplicate() { return new FakeRedis(this.shared); }
  async subscribe(channel) { await this.ping(); this.channels.add(channel); return 1; }
  async quit() { this.disconnect(); return 'OK'; }
  disconnect() { this.status = 'end'; this.shared.clients.delete(this); this.emit('close'); }
  outage() {
    this.shared.available = false;
    this.shared.values.clear();
    for (const client of this.shared.clients) { client.status = 'reconnecting'; client.emit('close'); }
  }
  restore() {
    this.shared.available = true;
    for (const client of this.shared.clients) { client.status = 'ready'; client.emit('ready'); }
  }
}

export const nextTurn = () => new Promise(resolve => setImmediate(resolve));
