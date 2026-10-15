import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TrainTracker,
  formatMetroTime,
  observations,
  parseMetroTime,
  parseEta,
  planMotion,
  sampleSegment,
  sampleMotion,
  MAX_SPEED,
  MAX_ACCELERATION,
} from "@metro/shared-utils";
import { Snapshot } from "@metro/shared-types";
import { lineNames, lineOrder } from "@metro/station-data";
import { replayAt, validateReplay } from "../dist/replay.js";

const t = Date.parse("2026-01-15T12:00:00Z") / 1000;
const row = (at, eta = "60", extra = {}) => ({
  stop_id: "RM",
  cais: "green:RM:forward",
  hora: formatMetroTime(at),
  comboio: "7C",
  tempoChegada1: eta,
  destino: "54",
  ...extra,
});
const train = (s) => s.lines.verde.trains.find((t) => t.id === "7C");
const close = (a, b, tolerance = 1e-8) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("Lisbon timestamps validate winter, summer, DST gaps and ambiguous autumn hours", () => {
  assert.equal(parseMetroTime("20260115120000"), t);
  assert.equal(
    parseMetroTime("20260715120000"),
    Date.parse("2026-07-15T11:00:00Z") / 1000,
  );
  assert.equal(parseMetroTime("20260230120000"), null);
  assert.equal(parseMetroTime("20260329013000"), null);
  const autumn = Date.parse("2026-10-25T01:30:05Z") / 1000;
  assert.equal(parseMetroTime("20261025013000", autumn), autumn - 5);
  assert.equal(parseMetroTime("n/a"), null);
});
test("invalid, missing, ancient and future observations cannot refresh an ETA", () => {
  for (const eta of ["--", "-1", "1junk", "Infinity", "1.5", ""])
    assert.equal(parseEta(eta), null);
  assert.equal(
    observations({ resposta: [row(t - 30), row(t + 10)] }, t).length,
    0,
  );
  const tracker = new TrainTracker();
  const initial = tracker.update({ resposta: [row(t)] }, t);
  const repeated = tracker.update({ resposta: [row(t)] }, t + 12);
  assert.equal(train(repeated).observedAt, t);
  assert.deepEqual(train(repeated).segments, train(initial).segments);
  const older = tracker.update({ resposta: [row(t - 2, "1")] }, t + 14);
  assert.equal(train(older).observedAt, t);
  const frozen = sampleMotion(train(older), t + 31),
    later = sampleMotion(train(older), t + 80);
  close(frozen.position, later.position);
  assert.equal(later.phase, "stale");
  assert.equal(later.velocity, 0);
});
test("shared destinations do not relabel a blue train as red and malformed rows are isolated", () => {
  const data = {
    resposta: [
      row(t, "40", { stop_id: "PA", comboio: "1A", destino: "38" }),
      row(t, "--"),
    ],
  };
  const s = new TrainTracker().update(data, t);
  assert.equal(s.lines.azul.trains[0].to, "PA");
  assert.equal(s.lines.vermelha.trains.length, 0);
  assert.equal(
    s.lines.azul.stations.find((s) => s.stationId === "PA").arrivals[0].trainId,
    "1A",
  );
  Snapshot.parse(s);
});
test("ETA corrections preserve position and velocity, including braking for a longer ETA", () => {
  const tracker = new TrainTracker();
  let previous = tracker.update({ resposta: [row(t, "70")] }, t);
  for (const [seconds, eta] of [
    [2, "68"],
    [4, "100"],
    [6, "35"],
    [8, "90"],
    [10, "88"],
  ]) {
    const before = sampleMotion(train(previous), t + seconds);
    const next = tracker.update(
      { resposta: [row(t + seconds, eta)] },
      t + seconds,
    );
    const after = sampleMotion(train(next), t + seconds);
    close(before.position, after.position);
    close(before.velocity, after.velocity);
    previous = next;
  }
});

