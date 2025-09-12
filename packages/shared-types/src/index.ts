import { z } from "zod";

export const Train = z.object({
  id: z.string(), // ex.: "4C"
  line: z.enum(["verde", "azul", "amarela", "vermelha"]),
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
  lines: z.record(Line)
});

export type Snapshot = z.infer<typeof Snapshot>;

