import type { ServerResponse } from 'node:http';
import type { FastifyBaseLogger } from 'fastify';
import { Snapshot } from '@metro/shared-types';
import type { RedisClient } from './redis.js';
import { closeRedis } from './redis.js';

export class SnapshotStream {
  private clients = new Set<ServerResponse>();
  private subscriber: RedisClient;
  private subscribed = false;
  private closed = false;
  private heartbeat?: NodeJS.Timeout;

  constructor(redis: RedisClient, private channel: string, private log: FastifyBaseLogger) {
    this.subscriber = redis.duplicate();
    this.subscriber.on('error', () => this.log.warn('Redis subscriber unavailable'));
    this.subscriber.on('ready', this.subscribe);
    this.subscriber.on('close', this.unavailable);
    this.subscriber.on('message', this.onMessage);
    if (this.subscriber.status === 'ready') void this.subscribe();
    this.heartbeat = setInterval(() => this.broadcast(`: ping ${Date.now()}\n\n`), 20000);
    this.heartbeat.unref();
  }

  private subscribe = async () => {
    try {
      await this.subscriber.subscribe(this.channel);
      this.subscribed = !this.closed && this.subscriber.status === 'ready';
    } catch {
      this.unavailable();
    }
  };

  private unavailable = () => {
    this.subscribed = false;
    for (const client of this.clients) client.destroy();
    this.clients.clear();
  };

  get ready() { return !this.closed && this.subscribed && this.subscriber.status === 'ready'; }

  private write(client: ServerResponse, frame: string) {
    // Disconnect slow readers rather than retaining an unbounded queue.
    if (client.destroyed || client.writableEnded || client.writableLength > 65536) {
      client.destroy();
      this.clients.delete(client);
      return;
    }
    try {
      if (!client.write(frame)) {
        client.destroy();
        this.clients.delete(client);
      }
    } catch {
      client.destroy();
      this.clients.delete(client);
    }
  }

  private broadcast(frame: string) {
    for (const client of this.clients) this.write(client, frame);
  }

  private onMessage = (channel: string, raw: string) => {
    if (channel !== this.channel) return;
    try {
      const snapshot = Snapshot.parse(JSON.parse(raw));
      this.broadcast(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      this.log.warn('Ignoring invalid snapshot on Redis channel');
    }
  };

  add(client: ServerResponse, snapshot: unknown) {
    this.clients.add(client);
    const remove = () => this.clients.delete(client);
    client.once('close', remove);
    client.once('error', remove);
    this.write(client, snapshot ? `data: ${JSON.stringify(snapshot)}\n\n` : ': connected\n\n');
  }

  async close() {
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.unavailable();
    this.subscriber.off('ready', this.subscribe);
    this.subscriber.off('close', this.unavailable);
    this.subscriber.off('message', this.onMessage);
    await closeRedis(this.subscriber);
  }
}