test("asynchronous platform clocks cannot redirect a moving train to a distant fresher station", () => {
  const tracker = new TrainTracker();
  const next = (at, eta, extra = {}) =>
    row(at, eta, {
      stop_id: "SS",
      cais: "blue:SS",
      comboio: "013A",
      destino: "38",
      ...extra,
    });
  const first = tracker.update(
    {
      resposta: [
        next(t, "103", { stop_id: "CM", cais: "blue:CM" }),
        next(t - 1, "618"),
      ],
    },
    t + 3,
  );
  const original = first.lines.azul.trains[0];
  const distant = tracker.update({ resposta: [next(t + 4, "609")] }, t + 5);
  const unchanged = distant.lines.azul.trains[0];
  assert.equal(unchanged.to, "CM");
  assert.equal(unchanged.retiringAt, undefined);
  assert.equal(unchanged.journeyId, original.journeyId);
  assert.deepEqual(unchanged.segments, original.segments);
  // The nearest platform now updates, still behind the distant platform's
  // maximum clock. Its new prediction must nevertheless be processed.
  const nearby = tracker.update(
    { resposta: [next(t + 3, "93", { stop_id: "CM", cais: "blue:CM" })] },
    t + 6,
  );
  const updated = nearby.lines.azul.trains[0];
  assert.equal(updated.observedAt, t + 3);
  assert.equal(updated.retiringAt, undefined);
  assert.equal(updated.journeyId, original.journeyId);
  const before = sampleMotion(unchanged, t + 6),
    after = sampleMotion(updated, t + 6);
  close(before.position, after.position);
  close(before.velocity, after.velocity);
});
test("cubic trajectories are monotonic and respect speed and acceleration limits", () => {
  for (const direction of [-1, 1])
    for (const speed of [0, 0.005, 0.02])
      for (const eta of [2, 30, 300]) {
        const segments = planMotion(
          5,
          speed * direction,
          5 + direction,
          t + eta,
          t,
          direction,
        );
        assert.ok(segments);
        let last = 5;
        for (const s of segments) {
          const count = 1000,
            dt = (s.endAt - s.startAt) / count;
          let previousVelocity = s.v0;
          for (let i = 0; i <= count; i++) {
            const sample = sampleSegment(s, s.startAt + dt * i);
            assert.ok((sample.position - last) * direction >= -1e-8);
            assert.ok(Math.abs(sample.velocity) <= MAX_SPEED + 1e-6);
            if (i)
              assert.ok(
                Math.abs(sample.velocity - previousVelocity) / dt <=
                  MAX_ACCELERATION + 1e-6,
              );
            last = sample.position;
            previousVelocity = sample.velocity;
          }
        }
        close(last, 5 + direction);
      }
});
test("a feasible arrival deadline survives updates in the final fractions of a second", () => {
  for (const direction of [-1, 1]) {
    const initial = planMotion(5, 0, 5 + direction, t + 40, t, direction);
    for (const remaining of [0.4, 0.2, 0.05, 0.01]) {
      const now = t + 40 - remaining;
      const current = sampleSegment(initial[0], now);
      const next = planMotion(
        current.position,
        current.velocity,
        5 + direction,
        t + 40,
        now,
        direction,
      );
      assert.ok(next);
      close(next.at(-1).endAt, t + 40, 1e-6);
      close(sampleSegment(next[0], now).position, current.position);
      close(sampleSegment(next[0], now).velocity, current.velocity);
      close(sampleSegment(next.at(-1), t + 40).position, 5 + direction);
      close(sampleSegment(next.at(-1), t + 40).velocity, 0);
    }
  }
});

