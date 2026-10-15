import { z } from "zod";
import type { Config } from "./config.js";

// Live predictions are JSON numbers; unavailable predictions can be "--".
// Normalize only at the API boundary, keeping missing/invalid ETAs subject to
// the shared strict ETA parser instead of rejecting every row in the response.
const MetroEta = z.union([z.string(), z.number()]).transform(String).optional();

export const MetroResponse = z
  .object({
    codigo: z.union([z.string(), z.number()]).optional(),
    resposta: z.array(
      z
        .object({
          stop_id: z.string(),
          cais: z.string().optional(),
          hora: z.string(),
          destino: z.string().optional(),
          comboio: z.string().optional(),
          tempoChegada1: MetroEta,
          comboio2: z.string().optional(),
          tempoChegada2: MetroEta,
          comboio3: z.string().optional(),
          tempoChegada3: MetroEta,
          sairServico: z.union([z.string(), z.number()]).optional(),
          UT: z.union([z.string(), z.number()]).optional(),
        })
        .passthrough(),
    ),
  })
  .refine(
    (data) => data.codigo === undefined || String(data.codigo) === "200",
    "Metro returned an unsuccessful response",
  );
export async function fetchMetro(
  config: Config,
  endpoint: string,
  signal: AbortSignal,
): Promise<unknown> {
  const base = config.metroApi.base.replace(/\/?$/, "/");
  const response = await fetch(new URL(endpoint, base), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.metroApi.key}`,
    },
    signal,
  });
  if (!response.ok)
    throw Object.assign(new Error(`Metro API HTTP ${response.status}`), {
      status: response.status,
    });
  return response.json();
}
