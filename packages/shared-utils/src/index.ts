import type { Snapshot as SnapshotT, Train as TrainT } from "@metro/shared-types";
import { destinos, neighborForDirection, lineNames } from "@metro/station-data";

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

// Build trains by grouping observations per train and selecting the soonest ETA observation as the upcoming stop
export function normalizeTempoEspera(
  data: TempoEsperaResponse,
  prev: Map<string, TrainState>,
  dwellSeconds: number
): InferredTrain[] {
  const perTrain: Map<string, { to: string; eta: number; destId?: string }> = new Map();

  // Guard: API may return { codigo: "500", resposta: "Circulação encerrada" } during closed hours.
  // In that case, treat it as no trains.
  const list: any = (data as any)?.resposta;
  if (!Array.isArray(list)) {
    return [];
  }

  for (const it of list) {
    const triplets: Array<[string | undefined, string | undefined]> = [
      [it.comboio, it.tempoChegada1],
      [it.comboio2, it.tempoChegada2],
      [it.comboio3, it.tempoChegada3]
    ];
    for (const [id, etaStr] of triplets) {
      if (!id || !etaStr) continue;
      const eta = parseInt(etaStr, 10);
      if (!Number.isFinite(eta)) continue;
      const cur = perTrain.get(id);
      if (!cur || eta < cur.eta) {
        perTrain.set(id, { to: it.stop_id, eta, destId: it.destino });
      }
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const trains: InferredTrain[] = [];

  for (const [id, obs] of perTrain.entries()) {
    const destMeta = (obs.destId && destinos[obs.destId]) || undefined;
    // Default to verde if unknown (should be rare if destino present)
    const line = destMeta?.line ?? "verde";
    const destName = destMeta?.name ?? "";
    const terminal = destMeta?.terminal ?? obs.to;

    // Determine neighbor from/to using line order if known
    const { prev: prevStop, next: nextStop } = neighborForDirection(line, obs.to, terminal);
    const to = obs.to;
    const from = prevStop ?? to; // fall back to to when unknown

    // Estimate progress
    const prevState = prev.get(id);
    let segmentStartEta = prevState && prevState.to === to ? prevState.segmentStartEta : obs.eta;
    if (!Number.isFinite(segmentStartEta) || segmentStartEta <= 0) {
      segmentStartEta = obs.eta + dwellSeconds; // crude default
    }
    // progress based on fraction of remaining ETA over starting ETA
    let progress01 = 1 - obs.eta / segmentStartEta;
    if (obs.eta === 0) progress01 = 1;
    if (!Number.isFinite(progress01)) progress01 = 0;
    if (progress01 < 0) progress01 = 0;
    if (progress01 > 1) progress01 = 1;

    // Guard against NaN sneaking into JSON (would become null)
    const safeEta = Number.isFinite(obs.eta) ? obs.eta : 0;
    const safeProg = Number.isFinite(progress01) ? progress01 : 0;
    trains.push({ id, line, from, to, etaNext: safeEta, progress01: safeProg, dest: destName });

    // update prev state for caller convenience
    prev.set(id, { to, segmentStartEta, t: now });
  }

  return trains;
}

export function toSnapshot(trains: InferredTrain[]): SnapshotT {
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
