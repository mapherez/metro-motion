import { before, after, beforeEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  TrainTracker,
  formatMetroTime,
  sampleMotion,
  MAX_SPEED,
} from "@metro/shared-utils";

// Run the production presentation engine with a deterministic monotonic clock.
// Browser rendering is not involved: these tests exercise SSE reconciliation.
let elapsed = 0;
let epoch = Date.parse("2026-01-15T12:00:00Z") / 1000;
let engine, store;
const originals = new Map();
before(async () => {
  for (const [key, value] of Object.entries({
    matchMedia: () => ({ matches: false }),
    document: { hidden: false },
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  mock.method(performance, "now", () => elapsed * 1000);
  engine = await import("../src/motion-engine.ts");
  store = (await import("../src/state.ts")).useSnapshotStore;
});
after(() => {
  mock.restoreAll();
  for (const [key, descriptor] of originals)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
});
beforeEach(() => {
  epoch += 10000;
  elapsed = 0;
  store.setState({ paused: false, reducedMotion: false });
  engine.synchronizeClock(epoch);
  engine.ingestSnapshot(new TrainTracker().update({ resposta: [] }, epoch));
});
const row = (sec, eta) => ({
  stop_id: "RM",
  cais: "RM:forward",
  hora: formatMetroTime(epoch + sec),
  comboio: "7C",
  destino: "54",
  tempoChegada1: String(eta),
});
const train = () =>
  store.getState().snapshot.lines.verde.trains.find((tr) => tr.id === "7C");
const close = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

test("network delay and late SSE updates preserve continuity and a feasible arrival time", () => {
  const tracker = new TrainTracker();
  for (let sec = 0; sec <= 64; sec += 2) {
    const snapshot = tracker.update(
      { resposta: [row(sec, Math.max(0, 60 - sec))] },
      epoch + sec,
    );
    elapsed = sec + 1.8;
    const before = train() && engine.renderedMotion(train());
    engine.ingestSnapshot(snapshot);
    const after = engine.renderedMotion(train());
    if (before) {
      close(before.position, after.position);
      close(before.velocity, after.velocity);
    }
    assert.equal(train().retiringAt, undefined);
    if (sec === 58) {
      elapsed = 60;
      close(engine.renderedMotion(train()).position, 3);
      close(engine.renderedMotion(train()).velocity, 0);
    }
  }
});

test("oscillating ETA updates preserve the displayed position and velocity without reversing", () => {
  const tracker = new TrainTracker();
  let last = -Infinity;
  for (let sec = 0; sec <= 120; sec += 2) {
    const jitter = [0, 10, -8, 4, -3, 12, -10][(sec / 2) % 7];
    const snapshot = tracker.update(
      { resposta: [row(sec, 180 - sec + jitter)] },
      epoch + sec,
    );
    elapsed = sec + 0.6;
    const before = train() && engine.renderedMotion(train());
    engine.ingestSnapshot(snapshot);
    const after = engine.renderedMotion(train());
    if (before) {
      close(before.position, after.position);
      close(before.velocity, after.velocity);
    }
    assert.equal(train().retiringAt, undefined);
    for (let frame = 0; frame < 20; frame++) {
      const sample = engine.renderedMotion(
        train(),
        epoch + elapsed + frame / 10,
      );
      assert.ok(sample.position >= last - 1e-7);
      assert.ok(
        sample.velocity >= -1e-8 && sample.velocity <= MAX_SPEED + 1e-8,
      );
      last = sample.position;
    }
  }
});

test("a repeated source timestamp never freshens a displayed train", () => {
  const tracker = new TrainTracker();
  const data = { resposta: [row(0, 60)] };
  engine.ingestSnapshot(tracker.update(data, epoch));
  elapsed = 20;
  engine.ingestSnapshot(tracker.update(data, epoch + elapsed));
  elapsed = 30;
  const frozen = engine.renderedMotion(train());
  elapsed = 80;
  engine.ingestSnapshot(tracker.update(data, epoch + elapsed));
  const later = engine.renderedMotion(train());
  close(frozen.position, later.position);
  assert.equal(later.phase, "stale");
  assert.equal(later.velocity, 0);
  assert.equal(train().observedAt, epoch);
  close(later.position, sampleMotion(train(), epoch + 30).position);
});

test("reacquisition after stale data fades in from the time the browser receives confirmation", () => {
  const tracker = new TrainTracker();
  engine.ingestSnapshot(tracker.update({ resposta: [row(0, 60)] }, epoch));
  const originalJourney = train().journeyId;
  elapsed = 35.5;
  engine.ingestSnapshot(
    tracker.update({ resposta: [row(35, 10)] }, epoch + 35),
  );
  assert.equal(train().journeyId, originalJourney);
  elapsed = 36.5;
  close(engine.renderedMotion(train()).opacity, 0);

  // The server's fade-in has already elapsed by the time this frame arrives.
  elapsed = 38.5;
  engine.ingestSnapshot(tracker.update({ resposta: [row(37, 8)] }, epoch + 37));
  assert.notEqual(train().journeyId, originalJourney);
  close(engine.renderedMotion(train()).opacity, 0);
  elapsed = 38.9;
  close(engine.renderedMotion(train()).opacity, 0.5, 1e-6);
  elapsed = 39.4;
  close(engine.renderedMotion(train()).opacity, 1);
});

test("an incompatible server correction fades the displayed trajectory without a position jump", () => {
  const tracker = new TrainTracker();
  engine.ingestSnapshot(tracker.update({ resposta: [row(0, 60)] }, epoch));
  elapsed = 3.5;
  engine.ingestSnapshot(tracker.update({ resposta: [row(2, 100)] }, epoch + 2));
  elapsed = 5.5;
  const before = engine.renderedMotion(train());
  // A new positive prediction behind the train is incompatible. A residual
  // zero at an already-passed platform is deliberately ignored by the tracker.
  const incompatible = { ...row(4, 10), stop_id: "CG", cais: "CG:forward" };
  engine.ingestSnapshot(
    tracker.update({ resposta: [incompatible] }, epoch + 4),
  );
  const after = engine.renderedMotion(train());
  close(before.position, after.position);
  close(before.velocity, after.velocity);
  close(after.opacity, 1);
  elapsed = 5.9;
  close(engine.renderedMotion(train()).opacity, 0.5, 1e-6);
  elapsed = 6.4;
  engine.ingestSnapshot(
    tracker.update({ resposta: [incompatible] }, epoch + 6),
  );
  close(engine.renderedMotion(train()).opacity, 0);
});
