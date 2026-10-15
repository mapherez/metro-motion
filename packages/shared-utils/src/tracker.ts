import { destinos, lineNames, lineOrder } from "@metro/station-data";
import { stationMetadata } from "@metro/station-data/metadata";
import type {
  LineName,
  Snapshot,
  StationMetadata,
  Train,
} from "@metro/shared-types";
import {
  observations,
  parseMetroTime,
  type MetroData,
  type MetroRow,
  type Observation,
} from "./observations.js";
import {
  planMotion,
  sampleMotion,
  stationary,
  STALE_SECONDS,
} from "./motion.js";

type Pending = { token: string; seenAt: number; count: number };
type DirectedObservation = Observation & { direction: -1 | 1 };
export class TrainTracker {
  private platforms = new Map<string, MetroRow>();
  private trains = new Map<string, Train>();
  private groupVersions = new Map<string, string>();
  private pending = new Map<string, Pending>();
  private durations = new Map<string, number[]>();
  private dwellDurations = new Map<LineName, number[]>();
  private stationSeen = new Map<
    string,
    { station: string; at: number; departedAt?: number }
  >();
  private generation = 0;
  constructor(private dwellSeconds = 25) {}

  reset() {
    this.platforms.clear();
    this.trains.clear();
    this.groupVersions.clear();
    this.pending.clear();
    this.stationSeen.clear();
  }

  private duration(line: LineName, from: string, to: string) {
    const values = this.durations.get(`${line}:${from}:${to}`) ?? [];
    return values.length
      ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
      : 90;
  }
  private learn(key: string, value: number) {
    if (value < 15 || value > 600) return;
    const values = this.durations.get(key) ?? [];
    values.push(value);
    if (values.length > 40) values.shift();
    this.durations.set(key, values);
  }
  private dwell(line: LineName) {
    const values = this.dwellDurations.get(line) ?? [];
    return values.length
      ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
      : this.dwellSeconds;
  }

