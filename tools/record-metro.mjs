import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import { observations } from "../packages/shared-utils/dist/index.js";
import { MetroResponse } from "../apps/backend/dist/metro-api.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(
  new URL("../apps/backend/package.json", import.meta.url),
);
export function argumentsFor(args) {
  const options = {
    sessions: 2,
    minutes: 45,
    interval: 2000,
    output: path.join(root, ".test-artifacts/recordings"),
    probe: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--probe") options.probe = true;
    else if (arg === "--output") options.output = path.resolve(args[++i] ?? "");
    else if (["--sessions", "--minutes", "--interval"].includes(arg)) {
      const key = arg.slice(2),
        value = Number(args[++i]);
      if (
        !Number.isFinite(value) ||
        value <= 0 ||
        (key !== "minutes" && !Number.isInteger(value))
      )
        throw new Error(`Invalid ${arg}`);
      options[key] = value;
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.interval < 1000)
    throw new Error("Recording interval must be at least 1000ms");
  return options;
}
export async function record(options) {
  let env = {};
  try {
    env = require("dotenv").parse(
      await readFile(path.join(root, ".env"), "utf8"),
    );
  } catch {}
  const token = process.env.METRO_API_KEY || env.METRO_API_KEY;
  if (!token) throw new Error("METRO_API_KEY is required");
  const base =
    process.env.METRO_API_BASE ||
    env.METRO_API_BASE ||
    "https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1/";
  const parsedBase = new URL(base);
  if (parsedBase.protocol !== "https:")
    throw new Error("METRO_API_BASE must use HTTPS");
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const fetchData = async (endpoint) => {
    const response = await fetch(new URL(endpoint, base.replace(/\/?$/, "/")), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok)
      throw Object.assign(new Error("Metro request failed"), {
        status: response.status,
      });
    const raw = MetroResponse.parse(await response.json());
    // Only data fields are persisted. Never record URLs, headers, environment,
    // HTTP bodies outside the schema, tokens or exception messages.
    const fields = [
      "stop_id",
      "cais",
      "hora",
      "destino",
      "comboio",
      "tempoChegada1",
      "comboio2",
      "tempoChegada2",
      "comboio3",
      "tempoChegada3",
      "sairServico",
      "UT",
    ];
    return {
      resposta: raw.resposta.map((row) =>
        Object.fromEntries(
          fields.filter((f) => row[f] !== undefined).map((f) => [f, row[f]]),
        ),
      ),
    };
  };
  const sample = async () => {
    let data = await fetchData("tempoEspera/Estacao/todos");
    let source = "global";
    if (!data.resposta.length) {
      const lines = await Promise.allSettled(
        ["Verde", "Azul", "Amarela", "Vermelha"].map((l) =>
          fetchData(`tempoEspera/Linha/${l}`),
        ),
      );
      data = {
        resposta: lines.flatMap((r) =>
          r.status === "fulfilled" ? r.value.resposta : [],
        ),
      };
      source = "lines";
    }
    const receivedAt = Date.now() / 1000;
    return {
      receivedAt,
      source,
      data,
      freshObservations: observations(data, receivedAt).length,
    };
  };
  try {
    let first = await sample();
    console.log(
      `API probe: ${first.freshObservations} fresh numeric observations (${first.source}).`,
    );
    if (options.probe) return { freshObservations: first.freshObservations };
    if (!first.freshObservations)
      throw new Error(
        "No fresh numeric observations; normal-service recordings cannot start",
      );
    await mkdir(options.output, { recursive: true });
    for (let session = 1; session <= options.sessions && !stopping; session++) {
      const startedAt = first?.receivedAt ?? Date.now() / 1000;
      const name = `metro-${new Date(startedAt * 1000).toISOString().replace(/[:.]/g, "-")}-${session}`;
      const file = path.join(options.output, `${name}.jsonl`);
      let frames = 0,
        usable = 0,
        errors = 0;
      console.log(`Recording session ${session}/${options.sessions}: ${file}`);
      while (
        !stopping &&
        Date.now() / 1000 - startedAt < options.minutes * 60
      ) {
        const cycleStart = Date.now();
        try {
          const frame = first ?? (await sample());
          first = undefined;
          await appendFile(
            file,
            JSON.stringify({
              offsetSeconds: frame.receivedAt - startedAt,
              ...frame,
            }) + "\n",
          );
          frames++;
          if (frame.freshObservations) usable++;
        } catch (error) {
          errors++;
          await appendFile(
            file,
            JSON.stringify({
              offsetSeconds: Date.now() / 1000 - startedAt,
              error: { status: Number(error.status) || null },
            }) + "\n",
          );
        }
        await new Promise((r) =>
          setTimeout(
            r,
            Math.max(0, options.interval - (Date.now() - cycleStart)),
          ),
        );
      }
      const complete =
        !stopping && Date.now() / 1000 - startedAt >= options.minutes * 60;
      await writeFile(
        path.join(options.output, `${name}.manifest.json`),
        JSON.stringify(
          {
            kind: "operator-recording",
            startedAt,
            endedAt: Date.now() / 1000,
            requestedMinutes: options.minutes,
            complete,
            frames,
            usable,
            errors,
            containsCredentials: false,
          },
          null,
          2,
        ) + "\n",
      );
      console.log(
        `Session ${session}: ${frames} frames, ${usable} usable, complete=${complete}.`,
      );
    }
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  record(argumentsFor(process.argv.slice(2))).catch((error) => {
    console.error(
      error.status
        ? `Metro request failed (HTTP ${error.status})`
        : error.message ===
            "No fresh numeric observations; normal-service recordings cannot start"
          ? error.message
          : "Recorder failed; check configuration, TLS and API availability",
    );
    process.exitCode = 1;
  });
}
