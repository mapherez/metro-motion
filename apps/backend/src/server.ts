import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { Snapshot as SnapshotSchema, StationEtaSnapshot as StationEtaSnapshotSchema, LineNameEnum } from '@metro/shared-types';
import { createRedis } from './redis.js';

export function buildServer() {
  const app = Fastify({ logger: true });
  const redis = createRedis();

  // CORS
  app.register(cors, {
    origin: config.corsOrigin
  });

  // Routes
  app.get('/healthz', async () => ({ ok: true }));

  // Placeholder: will read from Redis in task 3
  app.get('/now', async (_req, reply) => {
    try {
      if (!config.redis.url) {
        return reply.code(204).send();
      }
      const raw = await (redis as any).get(config.redis.snapshotKey);
      if (!raw) {
        return reply.code(204).send();
      }
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        app.log.error({ err: e }, 'Invalid snapshot JSON in Redis');
        return reply.code(500).send({ error: 'Invalid snapshot JSON' });
      }
      const parsed = SnapshotSchema.safeParse(json);
      if (!parsed.success) {
        app.log.error({ issues: parsed.error.issues }, 'Snapshot validation failed');
        return reply.code(500).send({ error: 'Invalid snapshot schema' });
      }
      return parsed.data;
    } catch (err) {
      app.log.error({ err }, 'Error handling /now');
      return reply.code(500).send({ error: 'Internal error' });
    }
  });

  app.get('/lines/:lineId/etas', async (req, reply) => {
    const params = req.params as { lineId?: string };
    const lineIdRaw = params.lineId?.toLowerCase();
    const parsedLine = LineNameEnum.safeParse(lineIdRaw);
    if (!parsedLine.success) {
      return reply.code(404).send({ error: 'Unknown line' });
    }
    const lineId = parsedLine.data;

    try {
      if (!config.redis.url) {
        return reply.code(204).send();
      }
      const raw = await (redis as any).get(config.redis.stationEtaKey);
      if (!raw) {
        return reply.code(204).send();
      }
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        app.log.error({ err: e }, 'Invalid station ETA JSON in Redis');
        return reply.code(500).send({ error: 'Invalid station ETA JSON' });
      }
      const parsed = StationEtaSnapshotSchema.safeParse(json);
      if (!parsed.success) {
        app.log.error({ issues: parsed.error.issues }, 'Station ETA snapshot validation failed');
        return reply.code(500).send({ error: 'Invalid station ETA schema' });
      }
      const lineData = parsed.data.lines[lineId as keyof typeof parsed.data.lines];
      if (!lineData) {
        return reply.code(204).send();
      }
      return {
        line: lineId,
        t: parsed.data.t,
        stations: lineData.stations
      };
    } catch (err) {
      app.log.error({ err }, 'Error handling /lines/:lineId/etas');
      return reply.code(500).send({ error: 'Internal error' });
    }
  });

  // Placeholder: SSE stream, will be implemented in task 4
  app.get('/stream', async (req, reply) => {
    if (!config.redis.url) {
      return reply.code(503).send({ error: 'SSE unavailable: Redis not configured' });
    }

    // Prepare SSE headers
    reply.raw.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();
    reply.hijack();

    const send = (payload: any) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        app.log.warn({ err: e }, 'SSE write failed');
      }
    };

    // Heartbeat every ~20s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: ping ${Date.now()}\n\n`);
      } catch {}
    }, 20000);

    // Subscribe to Redis channel
    const sub = await (redis as any).duplicate();
    await sub.subscribe(config.redis.channel);
    const onMessage = (_channel: string, message: string) => {
      try {
        const json = JSON.parse(message);
        send(json);
      } catch {
        // send raw if not JSON
        send(message);
      }
    };
    sub.on('message', onMessage);

    // Send last snapshot immediately if present
    try {
      const raw = await (redis as any).get(config.redis.snapshotKey);
      if (raw) {
        try {
          send(JSON.parse(raw));
        } catch {
          send(raw);
        }
      }
    } catch {}

    const close = async () => {
      clearInterval(heartbeat);
      try {
        sub.off('message', onMessage);
        await sub.unsubscribe(config.redis.channel);
        if (typeof sub.quit === 'function') await sub.quit();
      } catch {}
      try {
        reply.raw.end();
      } catch {}
    };

    req.raw.on('close', close);
    req.raw.on('error', close);
  });

  return app;
}
