import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { argumentsFor, record } from "../record-metro.mjs";
import { formatMetroTime } from "../../packages/shared-utils/dist/index.js";

test("recorder validates duration, session count and polling interval", () => {
  assert.deepEqual(argumentsFor([]).sessions, 2);
  assert.equal(argumentsFor([]).minutes, 45);
  assert.equal(argumentsFor(["--probe"]).probe, true);
  for (const args of [
    ["--interval", "0"],
    ["--interval", "50"],
    ["--sessions", "1.5"],
    ["--minutes", "NaN"],
    ["--invalid"],
  ])
    assert.throws(() => argumentsFor(args));
});
async function mocked(t, data) {
  const originalFetch = globalThis.fetch,
    originalLog = console.log;
  const originalKey = process.env.METRO_API_KEY,
    originalBase = process.env.METRO_API_BASE;
  process.env.METRO_API_KEY = "RECORDER_SECRET_SENTINEL";
  process.env.METRO_API_BASE = "https://example.invalid/";
  globalThis.fetch = async () => ({ ok: true, json: async () => data() });
  console.log = () => {};
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    if (originalKey === undefined) delete process.env.METRO_API_KEY;
    else process.env.METRO_API_KEY = originalKey;
    if (originalBase === undefined) delete process.env.METRO_API_BASE;
    else process.env.METRO_API_BASE = originalBase;
  });
}
test("recorder refuses old or non-numeric data instead of claiming a normal-service recording", async (t) => {
  await mocked(t, () => ({
    resposta: [
      {
        stop_id: "RM",
        hora: "20250912181134",
        comboio: "7C",
        tempoChegada1: "--",
        destino: "54",
      },
    ],
  }));
  await assert.rejects(
    record(argumentsFor(["--sessions", "1", "--minutes", ".01"])),
    /No fresh numeric observations/,
  );
});
test("recorded frames whitelist data fields and never persist credentials or upstream extras", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "metro-recording-test-"));
  t.after(async () => {
    const relative = path.relative(tmpdir(), directory);
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    await rm(directory, { recursive: true, force: true });
  });
  await mocked(t, () => ({
    codigo: "200",
    secret: "RECORDER_SECRET_SENTINEL",
    resposta: [
      {
        stop_id: "RM",
        cais: "RM4",
        hora: formatMetroTime(Date.now() / 1000),
        comboio: "7C",
        tempoChegada1: 60,
        destino: "54",
        Authorization: "Bearer RECORDER_SECRET_SENTINEL",
        extraUrl: "https://secret.invalid/?token=RECORDER_SECRET_SENTINEL",
      },
    ],
  }));
  await record(
    argumentsFor([
      "--sessions",
      "1",
      "--minutes",
      ".01",
      "--output",
      directory,
    ]),
  );
  const files = await readdir(directory),
    frameFile = files.find((f) => f.endsWith(".jsonl"));
  assert.ok(frameFile);
  const content = await readFile(path.join(directory, frameFile), "utf8");
  assert.ok(!content.includes("RECORDER_SECRET_SENTINEL"));
  assert.ok(!content.includes("Authorization"));
  assert.ok(!content.includes("extraUrl"));
  const first = JSON.parse(content.trim().split("\n")[0]);
  assert.equal(first.data.resposta[0].comboio, "7C");
  assert.equal(
    first.data.resposta[0].tempoChegada1,
    60,
    "recordings retain numeric ETAs from the real API",
  );
  assert.ok(first.offsetSeconds >= 0);
  const manifest = JSON.parse(
    await readFile(
      path.join(
        directory,
        files.find((f) => f.endsWith(".manifest.json")),
      ),
      "utf8",
    ),
  );
  assert.equal(manifest.complete, true);
  assert.equal(manifest.containsCredentials, false);
  assert.ok(manifest.usable > 0);
});
