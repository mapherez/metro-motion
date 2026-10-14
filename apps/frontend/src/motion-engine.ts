import type { Snapshot, Train } from "@metro/shared-types";
import {
  planMotion,
  sampleMotion,
  type MotionSample,
} from "@metro/shared-utils";
import { useSnapshotStore } from "./state";

const tracks = new Map<string, Train>();
const signatures = new Map<string, string>();
const frozen = new Map<string, MotionSample>();
const listeners = new Set<(at: number) => void>();
let frame = 0;
let clockAt = Date.now() / 1000;
let clockMono = performance.now();
let lastReceivedAt = -Infinity;
let lastSecond = 0;
let running = false;
export const motionKey = (train: Train) => `${train.line}:${train.id}`;
export const motionNow = () => clockAt + (performance.now() - clockMono) / 1000;
export function synchronizeClock(serverAt: number) {
  if (!Number.isFinite(serverAt) || serverAt <= 0) return;
  clockAt = serverAt;
  clockMono = performance.now();
  draw();
}

export function renderedMotion(train: Train, at = motionNow()): MotionSample {
  const key = motionKey(train);
  const { paused, reducedMotion } = useSnapshotStore.getState();
  if ((paused || reducedMotion) && frozen.has(key)) {
    const sample = frozen.get(key)!;
    return at >= train.validUntil
      ? { ...sample, velocity: 0, phase: "stale" }
      : sample;
  }
  const sample = sampleMotion(tracks.get(key) ?? train, at);
  if (paused || reducedMotion) frozen.set(key, sample);
  return sample;
}
export function ingestSnapshot(snapshot: Snapshot) {
  if (snapshot.receivedAt < lastReceivedAt) return;
  lastReceivedAt = snapshot.receivedAt;
  const now = motionNow(),
    keys = new Set<string>();
  for (const line of Object.values(snapshot.lines))
    for (const train of line.trains) {
      const key = motionKey(train);
      keys.add(key);
      const signature = `${train.journeyId}:${train.observedAt}:${train.retiringAt ?? ""}`;
      if (signatures.get(key) === signature) continue;
      const previous = tracks.get(key);
      let next = train;
      if (!previous || previous.journeyId !== train.journeyId) {
        // A server fade may have finished in transit. Start the visible fade
        // when this browser actually receives the new/reconfirmed journey.
        next = { ...train, appearedAt: now };
      } else if (train.retiringAt !== undefined) {
        // Fade the trajectory that was being displayed, preserving its local
        // correction instead of replacing it with an older server trajectory.
        next = {
          ...previous,
          observedAt: train.observedAt,
          validUntil: train.validUntil,
          retiringAt: previous.retiringAt ?? now,
        };
      } else if (
        previous?.journeyId === train.journeyId &&
        previous.retiringAt !== undefined &&
        train.retiringAt === undefined
      ) {
        next =
          now - previous.retiringAt >= 0.8
            ? { ...train, appearedAt: now }
            : {
                ...previous,
                observedAt: train.observedAt,
                validUntil: train.validUntil,
              };
      } else if (
        previous?.journeyId === train.journeyId &&
        now >= previous.validUntil &&
        train.validUntil > now
      ) {
        next = { ...previous, retiringAt: now };
      } else if (
        previous?.journeyId === train.journeyId &&
        !train.retiringAt &&
        now < previous.validUntil
      ) {
        const current = sampleMotion(previous, now);
        const target = train.segments[train.segments.length - 1];
        const segments = planMotion(
          current.position,
          current.velocity,
          target.to,
          target.endAt,
          now,
          train.direction,
        );
        next = segments
          ? { ...train, segments }
          : {
              ...previous,
              observedAt: train.observedAt,
              validUntil: train.validUntil,
              retiringAt: now,
            };
      }
      tracks.set(key, next);
      signatures.set(key, signature);
      if (
        useSnapshotStore.getState().reducedMotion &&
        !useSnapshotStore.getState().paused
      )
        frozen.delete(key);
    }
  for (const key of tracks.keys())
    if (!keys.has(key)) {
      tracks.delete(key);
      signatures.delete(key);
      frozen.delete(key);
    }
  useSnapshotStore.setState({
    snapshot,
    loading: false,
    connected: true,
    error: null,
    now,
  });
  draw();
}
function draw() {
  if (document.hidden) return;
  const now = motionNow();
  for (const listener of listeners) listener(now);
  const second = Math.floor(now);
  if (second !== lastSecond) {
    lastSecond = second;
    useSnapshotStore.setState({ now });
  }
}
function tick() {
  if (!running) return;
  const { paused, reducedMotion } = useSnapshotStore.getState();
  if ((!paused && !reducedMotion) || Math.floor(motionNow()) !== lastSecond)
    draw();
  frame = requestAnimationFrame(tick);
}
function start() {
  if (running || document.hidden) return;
  running = true;
  frame = requestAnimationFrame(tick);
}
function stop() {
  running = false;
  cancelAnimationFrame(frame);
}
export function subscribeMotion(listener: (at: number) => void) {
  listeners.add(listener);
  listener(motionNow());
  return () => {
    listeners.delete(listener);
  };
}
export function startMotionEngine() {
  const visibility = () => {
    if (document.hidden) stop();
    else {
      draw();
      start();
    }
  };
  const unsubscribe = useSnapshotStore.subscribe((state, previous) => {
    if (
      state.paused !== previous.paused ||
      state.reducedMotion !== previous.reducedMotion
    ) {
      if (!state.paused && !state.reducedMotion) {
        const now = motionNow();
        for (const [key, sample] of frozen) {
          const track = tracks.get(key);
          if (!track) continue;
          const target = track.segments[track.segments.length - 1];
          if (Math.abs(target.to - sample.position) > 1.15) {
            tracks.set(key, { ...track, appearedAt: now });
            continue;
          }
          const segments = planMotion(
            sample.position,
            0,
            target.to,
            Math.max(now + 3, target.endAt),
            now,
            track.direction,
          );
          if (segments) tracks.set(key, { ...track, segments });
        }
        frozen.clear();
      }
      draw();
    }
  });
  document.addEventListener("visibilitychange", visibility);
  start();
  return () => {
    stop();
    unsubscribe();
    document.removeEventListener("visibilitychange", visibility);
  };
}