  update(
    data: MetroData,
    now: number,
    options: {
      metadata?: StationMetadata[];
      destinationNames?: Record<string, string>;
      source?: Snapshot["source"];
      serviceOpen?: boolean;
      statuses?: Partial<Snapshot["lines"]>;
    } = {},
  ): Snapshot {
    for (const row of data.resposta) {
      const time = parseMetroTime(row.hora, now);
      if (time === null || time > now + 5) continue;
      const key = row.cais || `${row.stop_id}:${row.destino ?? ""}`;
      const previous = this.platforms.get(key);
      const previousTime = previous ? parseMetroTime(previous.hora, now) : null;
      if (previousTime === null || time > previousTime)
        this.platforms.set(key, { ...row });
    }
    for (const [key, row] of this.platforms)
      if (now - (parseMetroTime(row.hora, now) ?? 0) > 120)
        this.platforms.delete(key);
    const obs = observations(
      { resposta: [...this.platforms.values()] },
      now,
      options.destinationNames,
    );
    const lines = Object.fromEntries(
      lineNames.map((line) => [
        line,
        {
          trains: [] as Train[],
          stations: lineOrder[line].map((stationId) => ({
            stationId,
            arrivals:
              [] as Snapshot["lines"][LineName]["stations"][number]["arrivals"],
          })),
          status: options.statuses?.[line]?.status ?? {
            message: "Estado do operador indisponível",
            summary: "unknown",
            type: "",
            observedAt: null,
          },
          dataObservedAt: null as number | null,
        },
      ]),
    ) as Snapshot["lines"];
    const grouped = new Map<string, DirectedObservation[]>();
    const arrivalKeys = new Set<string>();
    for (const o of obs) {
      const key = `${o.line}:${o.trainId}`;
      const previous = this.trains.get(key);
      if (
        previous &&
        o.direction === undefined &&
        previous.destinationId === o.destinationId
      )
        o.direction = previous.direction;
      const line = lines[o.line];
      line.dataObservedAt = Math.max(line.dataObservedAt ?? 0, o.observedAt);
      const station = line.stations.find((s) => s.stationId === o.stationId)!;
      const arrivalKey = `${o.line}:${o.stationId}:${o.platform}:${o.trainId}:${o.destinationId}`;
      if (!arrivalKeys.has(arrivalKey)) {
        station.arrivals.push({
          trainId: o.trainId,
          etaSeconds: o.etaSeconds,
          destinoId: o.destinationId,
          destination: o.destination,
          platform: o.platform,
          direction: o.direction,
          observedAt: o.observedAt,
          arrivalAt: o.arrivalAt,
          leavingService: o.leavingService,
          unit: o.unit,
        });
        arrivalKeys.add(arrivalKey);
      }
      if (o.direction !== undefined) {
        const list = grouped.get(key) ?? [];
        list.push(o as DirectedObservation);
        grouped.set(key, list);
      }
    }

    for (const [key, list] of grouped) {
      list.sort(
        (a, b) => a.arrivalAt - b.arrivalAt || b.observedAt - a.observedAt,
      );
      const previous = this.trains.get(key);
      // Each platform has its own source clock. A maximum timestamp hides a
      // later update to the nearest platform when a distant one is already
      // ahead. Deduplicate the complete set of platform versions instead.
      const version = list
        .map(
          (o) =>
            `${o.platform}:${o.stationId}:${o.destinationId}:${o.observedAt}`,
        )
        .sort()
        .join("|");
      if (previous && this.groupVersions.get(key) === version) continue;
      this.groupVersions.set(key, version);
      // An opposite-direction return may already be listed. Stay on the active
      // trip while it still has observations; do not flip to a future departure.
      const active = previous
        ? list.filter(
            (o) =>
              o.direction === previous.direction &&
              o.destinationId === previous.destinationId &&
              // A platform can retain a fresh zero after this train's next
              // segment was confirmed. It must not pull the trip back to a
              // station whose passage has already been established.
              !(
                o.arrivalAt <= now &&
                (lineOrder[o.line].indexOf(o.stationId) -
                  lineOrder[o.line].indexOf(previous.to)) *
                  previous.direction <
                  0
              ),
          )
        : [];
      let candidate = active[0] ?? list[0];
      const route = lineOrder[candidate.line];
      let targetIndex = route.indexOf(candidate.stationId);
      let current = previous ? sampleMotion(previous, now) : undefined;
      if (
        previous &&
        current &&
        (current.position < 0.12 || current.position > route.length - 1.12)
      ) {
        const departure = list.find(
          (o) =>
            o.direction !== previous.direction &&
            o.observedAt > previous.observedAt &&
            o.arrivalAt <= now + 5 &&
            Math.abs(route.indexOf(o.stationId) - current!.position) < 0.15,
        );
        if (departure) {
          candidate = departure;
          targetIndex = route.indexOf(candidate.stationId);
        }
      }
      // Platform clocks can differ by seconds. An old zero on the previous
      // platform must not rewind a train whose passage has been confirmed.
      if (
        previous &&
        active.length &&
        candidate.direction === previous.direction &&
        candidate.observedAt <= previous.observedAt
      ) {
        const ahead = active.filter(
          (o) =>
            (route.indexOf(o.stationId) - (current?.position ?? 0)) *
              previous.direction >=
            -1e-8,
        );
        const passed =
          (targetIndex - current!.position) * previous.direction < -1e-8;
        const atStop =
          Math.abs(targetIndex - current!.position) < 0.015 &&
          candidate.arrivalAt <= now;
        // A new clock several stations away says nothing about passage at
        // the current station. Only advance from a stop to its adjacent stop,
        // or discard a prediction whose station has already been passed.
        const nextStop = atStop
          ? ahead.find(
              (o) =>
                route.indexOf(o.stationId) ===
                  targetIndex + previous.direction &&
                o.observedAt > previous.observedAt,
            )
          : undefined;
        if (nextStop || (passed && ahead.length)) {
          candidate = nextStop ?? ahead[0];
          targetIndex = route.indexOf(candidate.stationId);
        }
      }
      const token = `${candidate.direction}:${candidate.destinationId}:${candidate.stationId}`;
      const changedJourney =
        !!previous &&
        (candidate.direction !== previous.direction ||
          candidate.destinationId !== previous.destinationId);
      if (previous && candidate.direction !== previous.direction) {
        const terminalId =
          (options.metadata ?? stationMetadata).find(
            (station) => station.name === previous.dest,
          )?.id ?? destinos[previous.destinationId ?? ""]?.terminal;
        const terminalIndex = terminalId ? route.indexOf(terminalId) : -1;
        const atTerminal =
          terminalIndex >= 0 &&
          Math.abs(current!.position - terminalIndex) < 0.15;
        const imminent =
          targetIndex === terminalIndex
            ? candidate.arrivalAt <= now + 5
            : targetIndex === terminalIndex + candidate.direction &&
              candidate.arrivalAt - now <=
                this.duration(
                  candidate.line,
                  route[terminalIndex],
                  candidate.stationId,
                );
        // Two updates to a future return are still not evidence that the
        // current journey has reached its terminal and reversed. Keep its
        // last trajectory (and normal staleness limit) until compatible.
        if (!atTerminal || !imminent) continue;
      }
      const farCorrection =
        !!previous &&
        (previous.retiringAt !== undefined ||
          (targetIndex - current!.position) * candidate.direction < -0.015 ||
          Math.abs(targetIndex - current!.position) > 1.15 ||
          now - previous.observedAt >= STALE_SECONDS);
      if (changedJourney || farCorrection) {
        const p = this.pending.get(key);
        const count =
          p?.token === token
            ? p.count + (candidate.observedAt > p.seenAt ? 1 : 0)
            : 1;
        this.pending.set(key, { token, seenAt: candidate.observedAt, count });
        if (previous && previous.retiringAt === undefined)
          this.trains.set(key, { ...previous, retiringAt: now });
        if (count < 2 || now - (previous?.retiringAt ?? now) < 0.8) continue;
        this.trains.delete(key);
        current = undefined;
      } else this.pending.delete(key);

      const old = this.trains.get(key);
      if (old && candidate.observedAt <= old.observedAt) continue;
      const stop = this.stationSeen.get(key);
      if (
        old &&
        stop &&
        stop.departedAt === undefined &&
        candidate.stationId !== stop.station
      ) {
        const elapsed = now - stop.at;
        const index = route.indexOf(stop.station);
        if (
          elapsed >= 1 &&
          elapsed <= 180 &&
          index > 0 &&
          index < route.length - 1
        ) {
          const values = this.dwellDurations.get(candidate.line) ?? [];
          values.push(elapsed);
          if (values.length > 40) values.shift();
          this.dwellDurations.set(candidate.line, values);
        }
        stop.departedAt = now;
      }
      const incoming = route[targetIndex - candidate.direction];
      const from = incoming ?? candidate.stationId;
      // Adjacent future arrival anchors provide useful initial travel priors.
      const trip = list.filter(
        (o) =>
          o.direction === candidate.direction &&
          o.destinationId === candidate.destinationId,
      );
      const unique = [
        ...new Map(trip.map((o) => [o.stationId, o])).values(),
      ].sort(
        (a, b) =>
          route.indexOf(a.stationId) * candidate.direction -
          route.indexOf(b.stationId) * candidate.direction,
      );
      for (let i = 1; i < unique.length; i++) {
        if (
          Math.abs(
            route.indexOf(unique[i].stationId) -
              route.indexOf(unique[i - 1].stationId),
          ) === 1
        )
          this.learn(
            `${candidate.line}:${unique[i - 1].stationId}:${unique[i].stationId}`,
            unique[i].arrivalAt -
              unique[i - 1].arrivalAt -
              this.dwell(candidate.line),
          );
      }
      const remaining = Math.max(0, candidate.arrivalAt - now);
      const estimateDuration = this.duration(
        candidate.line,
        from,
        candidate.stationId,
      );
      const initial = incoming
        ? targetIndex -
          candidate.direction * Math.min(1, remaining / estimateDuration)
        : targetIndex;
      const position = current?.position ?? initial;
      const velocity = current?.velocity ?? 0;
      const segments =
        old &&
        old.etaNext === 0 &&
        remaining === 0 &&
        old.to === candidate.stationId
          ? old.segments
          : planMotion(
              position,
              velocity,
              targetIndex,
              candidate.arrivalAt,
              now,
              candidate.direction,
            );
      if (!segments) {
        if (old && old.retiringAt === undefined)
          this.trains.set(key, { ...old, retiringAt: now });
        continue;
      }
      const phase =
        remaining === 0 && Math.abs(position - targetIndex) < 0.015
          ? "dwelling"
          : Math.abs(velocity) < 0.001
            ? "departing"
            : "running";
      const journeyId =
        old?.journeyId ?? `${key}:${++this.generation}:${Math.floor(now)}`;
      this.trains.set(key, {
        id: candidate.trainId,
        journeyId,
        line: candidate.line,
        direction: candidate.direction,
        from,
        to: candidate.stationId,
        etaNext: remaining,
        arrivalAt: candidate.arrivalAt,
        progress01: Math.max(
          0,
          Math.min(1, 1 - Math.abs(targetIndex - position)),
        ),
        dest: candidate.destination,
        destinationId: candidate.destinationId,
        observedAt: candidate.observedAt,
        validUntil: candidate.observedAt + STALE_SECONDS,
        phase,
        segments,
        appearedAt: old?.appearedAt ?? now,
        confidence: old ? "confirmed" : "estimated",
      });
      if (phase === "dwelling") {
        const seen = this.stationSeen.get(key);
        if (
          seen &&
          seen.station !== candidate.stationId &&
          Math.abs(route.indexOf(seen.station) - targetIndex) === 1
        )
          this.learn(
            `${candidate.line}:${seen.station}:${candidate.stationId}`,
            seen.departedAt !== undefined
              ? now - seen.departedAt
              : now - seen.at - this.dwell(candidate.line),
          );
        if (!seen || seen.station !== candidate.stationId)
          this.stationSeen.set(key, { station: candidate.stationId, at: now });
      }
    }
    for (const [key, train] of this.trains) {
      if (now - train.observedAt > 120) {
        this.trains.delete(key);
        this.pending.delete(key);
        this.groupVersions.delete(key);
        this.stationSeen.delete(key);
        continue;
      }
      const sample = sampleMotion(train, now);
      lines[train.line].trains.push({ ...train, phase: sample.phase });
    }
    for (const line of lineNames)
      for (const station of lines[line].stations)
        station.arrivals.sort(
          (a, b) => (a.arrivalAt ?? 0) - (b.arrivalAt ?? 0),
        );
    const latest = Math.max(
      0,
      ...lineNames.map((l) => lines[l].dataObservedAt ?? 0),
    );
    return {
      schemaVersion: 2,
      t: latest || now,
      receivedAt: now,
      serviceOpen: options.serviceOpen ?? true,
      source: options.source ?? "global",
      lines,
      metadata: options.metadata ?? stationMetadata,
    };
  }
}

export function emptySnapshot(now: number, serviceOpen = true): Snapshot {
  return new TrainTracker().update({ resposta: [] }, now, { serviceOpen });
}
