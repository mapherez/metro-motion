import type { Snapshot as SnapshotT, Train as TrainT } from "@metro/shared-types";
import { destinos, neighborForDirection, lineNames } from "@metro/station-data";
import { lineOrder } from "@metro/station-data";

type TempoEsperaItem = {
  stop_id: string;
  hora: string;
  comboio?: string;
  tempoChegada1?: string;
  comboio2?: string;
  tempoChegada2?: string;
  comboio3?: string;
  tempoChegada3?: string;
  destino?: string; // id
};

export type TempoEsperaResponse = {
  resposta: TempoEsperaItem[];
};

export type TrainState = {
  to: string;
  segmentStartEta: number; // seconds when this segment observed
  t: number; // epoch seconds last seen
};

export type InferredTrain = {
  id: string;
  line: "verde" | "azul" | "amarela" | "vermelha";
  from: string;
  to: string;
  etaNext: number;
  progress01: number;
  dest: string; // human name
};

// Build trains by aggregating per train and inferring direction using nearest two stops
export function normalizeTempoEspera(
  data: TempoEsperaResponse,
  prev: Map<string, TrainState>,
  dwellSeconds: number
): InferredTrain[] {
  const rows: any = (data as any)?.resposta;
  if (!Array.isArray(rows)) return [];

  type Obs = { stop: string; eta: number; destId?: string };
  const perTrain: Map<string, Obs[]> = new Map();

  for (const it of rows) {
    const triplets: Array<[string | undefined, string | undefined]> = [
      [it.comboio, it.tempoChegada1],
      [it.comboio2, it.tempoChegada2],
      [it.comboio3, it.tempoChegada3]
    ];
    for (const [trainId, etaStr] of triplets) {
      if (!trainId || !etaStr) continue;
      const eta = parseInt(etaStr, 10);
      if (!Number.isFinite(eta)) continue;
      const arr = perTrain.get(trainId) || [];
      arr.push({ stop: it.stop_id, eta, destId: it.destino });
      perTrain.set(trainId, arr);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const result: InferredTrain[] = [];

  for (const [trainId, list] of perTrain.entries()) {
    list.sort((a, b) => a.eta - b.eta);
    const min1 = list[0];
    const min2 = list[1];
    const to = min1.stop;
    const etaNext = min1.eta;

    const destId = min1.destId || (min2 && min2.destId) || undefined;
    const destMeta = (destId && destinos[destId]) || undefined;
    const line = (destMeta?.line as InferredTrain['line']) || 'verde';
    const destName = destMeta?.name || '';
    const terminal = destMeta?.terminal || to;

    const order = lineOrder[line];
    const idxTo = order.indexOf(to);
    const idxTerm = order.indexOf(terminal);
    let dirSign = 0;
    if (idxTo >= 0 && idxTerm >= 0) dirSign = Math.sign(idxTerm - idxTo);
    if (dirSign === 0 && min2) {
      const idx2 = order.indexOf(min2.stop);
      if (idx2 >= 0 && idxTo >= 0) dirSign = Math.sign(idx2 - idxTo);
    }
    if (dirSign === 0) dirSign = 1;

    let fromIdx = idxTo - dirSign;
    if (fromIdx < 0 || fromIdx >= order.length) {
      fromIdx = idxTo + dirSign;
      if (fromIdx < 0 || fromIdx >= order.length) fromIdx = idxTo;
    }
    const from = order[fromIdx] || to;

    const prevState = prev.get(trainId);
    let segmentStartEta = prevState && prevState.to === to ? prevState.segmentStartEta : etaNext + dwellSeconds;
    if (!Number.isFinite(segmentStartEta) || segmentStartEta <= 0) segmentStartEta = Math.max(etaNext, 1);

    let progress01 = etaNext === 0 ? 1 : 1 - etaNext / segmentStartEta;
    if (!Number.isFinite(progress01)) progress01 = 0;
    if (progress01 < 0) progress01 = 0;
    if (progress01 > 1) progress01 = 1;

    result.push({ id: trainId, line, from, to, etaNext, progress01, dest: destName });
    prev.set(trainId, { to, segmentStartEta, t: now });
  }

  return result;
}export function toSnapshot(trains: InferredTrain[]): SnapshotT {
  const t = Math.floor(Date.now() / 1000);
  const lines: Record<string, { trains: TrainT[] }> = {};
  for (const name of lineNames) {
    lines[name] = { trains: [] };
  }
  for (const tr of trains) {
    lines[tr.line].trains.push({
      id: tr.id,
      line: tr.line,
      from: tr.from,
      to: tr.to,
      etaNext: tr.etaNext,
      progress01: tr.progress01,
      dest: tr.dest
    } as TrainT);
  }
  return { t, lines } as SnapshotT;
}


