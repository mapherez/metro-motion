import { config } from './config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRedis } from './redis';
import type { TempoEsperaResponse } from '@metro/shared-utils';
import { normalizeTempoEspera, toSnapshot } from '@metro/shared-utils';
import { Snapshot as SnapshotSchema } from '@metro/shared-types';
import type { Snapshot } from '@metro/shared-types';

const METRO_ENDPOINT = 'tempoEspera/Estacao/todos';

export class Ingestor {
  private timer?: NodeJS.Timeout;
  private backoffMs = 0;
  private redis = createRedis();
  private prevState = new Map<string, { to: string; segmentStartEta: number; t: number }>();
  private lastSnapshot?: Snapshot;
  private lastPublishAt = 0;

  async start() {
    try {
      if (config.metroApi.caFile) {
        console.log(`[ingestor] ignoring METRO_CA_FILE, use NODE_EXTRA_CA_CERTS instead`);
      }
      // if (config.metroApi.caFile) {
      //   // Prefer a programmatic TLS CA injection via Undici to avoid
      //   // NODE_EXTRA_CA_CERTS being read only at process start.
      //   try {
      //     const __filename = fileURLToPath(import.meta.url);
      //     const __dirnameLocal = path.dirname(__filename);
      //     const repoRoot = path.resolve(__dirnameLocal, '../../..');

      //     const caPathRaw = config.metroApi.caFile;
      //     const candidates = new Set<string>();
      //     // As-is (absolute or relative to CWD)
      //     candidates.add(path.isAbsolute(caPathRaw) ? caPathRaw : path.resolve(process.cwd(), caPathRaw));
      //     // Relative to backend package root (apps/backend)
      //     candidates.add(path.resolve(__dirnameLocal, '..', caPathRaw));
      //     // Relative to repo root + apps/backend
      //     candidates.add(path.resolve(repoRoot, 'apps/backend', caPathRaw));

      //     let caPem: string | undefined;
      //     for (const p of candidates) {
      //       try {
      //         const buf = await readFile(p, 'utf8');
      //         if (buf.includes('BEGIN CERTIFICATE')) {
      //           caPem = buf;
      //           // eslint-disable-next-line no-console
      //           console.log(`[ingestor] Using CA bundle at: ${p}`);
      //           break;
      //         }
      //       } catch {}
      //     }

      //     if (caPem) {
      //       // Lazy import to avoid adding a hard dependency for environments without fetch
      //       const undici = await import('undici');
      //       // Use a custom connector so we can supply TLS CA programmatically
      //       const buildConnector: any = (undici as any).buildConnector;
      //       const AgentCtor: any = (undici as any).Agent;
      //       const setGlobalDispatcher: any = (undici as any).setGlobalDispatcher;
      //       const connector = buildConnector({ tls: { ca: caPem } });
      //       const agent = new AgentCtor({ connect: connector });
      //       setGlobalDispatcher(agent);
      //     } else {
      //       // Fallback to env var for environments where that still works
      //       process.env.NODE_EXTRA_CA_CERTS = config.metroApi.caFile;
      //       // eslint-disable-next-line no-console
      //       console.warn('[ingestor] CA file not found via candidates; falling back to NODE_EXTRA_CA_CERTS.');
      //     }
      //   } catch (e) {
      //     // eslint-disable-next-line no-console
      //     console.warn('[ingestor] Failed to configure custom CA bundle:', e);
      //   }
      // }
      if ('connect' in this.redis && typeof (this.redis as any).connect === 'function') {
        await (this.redis as any).connect();
      }
    } catch (e) {
      // continue; most likely a noop client
    }
    this.tick();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(nextMs: number) {
    this.timer = setTimeout(() => this.tick(), nextMs);
  }

  private async fetchTempoEspera(): Promise<TempoEsperaResponse | null> {
    // Optional local mock mode for offline/dev troubleshooting
    if (process.env.METRO_MOCK === '1') {
      const __filename = fileURLToPath(import.meta.url);
      const __dirnameLocal = path.dirname(__filename);
      const repoRoot = path.resolve(__dirnameLocal, '../../..');
      const mockCandidates = [
        // repo root
        path.join(repoRoot, '_examples/tempoEspera_Estacao_todos.json'),
        path.join(repoRoot, 'tools/assets/tempoEspera_Estacao_todos.json'),
        // cwd fallbacks (just in case)
        path.resolve(process.cwd(), '_examples/tempoEspera_Estacao_todos.json'),
        path.resolve(process.cwd(), 'tools/assets/tempoEspera_Estacao_todos.json')
      ];
      for (const p of mockCandidates) {
        try {
          const raw = await readFile(p, 'utf8');
          const json = JSON.parse(raw) as TempoEsperaResponse;
          // eslint-disable-next-line no-console
          console.log(`[ingestor] using mock data from ${p}`);
          return json;
        } catch {}
      }
      // eslint-disable-next-line no-console
      console.warn('[ingestor] METRO_MOCK=1 set but no mock file found.');
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    try {
      const base = config.metroApi.base.endsWith('/')
        ? config.metroApi.base
        : config.metroApi.base + '/';
      const url = new URL(METRO_ENDPOINT, base).toString();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (config.metroApi.key) {
        headers['Authorization'] = `Bearer ${config.metroApi.key}`;
      }
      if (process.env.METRO_TLS_INSECURE === '1') {
        // eslint-disable-next-line no-console
        console.warn('[ingestor] METRO_TLS_INSECURE=1 – TLS cert verification is DISABLED (dev only)');
        // Disable TLS verification process-wide (dev only). Do NOT use in production.
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      }
      const res = await fetch(url, { headers, signal: controller.signal });
      // Debug: basic request info
      // eslint-disable-next-line no-console
      console.log(`[ingestor] GET ${url} -> ${res.status}`);
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`) as any;
        err.status = res.status;
        throw err;
      }
      const json = (await res.json()) as TempoEsperaResponse;
      return json;
    } catch (e: any) {
      // Re-throw with cause info so outer handler logs details
      // eslint-disable-next-line no-console
      console.error('[ingestor] fetch error cause:', e?.cause || e);
      throw e;
    } finally {
      clearTimeout(id);
    }
  }

  private async tick() {
    const interval = config.pollIntervalMs;
    try {
      const data = await this.fetchTempoEspera();
      if (data) {
        let snapshot: any;
        // Accept either the raw Metro model or a pre-normalized Snapshot model
        if (typeof (data as any).t === 'number' && typeof (data as any).lines === 'object') {
          const parsed = SnapshotSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error('Upstream provided invalid Snapshot shape');
          }
          snapshot = parsed.data;
        } else {
          const trains = normalizeTempoEspera(data, this.prevState, config.dwellSeconds);
          snapshot = toSnapshot(trains);
        }
        // Debug: counts (derive from snapshot to support both branches)
        const trainsCount = Object.values(snapshot.lines || {}).reduce(
          (acc: number, line: any) => acc + ((line && line.trains && line.trains.length) || 0),
          0
        );
        // eslint-disable-next-line no-console
        console.log(`[ingestor] trains=${trainsCount} t=${snapshot.t}`);
        // Write to Redis (if configured)
        if (config.redis.url) {
          await (this.redis as any).set(
            config.redis.snapshotKey,
            JSON.stringify(snapshot),
            'EX',
            config.redis.ttlSeconds
          );
          await (this.redis as any).publish(config.redis.channel, JSON.stringify(snapshot));
          // eslint-disable-next-line no-console
          console.log(`[ingestor] snapshot stored and published -> ${config.redis.channel}`);
        }
        this.lastSnapshot = snapshot;
        this.lastPublishAt = Date.now();
        this.backoffMs = 0;
      }
    } catch (err: any) {
      // apply backoff on error (more conservative for 429/5xx)
      const status = err?.status as number | undefined;
      const base = status === 429 || (status && status >= 500) ? 6000 : 4000;
      this.backoffMs = this.backoffMs ? Math.min(this.backoffMs * 2, 30000) : base;
      // eslint-disable-next-line no-console
      console.error(`[ingestor] error: ${err?.message || err} (status=${status ?? 'n/a'}) backoff=${this.backoffMs}ms`);

      // Re-emit last snapshot so clients can infer staleness by snapshot.t
      if (this.lastSnapshot && config.redis.url) {
        try {
          await (this.redis as any).set(
            config.redis.snapshotKey,
            JSON.stringify(this.lastSnapshot),
            'EX',
            config.redis.ttlSeconds
          );
          await (this.redis as any).publish(config.redis.channel, JSON.stringify(this.lastSnapshot));
          this.lastPublishAt = Date.now();
          // eslint-disable-next-line no-console
          console.log('[ingestor] re-published last snapshot (stale)');
        } catch {}
      }
    } finally {
      const jitter = Math.floor(Math.random() * 200) - 100; // ±100ms
      this.schedule(Math.max(200, interval + this.backoffMs + jitter));
    }
  }
}
