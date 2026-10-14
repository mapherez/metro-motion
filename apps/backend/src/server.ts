import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { Snapshot, LineNameEnum } from '@metro/shared-types';
import { stationMetadata } from '@metro/station-data/metadata';
import type { Config } from './config.js';
import { createRedis, closeRedis, type RedisClient } from './redis.js';
import { SnapshotStream } from './sse.js';

export function buildServer(config: Config, options: { redis?: RedisClient; logger?: boolean } = {}) {
  const indexPath = path.join(config.frontendDist, 'index.html');
  if (config.production && !existsSync(indexPath)) throw new Error('Frontend build missing: FRONTEND_DIST_DIR must contain index.html');
  const app = Fastify({ logger: options.logger ?? true });
  const redis = options.redis || createRedis(config);
  redis.on('error', () => app.log.warn('Redis unavailable; reconnecting'));
  const stream = new SnapshotStream(redis, config.redis.channel, app.log);

  app.addHook('preClose', async () => { await stream.close(); });
  app.addHook('onClose', async () => { await closeRedis(redis); });
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/readyz', async (_req, reply) => {
    try {
      await redis.ping();
      return { ok: true };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });

  app.get('/api/now', async (_req, reply) => {
    let raw: string | null;
    try { raw = await redis.get(config.redis.snapshotKey); }
    catch { return reply.code(503).send({ error: 'Redis unavailable' }); }
    if (!raw) return reply.code(204).send();
    try {
      return reply.header('Cache-Control', 'no-store').send(Snapshot.parse(JSON.parse(raw)));
    } catch {
      app.log.error('Invalid snapshot in Redis');
      return reply.code(500).send({ error: 'Invalid snapshot' });
    }
  });

  app.get<{ Params: { lineId: string } }>('/api/lines/:lineId/etas', async (req, reply) => {
    const line = LineNameEnum.safeParse(req.params.lineId.toLowerCase());
    if (!line.success) return reply.code(404).send({ error: 'Unknown line' });
    let raw: string | null;
    try { raw = await redis.get(config.redis.snapshotKey); }
    catch { return reply.code(503).send({ error: 'Redis unavailable' }); }
    if (!raw) return reply.code(204).send();
    try {
      const data = Snapshot.parse(JSON.parse(raw));
      return reply.header('Cache-Control', 'no-store').send({ schemaVersion: 2, line: line.data, t: data.lines[line.data].dataObservedAt, stations: data.lines[line.data].stations });
    } catch {
      app.log.error('Invalid station ETAs in Redis');
      return reply.code(500).send({ error: 'Invalid station ETAs' });
    }
  });

  app.get<{ Params: { stationId: string } }>('/api/stations/:stationId', async (req, reply) => {
    const id = req.params.stationId.toUpperCase();
    const fallback = stationMetadata.find(s => s.id === id);
    if (!fallback) return reply.code(404).send({ error: 'Unknown station' });
    let snapshot: import('@metro/shared-types').Snapshot | undefined;
    let available = true;
    try {
      const raw = await redis.get(config.redis.snapshotKey);
      if (raw) snapshot = Snapshot.parse(JSON.parse(raw));
    } catch { available = false; }
    const station = snapshot?.metadata.find(s => s.id === id) ?? fallback;
    return reply.header('Cache-Control', 'no-store').send({
      schemaVersion: 2, station, serviceOpen: snapshot?.serviceOpen ?? null, available,
      lines: station.lines.map(line => ({ line, status: snapshot?.lines[line].status ?? null,
        arrivals: snapshot?.lines[line].stations.find(s => s.stationId === id)?.arrivals ?? [] })),
      tiles: config.tiles
    });
  });

  app.get('/api/stream', async (_req, reply) => {
    let snapshot: unknown = null;
    try {
      await redis.ping();
      if (!stream.ready) return reply.code(503).send({ error: 'SSE unavailable' });
      const raw = await redis.get(config.redis.snapshotKey);
      if (raw) snapshot = Snapshot.parse(JSON.parse(raw));
    } catch {
      return reply.code(503).send({ error: 'SSE unavailable' });
    }
    if (!stream.ready) return reply.code(503).send({ error: 'SSE unavailable' });
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    stream.add(reply.raw, snapshot);
  });

  if (existsSync(indexPath)) {
    const indexHtml = readFileSync(indexPath, 'utf8');
    app.register(fastifyStatic, { root: config.frontendDist, wildcard: false, index: false });
    app.get('/', async (_req, reply) => reply.type('text/html').header('Cache-Control', 'no-cache').send(indexHtml));
    app.setNotFoundHandler((req, reply) => {
      const pathname = new URL(req.raw.url || '/', 'http://localhost').pathname;
      const isApi = pathname === '/api' || pathname.startsWith('/api/') || ['/healthz', '/readyz'].includes(pathname);
      const isAsset = pathname.startsWith('/assets/') || path.posix.extname(pathname) !== '';
      if (req.method === 'GET' && !isApi && !isAsset && req.headers.accept?.includes('text/html')) {
        return reply.type('text/html').header('Cache-Control', 'no-cache').send(indexHtml);
      }
      return reply.code(404).send({ error: 'Not found' });
    });
  }
  return app;
}
