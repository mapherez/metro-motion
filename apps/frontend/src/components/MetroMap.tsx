import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { lineOrder, lineNames } from "@metro/station-data";
import type { LineName } from "@metro/station-data";
import { stationById } from "@metro/station-data/stations";
import { linePaths, viewBox } from "@metro/station-data/geometry";
import { useSnapshotStore } from "../state";

type XY = { x: number; y: number };
type PathMap = Partial<Record<LineName, SVGPathElement>>;
type Anchor = { stopId: string; pos: number; xy: XY };

type AnimState = {
  key: string;
  ln: LineName;
  from: string;
  to: string;
  startProgress: number;
  startAtMs: number;
  endAtMs: number;
};

const COLORS: Record<LineName, string> = {
  azul: "#467DED",
  amarela: "#FFB83B",
  verde: "#07AC56",
  vermelha: "#E7343F",
};

const LINE_LABEL: Record<LineName, string> = {
  azul: "Azul",
  amarela: "Amarela",
  verde: "Verde",
  vermelha: "Vermelha",
};

const RAF_INTERVAL = 1000 / 60;
const TRAIN_FOCUS_SIZE = 44;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function formatEtaShort(raw: number | undefined | null): string {
  if (raw == null || Number.isNaN(raw)) return "--";
  if (raw <= 0) return "arriving";
  const minutes = Math.floor(raw / 60);
  const seconds = Math.floor(raw % 60);
  return minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;
}

function formatEtaAnnounce(raw: number | undefined | null): string {
  if (raw == null || Number.isNaN(raw)) return "time unknown";
  if (raw <= 0) return "arriving now";
  const minutes = Math.floor(raw / 60);
  const seconds = Math.floor(raw % 60);
  if (minutes > 0 && seconds > 0) {
    return `arriving in ${minutes} minutes and ${seconds} seconds`;
  }
  if (minutes > 0) return `arriving in ${minutes} minutes`;
  return `arriving in ${seconds} seconds`;
}