test("the velocity peak between grid samples cannot exceed the speed limit", () => {
  // This curve's peak falls between the old 21 sampling points.
  const next = planMotion(
    0,
    0.059578736208625874,
    0.9594550958627649,
    16.21719226856562,
    0,
    1,
  );
  assert.ok(next);
  for (const s of next) {
    const duration = s.endAt - s.startAt;
    for (let i = 0; i <= 10000; i++)
      assert.ok(
        Math.abs(
          sampleSegment(s, s.startAt + (duration * i) / 10000).velocity,
        ) <=
          MAX_SPEED + 1e-8,
      );
  }
});

test("stable ETA updates reach the station on time without accumulating delay", () => {
  const tracker = new TrainTracker();
  let latest;
  for (let sec = 0; sec <= 65; sec++) {
    latest = tracker.update(
      { resposta: [row(t + sec, String(Math.max(0, 60 - sec)))] },
      t + sec,
    );
    assert.equal(train(latest).retiringAt, undefined);
    if (sec < 60) close(train(latest).segments.at(-1).endAt, t + 60, 1e-6);
    else close(sampleMotion(train(latest), t + sec).position, 3);
  }
  close(sampleMotion(train(latest), t + 65).position, 3);
  close(sampleMotion(train(latest), t + 65).velocity, 0);
});

test("station passage remains continuous and stops on an observed arrival", () => {
  const tracker = new TrainTracker();
  let s = tracker.update({ resposta: [row(t, "10")] }, t);
  const end = train(s).segments[0].endAt;
  s = tracker.update({ resposta: [row(end, "0")] }, end);
  close(sampleMotion(train(s), end).position, 3);
  assert.equal(sampleMotion(train(s), end + 2).phase, "dwelling");
  const departure = tracker.update(
    {
      resposta: [
        row(end + 6, "70", { stop_id: "AE", cais: "green:AE:forward" }),
      ],
    },
    end + 6,
  );
  close(sampleMotion(train(departure), end + 6).position, 3);
  close(sampleMotion(train(departure), end + 6).velocity, 0);
  assert.equal(sampleMotion(train(departure), end + 7).phase, "departing");
  // The previous platform may publish a new zero before removing the train.
  // Once the adjacent segment is confirmed, this must not retire or rewind it.
  const previousZero = tracker.update(
    {
      resposta: [
        row(end + 8, "0"),
        row(end + 8, "68", { stop_id: "AE", cais: "green:AE:forward" }),
      ],
    },
    end + 8,
  );
  assert.equal(train(previousZero).to, "AE");
  assert.equal(train(previousZero).retiringAt, undefined);
  assert.equal(train(previousZero).journeyId, train(departure).journeyId);
  close(
    sampleMotion(train(previousZero), end + 8).position,
    sampleMotion(train(departure), end + 8).position,
  );
  close(
    sampleMotion(train(previousZero), end + 8).velocity,
    sampleMotion(train(departure), end + 8).velocity,
  );
});
test("future return predictions do not duplicate or reverse a train", () => {
  const tracker = new TrainTracker();
  for (let step = 0; step < 5; step++) {
    const s = tracker.update(
      {
        resposta: [
          row(t + step * 2, String(60 - step * 2)),
          row(t + step * 2, "300", { destino: "50", cais: "green:RM:return" }),
        ],
      },
      t + step * 2,
    );
    assert.equal(s.lines.verde.trains.length, 1);
    assert.equal(train(s).direction, 1);
    assert.equal(train(s).destinationId, "54");
  }
});
test("reversal at a terminal requires two distinct fresh observations", () => {
  const tracker = new TrainTracker();
  const incoming = {
    resposta: [
      row(t, "0", { stop_id: "TE", destino: "50", cais: "TE:incoming" }),
    ],
  };
  const first = tracker.update(incoming, t);
  assert.equal(train(first).direction, -1);
  const outgoing = (at) => ({
    resposta: [row(at, "0", { stop_id: "TE", cais: "TE:outgoing" })],
  });
  const pending = tracker.update(outgoing(t + 2), t + 2);
  assert.equal(train(pending).direction, -1);
  const repeated = tracker.update(outgoing(t + 2), t + 4);
  assert.equal(train(repeated).direction, -1);
  const confirmed = tracker.update(outgoing(t + 6), t + 6);
  assert.equal(train(confirmed).direction, 1);
  assert.notEqual(train(confirmed).journeyId, train(first).journeyId);
  close(sampleMotion(train(confirmed), t + 6).position, 0);
});

