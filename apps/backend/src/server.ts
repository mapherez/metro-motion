import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { Snapshot as SnapshotSchema } from '@metro/shared-types';
import { createRedis } from './redis';

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

  // Placeholder: SSE stream, will be implemented in task 4
  app.get('/stream', async (req, reply) => {
    if (!config.redis.url) {
      return reply.code(503).send({ error: 'SSE unavailable: Redis not configured' });
    }

    // Prepare SSE headers
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