const easeInOut = (u: number) => {
  const x = clamp(u, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function MetroMap() {
  const wrapperRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<PathMap>({});
  const [anchors, setAnchors] = useState<Record<string, Anchor[]>>({});
  const snapshot = useSnapshotStore((s) => s.snapshot);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const animRef = useRef<Map<string, AnimState>>(new Map());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const svg = wrapperRef.current;
    if (!svg) return;
    const map: PathMap = {
      azul: (svg.querySelector(`#${linePaths.azul.id}`) as SVGPathElement) || undefined,
      vermelha: (svg.querySelector(`#${linePaths.vermelha.id}`) as SVGPathElement) || undefined,
      amarela: (svg.querySelector(`#${linePaths.amarela.id}`) as SVGPathElement) || undefined,
      verde: (svg.querySelector(`#${linePaths.verde.id}`) as SVGPathElement) || undefined,
    };
    setPaths(map);
  }, []);

  useEffect(() => {
    const result: Record<string, Anchor[]> = {};
    for (const ln of lineNames as LineName[]) {
      const path = paths[ln];
      if (!path) continue;
      const stops = lineOrder[ln];
      const length = path.getTotalLength?.() ?? 0;
      const anchorsForLine: Anchor[] = [];

      const dotsById = new Map<string, XY>();
      for (const stopId of stops) {
        const info = stationById[stopId];
        if (info?.cx != null && info?.cy != null) {
          dotsById.set(stopId, { x: info.cx, y: info.cy });
        }
      }

      const projectToT = (point: XY): number => {
        const steps = 400;
        let bestS = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i <= steps; i++) {
          const s = (i / steps) * length;
          const pt = path.getPointAtLength?.(s) as SVGPoint | undefined;
          const dx = (pt?.x ?? 0) - point.x;
          const dy = (pt?.y ?? 0) - point.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestDistance) {
            bestDistance = d2;
            bestS = s;
          }
        }
        return length > 0 ? bestS / length : 0;
      };

      const segments = Math.max(stops.length - 1, 1);
      for (let i = 0; i < stops.length; i++) {
        const stopId = stops[i];
        let t = segments === 0 ? 0 : i / segments;
        const dot = dotsById.get(stopId);
        if (dot) t = projectToT(dot);
        const s = t * length;
        const pt = path.getPointAtLength?.(s) as SVGPoint | undefined;
        anchorsForLine.push({ stopId, pos: t, xy: { x: pt?.x ?? 0, y: pt?.y ?? 0 } });
      }
      result[ln] = anchorsForLine;
    }
    setAnchors(result);
  }, [paths]);

  useEffect(() => {
    let raf = 0;
    let running = false;
    let last = 0;

    const step = (time: number) => {
      if (!running) return;
      if (time - last >= RAF_INTERVAL) {
        setTick((value) => (value + 1) & 1023);
        last = time;
      }
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedKey(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    const nowMs = performance.now();
    const ageSec = Math.max(0, Date.now() / 1000 - snapshot.t);
    const nextKeys = new Set<string>();

    for (const ln of lineNames as LineName[]) {
      const trains = snapshot.lines[ln]?.trains || [];
      for (const train of trains) {
        const key = `${ln}:${train.id}`;
        nextKeys.add(key);
        const prev = animRef.current.get(key);
        const remainingSec = Math.max(0.3, train.etaNext - ageSec);
        const frac = train.etaNext > 0 ? Math.min(ageSec, train.etaNext) / train.etaNext : 0;
        const predicted = clamp(train.progress01 + (1 - train.progress01) * frac, 0, 1);

        if (!prev || prev.from !== train.from || prev.to !== train.to) {
          animRef.current.set(key, {
            key,
            ln,
            from: train.from,
            to: train.to,
            startProgress: predicted,
            startAtMs: nowMs,
            endAtMs: nowMs + remainingSec * 1000,
          });
        } else {
          const duration = Math.max(1, prev.endAtMs - prev.startAtMs);
          const u = clamp((nowMs - prev.startAtMs) / duration, 0, 1);
          const current = prev.startProgress + (1 - prev.startProgress) * easeInOut(u);
          animRef.current.set(key, {
            key,
            ln,
            from: train.from,
            to: train.to,
            startProgress: Math.max(current, predicted * 0.98),
            startAtMs: nowMs,
            endAtMs: nowMs + Math.max(300, remainingSec * 1000),
          });
        }
      }
    }

    for (const key of Array.from(animRef.current.keys())) {
      if (!nextKeys.has(key)) {
        animRef.current.delete(key);
      }
    }
  }, [snapshot]);

  useEffect(() => {
    const now = performance.now();
    const DWELL_MS = 1200;
    for (const state of Array.from(animRef.current.values())) {
      const duration = Math.max(1, state.endAtMs - state.startAtMs);
      const u = (now - state.startAtMs) / duration;
      if (u < 1) continue;
      animRef.current.set(state.key, {
        ...state,
        startProgress: 1,
        startAtMs: now,
        endAtMs: now + DWELL_MS,
      });
    }
  }, [tick]);

  const trainPoints = useMemo(() => {
    const out: Array<{ key: string; ln: LineName; xy: XY; angle: number }> = [];
    const now = performance.now();
    for (const ln of lineNames as LineName[]) {
      const path = paths[ln];
      const anchorsForLine = anchors[ln];
      if (!path || !anchorsForLine || anchorsForLine.length === 0) continue;
      const length = path.getTotalLength?.() ?? 0;
      const indexMap = new Map<string, number>();
      anchorsForLine.forEach((anchor, idx) => indexMap.set(anchor.stopId, idx));

      for (const state of animRef.current.values()) {
        if (state.ln !== ln) continue;
        const iFrom = indexMap.get(state.from);
        const iTo = indexMap.get(state.to);
        if (iFrom == null || iTo == null) continue;

        const u = (now - state.startAtMs) / Math.max(1, state.endAtMs - state.startAtMs);
        const progress = clamp(
          state.startProgress + (1 - state.startProgress) * easeInOut(u),
          0,
          1
        );
        const tFrom = anchorsForLine[iFrom].pos;
        const tTo = anchorsForLine[iTo].pos;
        const t = tFrom + (tTo - tFrom) * progress;
        const s = t * length;
        const point = path.getPointAtLength?.(s) as SVGPoint | undefined;

        const delta = 2;
        const p0 = path.getPointAtLength?.(Math.max(0, s - delta)) as SVGPoint | undefined;
        const p1 = path.getPointAtLength?.(Math.min(length, s + delta)) as SVGPoint | undefined;
        const forward = tTo > tFrom;
        let angleRad = Math.atan2((p1?.y ?? 0) - (p0?.y ?? 0), (p1?.x ?? 0) - (p0?.x ?? 0));
        if (!forward) angleRad += Math.PI;
        const angle = (angleRad * 180) / Math.PI;
        out.push({ key: state.key, ln, xy: { x: point?.x ?? 0, y: point?.y ?? 0 }, angle });
      }
    }
    return out;
  }, [paths, anchors, tick]);

  useEffect(() => {
    if (!selectedKey) return;
    const exists = trainPoints.some((tp) => tp.key === selectedKey);
    if (!exists) {
      setSelectedKey(null);
    }
  }, [trainPoints, selectedKey]);

  const focusHalf = TRAIN_FOCUS_SIZE / 2;

  return (
    <div
      className="relative mx-auto w-full max-w-[1400px] rounded-3xl border border-white/10 bg-[var(--bg-soft)]/70 p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.65)] backdrop-blur"
      style={{ touchAction: "pan-y" }}
    >
      <svg
        ref={wrapperRef}
        role="img"
        aria-label="Mapa do Metro de Lisboa"
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="block h-auto w-full select-none"
        onClick={() => setSelectedKey(null)}
      >
        <defs>
          <radialGradient id="hl">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#fff" stopOpacity={0} />
          </radialGradient>
        </defs>

        {(["azul", "vermelha", "amarela", "verde"] as LineName[]).map((ln) => {
          const pathDef = linePaths[ln];
          const color = COLORS[ln];
          if (pathDef.kind === "stroke") {
            return (
              <path
                key={ln}
                id={pathDef.id}
                d={pathDef.d}
                stroke={color}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            );
          }
          return <path key={ln} id={pathDef.id} d={pathDef.d} fill={color} pointerEvents="none" />;
        })}

        {(lineNames as LineName[]).map((ln) => (
          <g key={`stations-${ln}`}>
            {(anchors[ln] || []).map((anchor) => {
              const info = stationById[anchor.stopId];
              const dx = info?.cx ?? anchor.xy.x;
              const dy = info?.cy ?? anchor.xy.y;
              const labelXAbs = info?.labelX ?? dx + 8;
              const labelYAbs = info?.labelY ?? dy - 8;
              const lx = labelXAbs - dx;
              const ly = labelYAbs - dy;
              return (
                <g key={`station-${ln}-${anchor.stopId}`} className="station" transform={`translate(${dx},${dy})`}>
                  <circle r={5} fill="#fff" stroke={COLORS[ln]} strokeWidth={4} />
                  <text className="label" x={lx} y={ly} fontSize={10} fill="#25282B">
                    {info?.name ?? anchor.stopId}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        <g id="train-layer" style={{ pointerEvents: "auto" }}>
          {trainPoints.map((tp) => {
            const [lineId, trainId] = tp.key.split(":", 2) as [LineName, string];
            const meta = snapshot?.lines[lineId]?.trains.find((train) => train.id === trainId);
            const destination = meta ? stationById[meta.to]?.name ?? meta.to : "destino desconhecido";
            const etaSeconds = meta?.etaNext;
            const ariaLabel = `Train on line ${LINE_LABEL[lineId]} to ${destination}, ${formatEtaAnnounce(etaSeconds)}.`;
            const pressed = selectedKey === tp.key;

            return (
              <g
                key={tp.key}
                transform={`translate(${tp.xy.x},${tp.xy.y}) rotate(${tp.angle})`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedKey(tp.key);
                  if (event.detail > 0) {
                    event.currentTarget.blur();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedKey(tp.key);
                  }
                }}
                onFocus={() => setSelectedKey(tp.key)}
                role="button"
                tabIndex={0}
                aria-label={ariaLabel}
                aria-pressed={pressed}
                className="train-marker"
                style={{
                  cursor: "pointer",
                  outline: "none",
                  "--focus-ring": COLORS[lineId],
                } as CSSProperties}
              >
                <rect
                  className="focus-target"
                  x={-focusHalf}
                  y={-focusHalf}
                  width={TRAIN_FOCUS_SIZE}
                  height={TRAIN_FOCUS_SIZE}
                  rx={12}
                  fill="transparent"
                  stroke="transparent"
                  strokeWidth={2}
                />
                <rect
                  x={-10}
                  y={-6}
                  width={20}
                  height={12}
                  rx={4}
                  fill={COLORS[tp.ln]}
                  stroke="#111"
                  strokeWidth={1}
                />
                <rect x={-5.5} y={-3} width={3.5} height={6} rx={1} fill="#fff" opacity={0.9} />
                <rect x={-1} y={-3} width={3.5} height={6} rx={1} fill="#fff" opacity={0.9} />
                <circle cx={10} cy={0} r={1.4} fill="#fff" stroke="#111" strokeWidth={1} />
              </g>
            );
          })}
        </g>

        {selectedKey && snapshot && (() => {
          const trainPoint = trainPoints.find((item) => item.key === selectedKey);
          if (!trainPoint) return null;
          const [lineId, trainId] = selectedKey.split(":", 2) as [LineName, string];
          const train = snapshot.lines[lineId]?.trains.find((item) => item.id === trainId);
          if (!train) return null;

          const etaShort = formatEtaShort(train.etaNext);
          const nextName = stationById[train.to]?.name ?? train.to;

          const title = `Next: ${nextName}`;
          const subtitle = `ETA: ${etaShort}`;

          const fontTitle = 9;
          const fontSubtitle = 8;
          const padX = 12;
          const padY = 8;
          const gap = 4;
          const approx = (text: string, size: number) => Math.max(40, text.length * size * 0.62);
          const width = Math.ceil(Math.max(approx(title, fontTitle), approx(subtitle, fontSubtitle)) + padX * 2);
          const height = Math.ceil(padY * 2 + fontTitle + gap + fontSubtitle);

          let sideRight = true;
          let boxX = trainPoint.xy.x + 10;
          let boxY = trainPoint.xy.y - height / 2;
          if (boxX + width > viewBox.width) {
            sideRight = false;
            boxX = trainPoint.xy.x - 10 - width;
          }
          boxY = clamp(boxY, 2, viewBox.height - height - 2);

          return (
            <g transform={`translate(${boxX},${boxY})`} onClick={(event) => event.stopPropagation()} aria-live="polite">
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                rx={10}
                fill="var(--tooltip-bg)"
                stroke="var(--tooltip-border)"
                strokeWidth={1}
              />
              {sideRight ? (
                <path
                  d={`M0 ${height / 2 - 5} L0 ${height / 2 + 5} L-8 ${height / 2} Z`}
                  fill="var(--tooltip-bg)"
                  stroke="var(--tooltip-border)"
                  strokeWidth={1}
                />
              ) : (
                <path
                  d={`M${width} ${height / 2 - 5} L${width} ${height / 2 + 5} L${width + 8} ${height / 2} Z`}
                  fill="var(--tooltip-bg)"
                  stroke="var(--tooltip-border)"
                  strokeWidth={1}
                />
              )}
              <text x={padX} y={padY + fontTitle} fontSize={fontTitle} fill="var(--tooltip-fg)">
                {title}
              </text>
              <text
                x={padX}
                y={padY + fontTitle + gap + fontSubtitle - 1}
                fontSize={fontSubtitle}
                fill="var(--tooltip-muted)"
              >
                {subtitle}
              </text>
            </g>
          );
        })()}
      </svg>
      <style>{`
        .station .label{opacity:0;transition:opacity .12s ease-out;pointer-events:none}
        @media (hover:hover){.station:hover .label{opacity:1}}
        @media (min-width:768px){.station .label{opacity:1}}
        .train-marker:focus,.train-marker:focus-visible{outline:none}
        #train-layer .focus-target{transition:stroke .12s ease-in-out}
        #train-layer g:focus-visible .focus-target{stroke:var(--focus-ring)}
      `}</style>
    </div>
  );
}









