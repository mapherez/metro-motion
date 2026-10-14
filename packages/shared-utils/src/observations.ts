import { destinos, lineNames, lineOrder } from "@metro/station-data";
import type { LineName } from "@metro/shared-types";

export type MetroRow = {
  stop_id: string;
  cais?: string;
  hora: string;
  destino?: string;
  comboio?: string;
  tempoChegada1?: string;
  comboio2?: string;
  tempoChegada2?: string;
  comboio3?: string;
  tempoChegada3?: string;
  sairServico?: string | number;
  UT?: string | number;
};
export type MetroData = { resposta: MetroRow[]; codigo?: string | number };
export type Observation = {
  trainId: string;
  line: LineName;
  stationId: string;
  platform: string;
  observedAt: number;
  arrivalAt: number;
  etaSeconds: number;
  destinationId?: string;
  destination: string;
  direction?: -1 | 1;
  leavingService: boolean;
  unit?: string | number;
};
const suffixLines: Record<string, LineName> = {
  A: "azul",
  B: "amarela",
  C: "verde",
  D: "vermelha",
};
const lisbon = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsAt(ms: number) {
  const parts = Object.fromEntries(
    lisbon
      .formatToParts(ms)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}
/** Parse a Lisbon wall clock without relying on the host time zone. Reject DST gaps. */
export function parseMetroTime(
  hora: string,
  receivedAt?: number,
): number | null {
  if (!/^\d{14}$/.test(hora)) return null;
  const [y, m, d, h, min, s] = [
    hora.slice(0, 4),
    hora.slice(4, 6),
    hora.slice(6, 8),
    hora.slice(8, 10),
    hora.slice(10, 12),
    hora.slice(12, 14),
  ].map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min, s);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    min > 59 ||
    s > 59
  )
    return null;
  const candidates = [wall, wall - 3600000]
    .filter((t) => partsAt(t) === wall)
    .map((t) => t / 1000);
  if (!candidates.length) return null;
  // The repeated autumn hour is inherently ambiguous. Choose the closest
  // non-future occurrence, preserving the ambiguity as an estimate.
  return receivedAt === undefined
    ? candidates[0]
    : (candidates
        .filter((t) => t <= receivedAt + 5)
        .sort(
          (a, b) => Math.abs(a - receivedAt) - Math.abs(b - receivedAt),
        )[0] ?? null);
}

export function formatMetroTime(at: number): string {
  const p = Object.fromEntries(
    lisbon
      .formatToParts(at * 1000)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

export function parseEta(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const eta = Number(value);
  return Number.isSafeInteger(eta) && eta <= 86400 ? eta : null;
}

export function observations(
  data: MetroData,
  now: number,
  destinationNames?: Record<string, string>,
): Observation[] {
  const result: Observation[] = [];
  for (const row of data.resposta) {
    const observedAt = parseMetroTime(row.hora, now);
    if (observedAt === null || observedAt > now + 5 || now - observedAt >= 30)
      continue;
    for (const [id, etaString] of [
      [row.comboio, row.tempoChegada1],
      [row.comboio2, row.tempoChegada2],
      [row.comboio3, row.tempoChegada3],
    ]) {
      const eta = parseEta(etaString);
      const trainId = id?.trim();
      if (!trainId || eta === null) continue;
      const hinted = suffixLines[trainId.slice(-1).toUpperCase()];
      const meta = row.destino ? destinos[row.destino] : undefined;
      // Destination IDs represent stations, not unique lines. Intermediate
      // destinations are resolved by name against the line's actual topology.
      const possible = lineNames.filter((l) =>
        lineOrder[l].includes(row.stop_id),
      );
      const line =
        hinted && possible.includes(hinted)
          ? hinted
          : possible.length === 1
            ? possible[0]
            : meta?.line && possible.includes(meta.line)
              ? meta.line
              : undefined;
      if (!line) continue;
      const order = lineOrder[line];
      let terminal = meta?.terminal;
      if (!terminal || !order.includes(terminal))
        terminal = destinationStation(row.destino, destinationNames);
      const stationIndex = order.indexOf(row.stop_id);
      const destinationIndex = terminal ? order.indexOf(terminal) : -1;
      const direction: -1 | 1 | undefined =
        destinationIndex < 0
          ? undefined
          : destinationIndex === stationIndex
            ? stationIndex === 0
              ? -1
              : stationIndex === order.length - 1
                ? 1
                : undefined
            : destinationIndex > stationIndex
              ? 1
              : -1;
      result.push({
        trainId,
        line,
        stationId: row.stop_id,
        platform: row.cais ?? `${line}:${row.stop_id}:${row.destino ?? ""}`,
        observedAt,
        arrivalAt: observedAt + eta,
        etaSeconds: eta,
        destinationId: row.destino,
        destination:
          (row.destino && destinationNames?.[row.destino]) || meta?.name || "",
        direction,
        leavingService: String(row.sairServico) === "1",
        unit: row.UT,
      });
    }
  }
  for (const observation of result) {
    if (observation.direction !== undefined) continue;
    const directions = new Set(
      result
        .filter(
          (other) =>
            other.trainId === observation.trainId &&
            other.line === observation.line &&
            other.destinationId === observation.destinationId &&
            other.direction !== undefined,
        )
        .map((other) => other.direction),
    );
    if (directions.size === 1) observation.direction = [...directions][0];
  }
  return result;
}

import { stationById } from "@metro/station-data/stations";
function destinationStation(id?: string, names?: Record<string, string>) {
  const name = id && (names?.[id] || destinos[id]?.name);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-/]/g, " ")
      .toLowerCase();
  return name
    ? Object.values(stationById).find(
        (s) => normalize(s.name) === normalize(name),
      )?.id
    : undefined;
}
