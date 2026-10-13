import { readFile } from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { buildStationEtaSnapshot, normalizeTempoEspera, toSnapshot } from '@metro/shared-utils';
import { Snapshot as SnapshotSchema, StationEtaSnapshot as StationEtaSchema } from '@metro/shared-types';
import type { Snapshot, StationEtaSnapshot } from '@metro/shared-types';
import type { Config } from './config.js';
import type { RedisClient } from './redis.js';
import { computeServiceStatus } from './service-hours.js';

const MetroResponse = z.object({
  resposta: z.array(z.object({
    stop_id: z.string(), hora: z.string(), destino: z.string().optional(),
    comboio: z.string().optional(), tempoChegada1: z.string().optional(),
    comboio2: z.string().optional(), tempoChegada2: z.string().optional(),
    comboio3: z.string().optional(), tempoChegada3: z.string().optional()
  }))
});

type Dependencies = { now?: () => Date; fetchData?: (signal: AbortSignal) => Promise<unknown> };

export class Ingestor {
  private timer?: NodeJS.Timeout;
  private controller?: AbortController;
  private pending?: Promise<void>;
  private stopped = true;
  private backoffMs = 0;
  private prevState = new Map<string, { to: string; segmentStartEta: number; t: number; lastEta: number }>();
  private stationStates = new Map<string, { lastHora: string }>();
  private lastSnapshot?: Snapshot;
  private lastStationEtas?: StationEtaSnapshot;
  private mockData?: unknown;

  constructor(private config: Config, private redis: RedisClient, private log: FastifyBaseLogger, private deps: Dependencies = {}) {}

  async start() {
    if (!this.stopped) return;
    if (this.config.mock) {
      // Fail before listening; a broken mock must never fall back to the real API.
      this.mockData = MetroResponse.parse(JSON.parse(await readFile(this.config.mockFile, 'utf8')));
    }
    this.stopped = false;
    this.pending = this.loop();
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.controller?.abort();
    await this.pending;
  }

  private async loop() {
    const nextMs = await this.pollOnce();
    if (!this.stopped) {
      this.timer = setTimeout(() => { this.pending = this.loop(); }, nextMs);
    }
  }

  private async publish(snapshot: Snapshot, stationEtas?: StationEtaSnapshot) {
    if (stationEtas) await this.redis.set(this.config.redis.stationEtaKey, JSON.stringify(stationEtas), 'EX', this.config.redis.ttlSeconds);
    const payload = JSON.stringify(snapshot);
    await this.redis.set(this.config.redis.snapshotKey, payload, 'EX', this.config.redis.ttlSeconds);
    await this.redis.publish(this.config.redis.channel, payload);
  }

  private async fetchData(): Promise<unknown> {
    if (this.config.mock) {
      if (this.mockData === undefined) this.mockData = MetroResponse.parse(JSON.parse(await readFile(this.config.mockFile, 'utf8')));
      return this.mockData;
    }
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 3000);
    try {
      if (this.deps.fetchData) return await this.deps.fetchData(this.controller.signal);
      const base = this.config.metroApi.base.replace(/\/?$/, '/');
      const response = await fetch(new URL('tempoEspera/Estacao/todos', base), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.config.metroApi.key}` },
        signal: this.controller.signal
      });
      if (!response.ok) throw Object.assign(new Error(`Metro API HTTP ${response.status}`), { status: response.status });
      return await response.json();
    } finally {
      clearTimeout(timeout);
      this.controller = undefined;
    }
  }

  async pollOnce(): Promise<number> {
    const status = computeServiceStatus(this.deps.now?.() || new Date());
    if (!this.config.mock && !status.open) {
      this.prevState.clear();
      this.stationStates.clear();
      this.lastSnapshot = toSnapshot([], { serviceOpen: false });
      this.lastStationEtas = buildStationEtaSnapshot({ resposta: [] });
      try { await this.publish(this.lastSnapshot, this.lastStationEtas); }
      catch { this.log.warn('Unable to refresh closed-service state; retrying'); }
      this.backoffMs = 0;
      return Math.max(100, Math.min(status.msUntilOpen, this.config.redis.ttlSeconds * 500));
    }
    try {
      const data = await this.fetchData();
      const normalized = SnapshotSchema.safeParse(data);
      let snapshot: Snapshot;
      let stationEtas: StationEtaSnapshot | undefined;
      if (normalized.success) {
        snapshot = { ...normalized.data, serviceOpen: true };
      } else {
        const raw = MetroResponse.parse(data);
        const trains = normalizeTempoEspera(raw, this.prevState, this.stationStates, this.config.dwellSeconds);
        snapshot = SnapshotSchema.parse(toSnapshot(trains));
        stationEtas = StationEtaSchema.parse(buildStationEtaSnapshot(raw));
      }
      // Commit the last-good pair only after both representations validate.
      this.lastSnapshot = snapshot;
      this.lastStationEtas = stationEtas;
      await this.publish(this.lastSnapshot, this.lastStationEtas);
      this.backoffMs = 0;
    } catch (error) {
      const code = (error as { status?: number }).status;
      const initial = code === 429 || (code && code >= 500) ? 6000 : 4000;
      this.backoffMs = this.backoffMs ? Math.min(this.backoffMs * 2, 30000) : initial;
      // Do not log upstream bodies, credentials or configured URLs.
      this.log.warn({ status: code, backoffMs: this.backoffMs }, 'Ingest failed; retaining original data timestamps');
      if (this.lastSnapshot) {
        // The timetable is open even if the first request after opening fails.
        // Retain the old timestamp so the closed-night data is visibly stale.
        this.lastSnapshot = { ...this.lastSnapshot, serviceOpen: true };
        try { await this.publish(this.lastSnapshot, this.lastStationEtas); } catch { /* Redis reconnects automatically. */ }
      }
    }
    const jitter = Math.floor(Math.random() * 200) - 100;
    return Math.max(100, this.config.pollIntervalMs + this.backoffMs + jitter);
  }
}