test("future return predictions cannot reverse a journey away from its terminal after the incoming data expires", () => {
  const tracker = new TrainTracker();
  const first = tracker.update({ resposta: [row(t, "0")] }, t);
  for (const seconds of [31, 34, 38]) {
    const next = tracker.update(
      {
        resposta: [
          row(t + seconds, "700", {
            stop_id: "CS",
            cais: "CS:return",
            destino: "50",
          }),
        ],
      },
      t + seconds,
    );
    assert.equal(train(next).direction, 1);
    assert.equal(train(next).journeyId, train(first).journeyId);
    assert.equal(train(next).phase, "stale");
    close(sampleMotion(train(next), t + seconds).position, 3);
  }
});

test("two future departures at a terminal are not two observations of an imminent reversal", () => {
  const tracker = new TrainTracker();
  const incoming = tracker.update(
    {
      resposta: [
        row(t, "0", { stop_id: "TE", destino: "50", cais: "TE:incoming" }),
      ],
    },
    t,
  );
  for (const seconds of [31, 34]) {
    const next = tracker.update(
      {
        resposta: [
          row(t + seconds, "240", { stop_id: "TE", cais: "TE:outgoing" }),
        ],
      },
      t + seconds,
    );
    assert.equal(train(next).journeyId, train(incoming).journeyId);
    assert.equal(train(next).direction, -1);
  }
  tracker.update(
    { resposta: [row(t + 36, "2", { stop_id: "TE", cais: "TE:outgoing" })] },
    t + 36,
  );
  const confirmed = tracker.update(
    { resposta: [row(t + 38, "0", { stop_id: "TE", cais: "TE:outgoing" })] },
    t + 38,
  );
  assert.equal(train(confirmed).direction, 1);
});
test("an intermediate destination preserves established direction at its terminal", () => {
  const tracker = new TrainTracker();
  let arrival;
  for (let sec = 0; sec <= 90; sec += 2) {
    const rows = [
      row(t + sec, String(Math.max(0, 80 - sec)), {
        stop_id: "CG",
        comboio: "7B",
        destino: "45",
        cais: "CG:short",
      }),
    ];
    if (sec < 50)
      rows.push(
        row(t + sec, String(Math.max(0, 30 - sec)), {
          stop_id: "CU",
          comboio: "7B",
          destino: "45",
          cais: "CU:short",
        }),
      );
    arrival = tracker.update({ resposta: rows }, t + sec);
    assert.equal(arrival.lines.amarela.trains[0].direction, -1);
  }
  close(sampleMotion(arrival.lines.amarela.trains[0], t + 90).position, 5);
});
test("unknown destinations retain arrival times without inventing marker directions", () => {
  const s = new TrainTracker().update(
    { resposta: [row(t, "60", { destino: undefined })] },
    t,
  );
  assert.equal(s.lines.verde.trains.length, 0);
  assert.equal(
    s.lines.verde.stations.find((s) => s.stationId === "RM").arrivals.length,
    1,
  );
});
test("incompatible corrections fade and require two distinct observations before reacquisition", () => {
  const tracker = new TrainTracker();
  const first = tracker.update({ resposta: [row(t)] }, t);
  const correction = () => ({
    resposta: [row(t + 2, "10", { stop_id: "CG", cais: "green:CG:forward" })],
  });
  const pending = tracker.update(correction(), t + 2);
  assert.equal(train(pending).journeyId, train(first).journeyId);
  assert.equal(train(pending).retiringAt, t + 2);
  const repeated = tracker.update(correction(), t + 4);
  assert.equal(train(repeated).journeyId, train(first).journeyId);
  const confirmed = tracker.update(
    {
      resposta: [row(t + 6, "8", { stop_id: "CG", cais: "green:CG:forward" })],
    },
    t + 6,
  );
  assert.notEqual(train(confirmed).journeyId, train(first).journeyId);
  assert.equal(sampleMotion(train(confirmed), t + 6).opacity, 0);
});
test("replay normalizes numeric ETAs from real recordings without rewriting the input", () => {
  const original = {
    frames: [{ offsetSeconds: 0, data: { resposta: [row(t, 60)] } }],
  };
  const replay = validateReplay(original);
  assert.equal(original.frames[0].data.resposta[0].tempoChegada1, 60);
  assert.equal(replay.frames[0].data.resposta[0].tempoChegada1, "60");
  const data = replayAt(replay, t + 100, t + 100);
  assert.equal(observations(data, t + 100)[0].etaSeconds, 60);
  const snapshot = new TrainTracker().update(data, t + 100);
  assert.equal(train(snapshot).etaNext, 60);
  Snapshot.parse(snapshot);
});

