import { z } from "zod";

export const LineNameEnum = z.enum(["verde", "azul", "amarela", "vermelha"]);
export const MotionPhase = z.enum([
  "approaching",
  "dwelling",
  "departing",
  "running",
  "stale",
]);
export const MotionSegment = z
  .object({
    startAt: z.number().finite(),
    endAt: z.number().finite(),
    from: z.number().finite(),
    to: z.number().finite(),
    v0: z.number().finite(),
    v1: z.number().finite(),
    phase: MotionPhase,
  })
  .refine((s) => s.endAt > s.startAt, "Motion duration must be positive");
export const Train = z.object({
  id: z.string(),
  journeyId: z.string(),
  line: LineNameEnum,
  direction: z.union([z.literal(-1), z.literal(1)]),
  from: z.string(),
  to: z.string(),
  etaNext: z.number().nonnegative(),
  arrivalAt: z.number(),
  progress01: z.number().min(0).max(1),
  dest: z.string(),
  destinationId: z.string().optional(),
  observedAt: z.number(),
  validUntil: z.number(),
  phase: MotionPhase,
  confidence: z.enum(["estimated", "confirmed"]),
  segments: z.array(MotionSegment).min(1),
  appearedAt: z.number(),
  retiringAt: z.number().optional(),
});
export const StationArrival = z.object({
  trainId: z.string(),
  etaSeconds: z.number().int().nonnegative(),
  destinoId: z.string().optional(),
  destination: z.string().optional(),
  platform: z.string().optional(),
  direction: z.union([z.literal(-1), z.literal(1)]).optional(),
  observedAt: z.number().optional(),
  arrivalAt: z.number().optional(),
  leavingService: z.boolean().optional(),
  unit: z.union([z.string(), z.number()]).optional(),
});
export const StationEta = z.object({
  stationId: z.string(),
  arrivals: z.array(StationArrival),
});
export const OperatorStatus = z.object({
  message: z.string(),
  summary: z.string(),
  type: z.string(),
  observedAt: z.number().nullable(),
});
export const StationMetadata = z.object({
  id: z.string(),
  name: z.string(),
  lines: z.array(LineNameEnum),
  lat: z.number().finite().min(-90).max(90).optional(),
  lon: z.number().finite().min(-180).max(180).optional(),
  urls: z.array(z.string().url()),
  hours: z.object({
    opens: z.string(),
    closes: z.string(),
    source: z.string().url(),
    verifiedAt: z.string(),
    secondaryEntrances: z.array(
      z.object({ name: z.string(), opens: z.string(), closes: z.string() }),
    ),
  }),
});
export const Line = z.object({
  trains: z.array(Train),
  stations: z.array(StationEta),
  status: OperatorStatus,
  dataObservedAt: z.number().nullable(),
});
export const Snapshot = z.object({
  schemaVersion: z.literal(2),
  t: z.number(),
  receivedAt: z.number(),
  serviceOpen: z.boolean(),
  lines: z.object({ verde: Line, azul: Line, amarela: Line, vermelha: Line }),
  metadata: z.array(StationMetadata),
  source: z.enum(["global", "lines", "mock"]),
});
export const StationEtaSnapshot = z.object({
  t: z.number(),
  lines: z.object({
    verde: z.object({ stations: z.array(StationEta) }),
    azul: z.object({ stations: z.array(StationEta) }),
    amarela: z.object({ stations: z.array(StationEta) }),
    vermelha: z.object({ stations: z.array(StationEta) }),
  }),
});
export type Snapshot = z.infer<typeof Snapshot>;
export type Train = z.infer<typeof Train>;
export type Line = z.infer<typeof Line>;
export type LineName = z.infer<typeof LineNameEnum>;
export type StationEtaSnapshot = z.infer<typeof StationEtaSnapshot>;
export type StationEta = z.infer<typeof StationEta>;
export type StationArrival = z.infer<typeof StationArrival>;
export type StationMetadata = z.infer<typeof StationMetadata>;
export type MotionSegment = z.infer<typeof MotionSegment>;
export type MotionPhase = z.infer<typeof MotionPhase>;
