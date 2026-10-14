export * from './motion.js';
export * from './observations.js';
export * from './tracker.js';

import { TrainTracker, emptySnapshot } from './tracker.js';
import { parseMetroTime, type MetroData } from './observations.js';
import type { Snapshot, Train, StationEtaSnapshot } from '@metro/shared-types';
import { lineNames } from '@metro/station-data';

// Compatibility for local fixture tools. Production owns one persistent tracker
// and explicitly injects a clock; a fixture is evaluated at its own timestamp.
export function normalizeTempoEspera(data: MetroData, _prev: Map<string,unknown>, _stationStates: Map<string,unknown>, dwellSeconds: number): Train[] {
  const now = Math.max(0,...data.resposta.map(r => parseMetroTime(r.hora) ?? 0));
  const snapshot = new TrainTracker(dwellSeconds).update(data, now);
  return lineNames.flatMap(line => snapshot.lines[line].trains);
}
export function toSnapshot(trains: Train[], overrides: Partial<Snapshot> = {}): Snapshot {
  const snapshot = emptySnapshot(Date.now()/1000);
  for (const train of trains) snapshot.lines[train.line].trains.push(train);
  return { ...snapshot, ...overrides };
}
export function buildStationEtaSnapshot(data: MetroData): StationEtaSnapshot {
  const now = Math.max(Date.now()/1000 * Number(data.resposta.length === 0),...data.resposta.map(r => parseMetroTime(r.hora) ?? 0));
  const snapshot = new TrainTracker().update(data, now);
  return { t: snapshot.t, lines: Object.fromEntries(lineNames.map(l => [l, { stations: snapshot.lines[l].stations }])) as StationEtaSnapshot['lines'] };
}
