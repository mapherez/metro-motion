import { z } from "zod";

export const LineNameEnum = z.enum(["verde", "azul", "amarela", "vermelha"]);

export const Train = z.object({
  id: z.string(), // ex.: "4C"
  line: LineNameEnum,
  from: z.string(),
  to: z.string(),
  etaNext: z.number(),
  progress01: z.number().min(0).max(1),
  dest: z.string()
});

export const Line = z.object({
  trains: z.array(Train)
});

export const Snapshot = z.object({
  t: z.number(), // epoch secs
  lines: z.record(Line),
  serviceOpen: z.boolean().optional()
});

export const StationArrival = z.object({
  trainId: z.string(),
  etaSeconds: z.number().int().nonnegative(),
  destinoId: z.string().optional(),
  destination: z.string().optional()
});

export const StationEta = z.object({
  stationId: z.string(),
  arrivals: z.array(StationArrival)
});

const LineStationEta = z.object({
  stations: z.array(StationEta)
});

export const StationEtaSnapshot = z.object({
  t: z.number(),
  lines: z.object({
    verde: LineStationEta,
    azul: LineStationEta,
    amarela: LineStationEta,
    vermelha: LineStationEta
  })
});

export type Snapshot = z.infer<typeof Snapshot>;
export type Train = z.infer<typeof Train>;
export type Line = z.infer<typeof Line>;
export type LineName = z.infer<typeof LineNameEnum>;
export type StationEtaSnapshot = z.infer<typeof StationEtaSnapshot>;
export type StationEta = z.infer<typeof StationEta>;
export type StationArrival = z.infer<typeof StationArrival>;
