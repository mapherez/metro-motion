import { readFile } from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { TrainTracker, type MetroData } from '@metro/shared-utils';
import { Snapshot as SnapshotSchema, StationMetadata as MetadataSchema } from '@metro/shared-types';
import type { Snapshot, StationMetadata } from '@metro/shared-types';
import { lineNames, destinos } from '@metro/station-data';
import { stationMetadata } from '@metro/station-data/metadata';
import type { Config } from './config.js';
import type { RedisClient } from './redis.js';
import { computeServiceStatus } from './service-hours.js';
import { fetchMetro, MetroResponse } from './metro-api.js';
import { replayAt, validateReplay, type Replay } from './replay.js';

type Dependencies = {
  now?: () => Date;
  fetchData?: (signal: AbortSignal) => Promise<unknown>;
  fetchEndpoint?: (endpoint: string, signal: AbortSignal) => Promise<unknown>;
};
const lineLabels = { verde: 'Verde', azul: 'Azul', amarela: 'Amarela', vermelha: 'Vermelha' };
const statusSuffix = { verde: 'vd', azul: 'az', amarela: 'am', vermelha: 'vm' };

export class Ingestor {
  private timer?: NodeJS.Timeout;
  private controllers = new Set<AbortController>();
  private pending?: Promise<void>;
  private stopped = true;
  private backoffMs = 0;
  private tracker: TrainTracker;
  private lastSnapshot?: Snapshot;
  private replay?: Replay;
  private replayStart?: number;
  private emptyCount = 0;
  private fallback = false;
  private nextGlobalCheck = 0;
  private nextMetadata = 0;
  private nextStatus = 0;
  private metadata: StationMetadata[] = stationMetadata;
  private destinationNames = Object.fromEntries(Object.entries(destinos).flatMap(([id,d]) => d ? [[id,d.name]] : []));
  private statuses: Partial<Snapshot['lines']> = {};
  constructor(private config: Config, private redis: RedisClient, private log: FastifyBaseLogger, private deps: Dependencies = {}) {
    this.tracker = new TrainTracker(config.dwellSeconds);
  }
  private now() { return (this.deps.now?.() ?? new Date()).getTime() / 1000; }
  async start() {
    if (!this.stopped) return;
    if (this.config.mock) this.replay = validateReplay(JSON.parse(await readFile(this.config.mockFile, 'utf8')));
    this.stopped = false; this.pending = this.loop();
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    for (const controller of this.controllers) controller.abort();
    await this.pending;
  }
  private async loop() {
    const next = await this.pollOnce();
    if (!this.stopped) this.timer = setTimeout(() => { this.pending = this.loop(); }, next);
  }
  private async publish(snapshot: Snapshot) {
    const payload = JSON.stringify(snapshot);
    await this.redis.set(this.config.redis.snapshotKey, payload, 'EX', this.config.redis.ttlSeconds);
    await this.redis.publish(this.config.redis.channel, payload);
  }
  private async request(endpoint: string) {
    const controller = new AbortController(); this.controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      if (this.deps.fetchEndpoint) return await this.deps.fetchEndpoint(endpoint, controller.signal);
      if (this.deps.fetchData && endpoint === 'tempoEspera/Estacao/todos') return await this.deps.fetchData(controller.signal);
      return await fetchMetro(this.config, endpoint, controller.signal);
    } finally { clearTimeout(timeout); this.controllers.delete(controller); }
  }
  private async ancillary(now: number) {
    if (this.config.mock || (this.deps.fetchData && !this.deps.fetchEndpoint)) return;
    const tasks: Promise<void>[] = [];
    if (now >= this.nextMetadata) {
      this.nextMetadata = now + 86400;
      tasks.push((async () => {
        try {
          const raw = z.object({ resposta: z.array(z.object({ stop_id: z.string(), stop_name: z.string(), stop_lat: z.string(), stop_lon: z.string(), stop_url: z.string() })) }).parse(await this.request('infoEstacao/todos'));
          const records = new Map(raw.resposta.map(s => [s.stop_id,s]));
          this.metadata = this.metadata.map(station => {
            const s = records.get(station.id); if (!s) return station;
            const urls = s.stop_url.replace(/^\[|\]$/g,'').split(',').map(u => u.trim()).filter(u => /^https:\/\/([\w-]+\.)*metrolisboa\.pt\//.test(u));
            const parsed = MetadataSchema.safeParse({ ...station, name: s.stop_name, lat: Number(s.stop_lat), lon: Number(s.stop_lon), urls });
            return parsed.success ? parsed.data : station;
          });
        } catch { this.nextMetadata = Math.min(this.nextMetadata,now+300); this.log.warn('Station metadata unavailable; using last valid catalog'); }
      })(),(async () => {
        try {
          const raw = z.object({ resposta: z.array(z.object({ id_destino: z.string(), nome_destino: z.string() })) }).parse(await this.request('infoDestinos/todos'));
          for (const d of raw.resposta) this.destinationNames[d.id_destino] = d.nome_destino;
        } catch { this.nextMetadata = Math.min(this.nextMetadata,now+300); this.log.warn('Destination metadata unavailable; using last valid catalog'); }
      })());
    }
    if (now >= this.nextStatus) {
      this.nextStatus = now + 60;
      tasks.push((async () => {
        try {
          const { resposta } = z.object({ resposta: z.record(z.string()) }).parse(await this.request('estadoLinha/todos'));
          for (const line of lineNames) this.statuses[line] = { ...this.lastSnapshot?.lines[line], status: {
            message: resposta[line]?.trim() === 'Ok' ? 'Circulação normal' : resposta[line]?.trim() || 'Estado indisponível',
            summary: resposta[`${line}_curta`] || 'unknown', type: resposta[`tipo_msg_${statusSuffix[line]}`] || '', observedAt: now
          }} as Snapshot['lines'][typeof line];
        } catch { this.log.warn('Operator status unavailable; retaining original status timestamp'); }
      })());
    }
    await Promise.all(tasks);
  }
  private async arrivals(now: number): Promise<{ data: MetroData; source: Snapshot['source'] }> {
    if (this.config.mock) {
      if (!this.replay) this.replay = validateReplay(JSON.parse(await readFile(this.config.mockFile,'utf8')));
      this.replayStart ??= now;
      return { data: replayAt(this.replay,this.replayStart,now), source: 'mock' };
    }
    if (!this.fallback || now >= this.nextGlobalCheck) {
      const data = MetroResponse.parse(await this.request('tempoEspera/Estacao/todos'));
      if (data.resposta.length) { this.emptyCount = 0; this.fallback = false; return { data, source: 'global' }; }
      this.emptyCount++;
      if (this.emptyCount < 2) return { data, source: 'global' };
      this.fallback = true; this.nextGlobalCheck = now + 60;
    }
    const responses = await Promise.allSettled(lineNames.map(line => this.request(`tempoEspera/Linha/${lineLabels[line]}`).then(data => MetroResponse.parse(data))));
    const successful = responses.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
    if (!successful.length) throw new Error('All line endpoints unavailable');
    return { data: { resposta: successful.flatMap(d => d.resposta) }, source: 'lines' };
  }
  async pollOnce(): Promise<number> {
    const now = this.now();
    const status = computeServiceStatus(new Date(now * 1000));
    if (!this.config.mock && !status.open) {
      this.tracker.reset(); this.emptyCount = 0; this.fallback = false;
      this.lastSnapshot = this.tracker.update({ resposta: [] }, now, { serviceOpen: false, metadata: this.metadata, statuses: this.statuses });
      try { await this.publish(this.lastSnapshot); } catch { this.log.warn('Unable to refresh closed-service state; retrying'); }
      this.backoffMs = 0;
      return Math.max(100,Math.min(status.msUntilOpen,this.config.redis.ttlSeconds * 500));
    }
    try {
      const [arrivals] = await Promise.all([this.arrivals(now),this.ancillary(now)]);
      this.lastSnapshot = SnapshotSchema.parse(this.tracker.update(arrivals.data,this.now(),{ metadata: this.metadata,
        destinationNames: this.destinationNames, statuses: this.statuses, source: arrivals.source }));
      await this.publish(this.lastSnapshot); this.backoffMs = 0;
    } catch (error) {
      const code = (error as { status?: number }).status;
      const initial = code === 429 || (code && code >= 500) ? 6000 : 4000;
      this.backoffMs = this.backoffMs ? Math.min(this.backoffMs*2,30000) : initial;
      this.log.warn({ status: code, backoffMs: this.backoffMs },'Ingest failed; retaining original observation timestamps');
      if (this.lastSnapshot) {
        this.lastSnapshot = { ...this.lastSnapshot, serviceOpen: true };
        try { await this.publish(this.lastSnapshot); } catch { /* Redis reconnects automatically. */ }
      }
    }
    return Math.max(100,this.config.pollIntervalMs+this.backoffMs+Math.floor(Math.random()*200)-100);
  }
}