test("replay preserves reception age when a live response also contains ancient platform clocks", () => {
  const old = row(t - 86400, "--", { cais: "old", comboio: "34C" });
  const recent = row(t - 3, 60);
  const replay = validateReplay({
    frames: [
      { offsetSeconds: 0, receivedAt: t, data: { resposta: [old, recent] } },
    ],
  });
  const data = replayAt(replay, t + 100, t + 100);
  const obs = observations(data, t + 100);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].observedAt, t + 97);
  assert.equal(obs[0].arrivalAt, t + 157);
  assert.equal(train(new TrainTracker().update(data, t + 100)).etaNext, 57);
  // Older recordings without reception times still use the newest source
  // clock; an ancient first row must not shift the whole response into future.
  const legacy = validateReplay({
    frames: [{ offsetSeconds: 0, data: { resposta: [old, recent] } }],
  });
  assert.equal(
    observations(replayAt(legacy, t + 100, t + 100), t + 100).length,
    1,
  );
});

test("replay does not freshen a finished recording and synthetic network exercises all directions", () => {
  const recording = validateReplay({
    frames: [
      { offsetSeconds: 0, data: { resposta: [row(t)] } },
      { offsetSeconds: 2, data: { resposta: [row(t + 2, "58")] } },
    ],
  });
  assert.equal(
    replayAt(recording, t + 100, t + 140).resposta[0].hora,
    formatMetroTime(t + 102),
  );
  assert.throws(() =>
    validateReplay({
      frames: [
        { offsetSeconds: 0, data: { resposta: [] } },
        { offsetSeconds: 0, data: { resposta: [] } },
      ],
    }),
  );
  const replay = validateReplay({
    kind: "synthetic-network",
    travelSeconds: 90,
    dwellSeconds: 25,
  });
  const tracker = new TrainTracker();
  let previous;
  for (let sec = 0; sec <= 2100; sec += 2) {
    const next = tracker.update(replayAt(replay, t, t + sec), t + sec, {
      source: "mock",
    });
    Snapshot.parse(next);
    for (const line of lineNames) {
      assert.equal(next.lines[line].trains.length, 2);
      for (const tr of next.lines[line].trains) {
        const sample = sampleMotion(tr, t + sec);
        assert.ok(
          sample.position >= -1e-6 &&
            sample.position <= lineOrder[line].length - 1 + 1e-6,
        );
        const old = previous?.lines[line].trains.find((o) => o.id === tr.id);
        if (
          old?.journeyId === tr.journeyId &&
          !old.retiringAt &&
          !tr.retiringAt
        ) {
          close(sampleMotion(old, t + sec).position, sample.position, 1e-6);
          close(sampleMotion(old, t + sec).velocity, sample.velocity, 1e-6);
        }
      }
    }
    previous = next;
  }
});
