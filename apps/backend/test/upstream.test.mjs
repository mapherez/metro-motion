import { test } from "node:test";
import assert from "node:assert/strict";
import { Ingestor } from "../dist/ingestor.js";
import { MetroResponse } from "../dist/metro-api.js";
import { formatMetroTime } from "@metro/shared-utils";
import { FakeRedis, logger, settings } from "./helpers.mjs";
const start = Date.parse("2026-01-15T12:00:00Z");
const row = (clock) => ({
  stop_id: "RM",
  cais: "RM4",
  hora: formatMetroTime(clock / 1000),
  comboio: "7C",
  tempoChegada1: "40",
  destino: "54",
  sairServico: 0,
  UT: 2,
});
test("empty global responses switch to four line endpoints and recheck global after 60 seconds", async () => {
  const redis = new FakeRedis(),
    config = settings({ mock: false });
  let clock = start,
    globalRecovered = false;
  const requests = [];
  const ingestor = new Ingestor(config, redis, logger, {
    now: () => new Date(clock),
    fetchEndpoint: async (endpoint) => {
      requests.push(endpoint);
      if (endpoint === "tempoEspera/Estacao/todos")
        return { resposta: globalRecovered ? [row(clock)] : [] };
      if (endpoint === "tempoEspera/Linha/Verde")
        return { resposta: [row(clock)] };
      if (endpoint.startsWith("tempoEspera/Linha/")) return { resposta: [] };
      if (endpoint === "estadoLinha/todos")
        return {
          resposta: { verde: " Ok", verde_curta: "normal", tipo_msg_vd: "0" },
        };
      return { resposta: [] };
    },
  });
  await ingestor.pollOnce();
  assert.equal(
    requests.filter((p) => p.startsWith("tempoEspera/Linha")).length,
    0,
  );
  clock += 2000;
  await ingestor.pollOnce();
  assert.equal(
    requests.filter((p) => p.startsWith("tempoEspera/Linha")).length,
    4,
  );
  const fallback = JSON.parse(await redis.get(config.redis.snapshotKey));
  assert.equal(fallback.source, "lines");
  assert.equal(fallback.lines.verde.trains.length, 1);
  assert.equal(fallback.lines.verde.status.message, "Circulação normal");
  clock += 2000;
  await ingestor.pollOnce();
  assert.equal(
    requests.filter((p) => p === "tempoEspera/Estacao/todos").length,
    2,
  );
  clock += 60000;
  globalRecovered = true;
  await ingestor.pollOnce();
  assert.equal(
    JSON.parse(await redis.get(config.redis.snapshotKey)).source,
    "global",
  );
  assert.equal(requests.filter((p) => p === "infoEstacao/todos").length, 1);
});
test("strike-like empty and non-numeric data cannot claim fresh train observations", async () => {
  const redis = new FakeRedis(),
    config = settings({ mock: false });
  let clock = start;
  const ingestor = new Ingestor(config, redis, logger, {
    now: () => new Date(clock),
    fetchEndpoint: async (endpoint) => {
      if (endpoint === "estadoLinha/todos")
        return {
          resposta: {
            verde: "Serviço interrompido",
            verde_curta: "interrompido",
            tipo_msg_vd: "1",
          },
        };
      if (endpoint.startsWith("tempoEspera/Linha/"))
        return {
          resposta: [
            { ...row(clock), tempoChegada1: "--", hora: "20250912181134" },
          ],
        };
      return { resposta: [] };
    },
  });
  await ingestor.pollOnce();
  clock += 2000;
  await ingestor.pollOnce();
  const data = JSON.parse(await redis.get(config.redis.snapshotKey));
  assert.equal(
    data.serviceOpen,
    true,
    "timetable availability is distinct from operator disruption",
  );
  assert.equal(data.lines.verde.status.message, "Serviço interrompido");
  assert.equal(data.lines.verde.dataObservedAt, null);
  assert.equal(data.lines.verde.trains.length, 0);
});
test("upstream application error codes are failures even with an HTTP 200 envelope", () => {
  assert.equal(
    MetroResponse.safeParse({ resposta: [], codigo: "500" }).success,
    false,
  );
  assert.equal(
    MetroResponse.safeParse({ resposta: [row(start)], codigo: 200 }).success,
    true,
  );
});
