import { lineNames, lineOrder, destinos } from "@metro/station-data";
import {
  formatMetroTime,
  parseMetroTime,
  type MetroData,
} from "@metro/shared-utils";
import { MetroResponse } from "./metro-api.js";

type Frame = { offsetSeconds: number; receivedAt?: number; data: MetroData };
export type Replay = {
  kind?: string;
  travelSeconds?: number;
  dwellSeconds?: number;
  frames?: Frame[];
};
const suffix = { azul: "A", amarela: "B", verde: "C", vermelha: "D" };
export function validateReplay(value: unknown): Replay {
  const replay = value as Replay;
  if (replay?.kind === "synthetic-network") {
    if (
      !(
        Number.isFinite(replay.travelSeconds) &&
        replay.travelSeconds! >= 20 &&
        Number.isFinite(replay.dwellSeconds) &&
        replay.dwellSeconds! >= 1
      )
    )
      throw new Error("Invalid synthetic replay");
    return replay;
  }
  if (!Array.isArray(replay?.frames) || !replay.frames.length) {
    // A legacy raw fixture is rebased once, not artificially refreshed forever.
    return { frames: [{ offsetSeconds: 0, data: MetroResponse.parse(value) }] };
  }
  let previous = -1;
  const frames: Frame[] = [];
  for (const frame of replay.frames) {
    if (
      !Number.isFinite(frame.offsetSeconds) ||
      frame.offsetSeconds < 0 ||
      frame.offsetSeconds <= previous ||
      (frame.receivedAt !== undefined &&
        (!Number.isFinite(frame.receivedAt) || frame.receivedAt <= 0))
    )
      throw new Error("Replay offsets must increase");
    frames.push({
      offsetSeconds: frame.offsetSeconds,
      ...(frame.receivedAt === undefined
        ? {}
        : { receivedAt: frame.receivedAt }),
      data: MetroResponse.parse(frame.data),
    });
    previous = frame.offsetSeconds;
  }
  return { ...replay, frames };
}

export function replayAt(
  replay: Replay,
  startedAt: number,
  now: number,
): MetroData {
  if (replay.kind === "synthetic-network") {
    const travel = replay.travelSeconds!,
      dwell = replay.dwellSeconds!,
      step = travel + dwell;
    const data: MetroData = { resposta: [] };
    for (const line of lineNames) {
      const order = lineOrder[line];
      for (let n = 0; n < 2; n++) {
        const half = (order.length - 1) * step;
        const elapsed =
          (((now - startedAt + n * half + 35) % (2 * half)) + 2 * half) %
          (2 * half);
        const direction = elapsed < half ? 1 : -1;
        const legTime = elapsed % half;
        const legIndex = Math.floor(legTime / step);
        const phaseTime = legTime % step;
        const stationIndex =
          direction === 1 ? legIndex : order.length - 1 - legIndex;
        const terminal = direction === 1 ? order[order.length - 1] : order[0];
        const destinationId = Object.entries(destinos).find(
          ([, d]) => d?.terminal === terminal && d?.line === line,
        )?.[0];
        for (let i = stationIndex; i >= 0 && i < order.length; i += direction) {
          const steps = Math.abs(i - stationIndex);
          if (steps === 0 && phaseTime > dwell) continue;
          const eta = steps === 0 ? 0 : Math.max(0, steps * step - phaseTime);
          data.resposta.push({
            stop_id: order[i],
            cais: `mock:${line}:${order[i]}:${direction}`,
            hora: formatMetroTime(now),
            comboio: `${n + 1}${suffix[line]}`,
            tempoChegada1: String(Math.ceil(eta)),
            destino: destinationId,
            sairServico: 0,
          });
        }
      }
    }
    return data;
  }
  const frames = replay.frames!;
  const elapsed = now - startedAt;
  const frame =
    [...frames].reverse().find((f) => f.offsetSeconds <= elapsed) ?? frames[0];
  const firstValidFrame = frames.find((f) =>
    f.data.resposta.some((r) => parseMetroTime(r.hora) !== null),
  );
  const receivedFrame = frames.find((f) => f.receivedAt !== undefined);
  // Reception time preserves the actual age of each platform, including
  // ancient rows mixed into an otherwise live response. Legacy fixtures lack
  // this clock: anchor their newest observation, never their oldest one.
  const firstTime = receivedFrame
    ? receivedFrame.receivedAt! - receivedFrame.offsetSeconds
    : firstValidFrame
      ? Math.max(
          ...firstValidFrame.data.resposta.map(
            (r) => parseMetroTime(r.hora) ?? -Infinity,
          ),
        ) - firstValidFrame.offsetSeconds
      : startedAt;
  return {
    ...frame.data,
    resposta: frame.data.resposta.map((r) => {
      const sourceTime = parseMetroTime(r.hora, frame.receivedAt);
      return {
        ...r,
        hora:
          sourceTime === null
            ? r.hora
            : formatMetroTime(startedAt + sourceTime - firstTime),
      };
    }),
  };
}
