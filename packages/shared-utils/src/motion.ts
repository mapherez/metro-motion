import type { MotionPhase, MotionSegment, Train } from '@metro/shared-types';

export const STALE_SECONDS = 30;
// Units are station intervals, not metres: this is schematic estimated motion.
export const MAX_SPEED = 0.06;
export const MAX_ACCELERATION = 0.006;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export type MotionSample = { position: number; velocity: number; phase: MotionPhase; opacity: number };

export function sampleSegment(s: MotionSegment, at: number): { position: number; velocity: number } {
  const duration = s.endAt - s.startAt;
  const u = clamp((at - s.startAt) / duration, 0, 1);
  const d = s.to - s.from;
  const a = s.v0 * duration;
  const b = s.v1 * duration;
  const position = s.from + (-2 * u ** 3 + 3 * u ** 2) * d + (u ** 3 - 2 * u ** 2 + u) * a + (u ** 3 - u ** 2) * b;
  const velocity = at > s.endAt ? s.v1 : ((-6 * u * u + 6 * u) * d + (3 * u * u - 4 * u + 1) * a + (3 * u * u - 2 * u) * b) / duration;
  return { position, velocity };
}

export function sampleMotion(train: Train, at: number): MotionSample {
  const sampleAt = Math.min(at, train.validUntil);
  const s = train.segments.find(segment => sampleAt <= segment.endAt) ?? train.segments[train.segments.length - 1];
  const sample = sampleSegment(s, sampleAt);
  const stale = at >= train.validUntil;
  const u = clamp((sampleAt - s.startAt) / (s.endAt - s.startAt), 0, 1);
  const phase: MotionPhase = stale ? 'stale' : s.from === s.to || sampleAt >= s.endAt ? 'dwelling'
    : u < 0.2 && Math.abs(s.v0) < 0.001 ? 'departing' : u > 0.65 ? 'approaching' : 'running';
  const fadeIn = clamp((at - train.appearedAt) / 0.8, 0, 1);
  const fadeOut = train.retiringAt === undefined ? 1 : 1 - clamp((at - train.retiringAt) / 0.8, 0, 1);
  return { ...sample, velocity: stale ? 0 : sample.velocity, phase, opacity: fadeIn * fadeOut };
}

function segment(startAt: number, duration: number, from: number, to: number, v0: number, v1 = 0): MotionSegment {
  return { startAt, endAt: startAt + Math.max(0.001, duration), from, to, v0, v1, phase: from === to ? 'dwelling' : Math.abs(v0) < 0.001 ? 'departing' : 'running' };
}

/** Preserve velocity and position. Never overshoot a confirmed station or move backwards. */
export function planMotion(position: number, velocity: number, target: number, arrivalAt: number, now: number, direction: -1 | 1): MotionSegment[] | null {
  const distance = (target - position) * direction;
  const speed = Math.max(0, velocity * direction);
  if (distance < -0.015 || speed > MAX_SPEED + 0.00001) return null;
  if (distance <= 0.00001) return speed > 0.001 ? null : [segment(now, STALE_SECONDS, position, position, 0)];
  const duration = Math.max(arrivalAt - now, Math.sqrt(6 * distance / MAX_ACCELERATION), 1.5 * distance / MAX_SPEED, 1);
  const direct = segment(now, duration, position, target, velocity);
  const startAcceleration = (6 * distance / duration ** 2) - 4 * speed / duration;
  const endAcceleration = -6 * distance / duration ** 2 + 2 * speed / duration;
  const directSafe = speed * duration <= 3 * distance && Math.max(Math.abs(startAcceleration), Math.abs(endAcceleration)) <= MAX_ACCELERATION
    && Array.from({ length: 21 }, (_, i) => Math.abs(sampleSegment(direct, now + duration * i / 20).velocity)).every(v => v <= MAX_SPEED + 0.00001);
  if (directSafe) return [direct];
  // A longer ETA cannot instantly remove existing velocity. Brake first, then
  // use the remaining distance/time; both joins have exactly zero velocity.
  const brakeDuration = speed / MAX_ACCELERATION;
  const brakeDistance = speed * brakeDuration / 2;
  if (brakeDistance >= distance || speed === 0) return null;
  const brakeEnd = position + direction * brakeDistance;
  const remaining = distance - brakeDistance;
  const travelDuration = Math.max(arrivalAt - now - brakeDuration, Math.sqrt(6 * remaining / MAX_ACCELERATION), 1.5 * remaining / MAX_SPEED, 1);
  return [segment(now, brakeDuration, position, brakeEnd, velocity), segment(now + brakeDuration, travelDuration, brakeEnd, target, 0)];
}

export function stationary(position: number, now: number): MotionSegment[] {
  return [segment(now, STALE_SECONDS, position, position, 0)];
}
