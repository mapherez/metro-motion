import { config } from './config.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRedis } from './redis.js';
import type { TempoEsperaResponse } from '@metro/shared-utils';
import { buildStationEtaSnapshot, normalizeTempoEspera, toSnapshot } from '@metro/shared-utils';
import { Snapshot as SnapshotSchema } from '@metro/shared-types';
import type { Snapshot, StationEtaSnapshot } from '@metro/shared-types';

const METRO_ENDPOINT = 'tempoEspera/Estacao/todos';

const LISBON_TIMEZONE = 'Europe/Lisbon';
const SERVICE_OPEN_MINUTES = 6 * 60 + 30; // 06:30
const SERVICE_CLOSE_MINUTES = 1 * 60; // 01:00 cutoff
const LISBON_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

type ServiceStatus = { open: true } | { open: false; msUntilOpen: number };

function getLisbonClock(date = new Date()) {
  const formatted = LISBON_CLOCK_FORMATTER.format(date);
  const [hourStr = '0', minuteStr = '0', secondStr = '0'] = formatted.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);
  return { hour, minute, second };
}

function computeServiceStatus(date = new Date()): ServiceStatus {
  const { hour, minute, second } = getLisbonClock(date);
  const minutes = hour * 60 + minute;
  if (minutes >= SERVICE_OPEN_MINUTES || minutes < SERVICE_CLOSE_MINUTES) {
    return { open: true };
  }
  const secondsNow = minutes * 60 + second;
  const secondsOpen = SERVICE_OPEN_MINUTES * 60;
  const diffMs = Math.max(0, (secondsOpen - secondsNow) * 1000);
  return { open: false, msUntilOpen: diffMs };
}

export class Ingestor {
  private timer?: NodeJS.Timeout;
  private backoffMs = 0;
  private redis = createRedis();
  private prevState = new Map<string, { to: string; segmentStartEta: number; t: number }>();
  private lastSnapshot?: Snapshot;
  private lastStationEtas?: StationEtaSnapshot;
  private lastPublishAt = 0;
  private serviceOpen = true;

  async start() {
    try {
      if (config.metroApi.caFile) {
        console.log(`[ingestor] ignoring METRO_CA_FILE, use NODE_EXTRA_CA_CERTS instead`);
      }
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

  private async publishSnapshot(snapshot: Snapshot, label = 'snapshot stored and published') {
    if (!config.redis.url) {
      return;
    }
    const payload = JSON.stringify(snapshot);
    await (this.redis as any).set(
      config.redis.snapshotKey,
      payload,
      'EX',
      config.redis.ttlSeconds
    );
    await (this.redis as any).publish(config.redis.channel, payload);
    // eslint-disable-next-line no-console
    console.log(`[ingestor] ${label} -> ${config.redis.channel}`);
    this.lastPublishAt = Date.now();
  }

  private async storeStationEtas(snapshot: StationEtaSnapshot) {
    if (!config.redis.url) {
      return;
    }
    await (this.redis as any).set(
      config.redis.stationEtaKey,
      JSON.stringify(snapshot),
      'EX',
      config.redis.ttlSeconds
    );
  }

  private buildClosedSnapshot(): Snapshot {
    return toSnapshot([], { serviceOpen: false });
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
    const serviceStatus = computeServiceStatus();
    if (!serviceStatus.open) {
      if (this.serviceOpen) {
        try {
          const closedSnapshot = this.buildClosedSnapshot();
          await this.publishSnapshot(closedSnapshot, 'service closed snapshot broadcast');
          this.lastSnapshot = closedSnapshot;
          const emptyStationEtas = buildStationEtaSnapshot({ resposta: [] });
          this.lastStationEtas = emptyStationEtas;
          await this.storeStationEtas(emptyStationEtas);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[ingestor] failed to publish closed snapshot:', err);
        }
        // eslint-disable-next-line no-console
        console.log('[ingestor] service closed (01:00-06:30), skipping upstream fetch');
      }
      this.serviceOpen = false;
      this.backoffMs = 0;
      const jitter = Math.floor(Math.random() * 200) - 100;
      const wait = Math.max(200, serviceStatus.msUntilOpen + jitter);
      this.schedule(wait);
      return;
    }

    this.serviceOpen = true;

    try {
      const data = await this.fetchTempoEspera();
      if (data) {
        if (Array.isArray((data as any)?.resposta)) {
          try {
            const stationEtas = buildStationEtaSnapshot(data as TempoEsperaResponse);
            this.lastStationEtas = stationEtas;
            await this.storeStationEtas(stationEtas);
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[ingestor] failed to process station ETAs:', err);
          }
        }
        let snapshot: Snapshot;
        // Accept either the raw Metro model or a pre-normalized Snapshot model
        if (typeof (data as any).t === 'number' && typeof (data as any).lines === 'object') {
          const parsed = SnapshotSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error('Upstream provided invalid Snapshot shape');
          }
          snapshot = { ...parsed.data, serviceOpen: true };
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
        await this.publishSnapshot(snapshot);
        this.lastSnapshot = snapshot;
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
          const stale = { ...this.lastSnapshot, serviceOpen: true };
          await this.publishSnapshot(stale, 're-published last snapshot (stale)');
        } catch {}
      }
      if (this.lastStationEtas && config.redis.url) {
        try {
          const staleStationEtas: StationEtaSnapshot = {
            ...this.lastStationEtas,
            t: Math.floor(Date.now() / 1000)
          };
          this.lastStationEtas = staleStationEtas;
          await this.storeStationEtas(staleStationEtas);
        } catch {}
      }
    } finally {
      const jitter = Math.floor(Math.random() * 200) - 100; // +/-100ms
      this.schedule(Math.max(200, interval + this.backoffMs + jitter));
    }
  }
}
