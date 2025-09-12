import { useEffect, useMemo, useRef, useState } from 'react';
import { lineOrder, lineNames } from '@metro/station-data';
import type { LineName } from '@metro/station-data';
import { stationById } from '@metro/station-data/stations';
import { linePaths, viewBox } from '@metro/station-data/geometry';
import { useSnapshotStore } from '../state';

type XY = { x: number; y: number };
type PathMap = Partial<Record<LineName, SVGPathElement>>;
type Anchor = { stopId: string; pos: number; xy: XY };

const COLORS: Record<string, string> = {
  verde: '#07AC56',
  amarela: '#FFB83B',
  azul: '#467DED',
  vermelha: '#E7343F'
};

export function MetroMap() {
  const wrapperRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<PathMap>({});
  const [anchors, setAnchors] = useState<Record<string, Anchor[]>>({});
  const snapshot = useSnapshotStore((s) => s.snapshot);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Animation state map keyed by `${line}:${train.id}`
  type AnimState = {
    key: string;
    ln: LineName;
    from: string;
    to: string;
    startProgress: number; // progress at startAtMs (0..1)
    startAtMs: number;
    endAtMs: number; // target progress 1 at this time
  };
  const animRef = useRef<Map<string, AnimState>>(new Map());
  const [tick, setTick] = useState(0); // rAF ticker

  // Collect path elements
  useEffect(() => {
    const svg = wrapperRef.current;
    if (!svg) return;
    const map: PathMap = {
      azul: (svg.querySelector(`#${linePaths.azul.id}`) as SVGPathElement) || undefined,
      vermelha: (svg.querySelector(`#${linePaths.vermelha.id}`) as SVGPathElement) || undefined,
      amarela: (svg.querySelector(`#${linePaths.amarela.id}`) as SVGPathElement) || undefined,
      verde: (svg.querySelector(`#${linePaths.verde.id}`) as SVGPathElement) || undefined
    };
    setPaths(map);
  }, []);

  // Build anchors using measured projection when possible, else evenly spaced
  useEffect(() => {
    const svg = wrapperRef.current;
    const res: Record<string, Anchor[]> = {};
    for (const ln of lineNames as LineName[]) {
      const path = paths[ln];
      if (!path) continue;
      const stops = lineOrder[ln];
      const L = path.getTotalLength?.() ?? 0;
      const arr: Anchor[] = [];

      // Prefer explicit positions from stationById (generated), else fallback to even spacing
      const dotsById = new Map<string, XY>();
      for (const sid of stops) {
        const info = stationById[sid];
        if (info?.cx != null && info?.cy != null) dotsById.set(sid, { x: info.cx, y: info.cy });
      }

      // Project a point to t = s/L along the path
      const projectToT = (p: XY): number => {
        const steps = 400;
        let bestS = 0;
        let bestD = Number.POSITIVE_INFINITY;
        for (let i = 0; i <= steps; i++) {
          const s = (i / steps) * L;
          const pt = path.getPointAtLength?.(s) as any;
          const dx = (pt?.x ?? 0) - p.x;
          const dy = (pt?.y ?? 0) - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD) { bestD = d2; bestS = s; }
        }
        return L > 0 ? bestS / L : 0;
      };

      const segs = Math.max(stops.length - 1, 1);
      for (let i = 0; i < stops.length; i++) {
        const stopId = stops[i];
        let t = segs === 0 ? 0 : i / segs;
        const dot = dotsById.get(stopId);
        if (dot) t = projectToT(dot);
        const s = t * L;
        const pt = path.getPointAtLength?.(s) as any;
        arr.push({ stopId, pos: t, xy: { x: pt?.x ?? 0, y: pt?.y ?? 0 } });
      }
      res[ln] = arr;
    }
    setAnchors(res);
  }, [paths]);

  // rAF loop at ~30fps to drive animation
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      if (t - last >= 1000 / 30) {
        setTick((x) => (x + 1) & 1023);
        last = t;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Ease in-out for smoother accel/brake
  const easeInOut = (u: number) => {
    const x = Math.max(0, Math.min(1, u));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };

  // Sync/adjust animation state whenever a new snapshot arrives
  useEffect(() => {
    if (!snapshot) return;
    const nowMs = performance.now();
    const ageSec = Math.max(0, Date.now() / 1000 - snapshot.t);
    const nextKeys = new Set<string>();
    for (const ln of lineNames as LineName[]) {
      const trains = snapshot.lines[ln]?.trains || [];
      for (const tr of trains) {
        const key = `${ln}:${tr.id}`;
        nextKeys.add(key);
        const prev = animRef.current.get(key);
        const remainingSec = Math.max(0.3, tr.etaNext - ageSec);
        const frac = tr.etaNext > 0 ? Math.min(ageSec, tr.etaNext) / tr.etaNext : 0;
        const pNow = Math.max(0, Math.min(1, tr.progress01 + (1 - tr.progress01) * frac));
        if (!prev || prev.from !== tr.from || prev.to !== tr.to) {
          // New segment or new train: start from current predicted progress to arrival at 1
          animRef.current.set(key, {
            key,
            ln,
            from: tr.from,
            to: tr.to,
            startProgress: pNow,
            startAtMs: nowMs,
            endAtMs: nowMs + remainingSec * 1000
          });
        } else {
          // Same segment: resync speed and target with latest ETA
          const dur = prev.endAtMs - prev.startAtMs || 1;
          const u = Math.max(0, Math.min(1, (nowMs - prev.startAtMs) / dur));
          const cur = prev.startProgress + (1 - prev.startProgress) * easeInOut(u);
          animRef.current.set(key, {
            key,
            ln,
            from: tr.from,
            to: tr.to,
            startProgress: Math.max(cur, pNow * 0.98), // avoid snapping backward
            startAtMs: nowMs,
            endAtMs: nowMs + Math.max(300, remainingSec * 1000)
          });
        }
      }
    }
    // Prune trains no longer present
    for (const k of Array.from(animRef.current.keys())) {
      if (!nextKeys.has(k)) animRef.current.delete(k);
    }
  }, [snapshot]);

  // When a segment finishes before the next snapshot, dwell at station and wait for next data
  useEffect(() => {
    const now = performance.now();
    const DWELL_MS = 1200; // brief stop at stations
    for (const st of Array.from(animRef.current.values())) {
      const dur = Math.max(1, st.endAtMs - st.startAtMs);
      const u = (now - st.startAtMs) / dur;
      if (u < 1) continue;
      // Hold at the station briefly; next snapshot will provide the next leg
      animRef.current.set(st.key, {
        ...st,
        startProgress: 1,
        startAtMs: now,
        endAtMs: now + DWELL_MS
      });
    }
  }, [tick]);

  // Train positions along curves (animated)
  const trainPoints = useMemo(() => {
    const out: Array<{ key: string; ln: string; xy: XY; angle: number }> = [];
    for (const ln of lineNames as LineName[]) {
      const path = paths[ln];
      const a = anchors[ln];
      if (!path || !a || a.length === 0) continue;
      const L = path.getTotalLength?.() ?? 0;
      const indexMap = new Map<string, number>();
      a.forEach((an, idx) => indexMap.set(an.stopId, idx));
      // Pull current anim states for this line
      for (const st of animRef.current.values()) {
        if (st.ln !== ln) continue;
        const iFrom = indexMap.get(st.from);
        const iTo = indexMap.get(st.to);
        if (iFrom == null || iTo == null) continue;
        const u = (performance.now() - st.startAtMs) / Math.max(1, st.endAtMs - st.startAtMs);
        const prog = Math.max(0, Math.min(1, st.startProgress + (1 - st.startProgress) * easeInOut(u)));
        const tFrom = a[iFrom].pos;
        const tTo = a[iTo].pos;
        const t = tFrom + (tTo - tFrom) * prog;
        const s = t * L;
        const pt = path.getPointAtLength?.(s) as any;
        // Approximate tangent angle for marker rotation
        const delta = 2; // px along path
        const p0 = path.getPointAtLength?.(Math.max(0, s - delta)) as any;
        const p1 = path.getPointAtLength?.(Math.min(L, s + delta)) as any;
        // Face toward the next station based on along-path position
        // Using tTo>tFrom ties rotation to the actual SVG path direction,
        // avoiding mismatches when path parameterization differs from index order.
        const forward = tTo > tFrom;
        let angleRad = Math.atan2((p1?.y ?? 0) - (p0?.y ?? 0), (p1?.x ?? 0) - (p0?.x ?? 0));
        if (!forward) angleRad += Math.PI; // flip for reverse direction
        const angle = (angleRad * 180) / Math.PI;
        out.push({ key: st.key, ln, xy: { x: pt?.x ?? 0, y: pt?.y ?? 0 }, angle });
      }
    }
    return out;
  }, [paths, anchors, tick]);

  return (
    <div
      style={{
        width: 1400,
        margin: '0 auto',
        border: '1px solid #4443',
        borderRadius: 8,
        position: 'relative'
      }}
      >
      {/* Base map using canonical paths */}
      <svg
        ref={wrapperRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        onClick={() => setSelectedKey(null)}
      >
        {/* Lines (driven by geometry.kind) */}
        {(['azul','vermelha','amarela','verde'] as LineName[]).map((ln) => {
          const lp = linePaths[ln];
          const color = COLORS[ln];
          if (lp.kind === 'stroke') {
            return (
              <path
                key={ln}
                id={lp.id}
                d={lp.d}
                stroke={color}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          return <path key={ln} id={lp.id} d={lp.d} fill={color} />;
        })}

        {/* Station dots + hover labels using anchors */}
        {(lineNames as LineName[]).map((ln: LineName) => (
          <g key={`stations-${ln}`}>
            {(anchors[ln] || []).map((an) => {
              const info = stationById[an.stopId];
              const dx = info?.cx ?? an.xy.x;
              const dy = info?.cy ?? an.xy.y;
              // Label absolute placement (fallback to offset if not provided)
              const lxAbs = info?.labelX ?? dx + 8;
              const lyAbs = info?.labelY ?? dy - 8;
              const lx = lxAbs - dx;
              const ly = lyAbs - dy;
              return (
                <g key={`st-${ln}-${an.stopId}`} className="station" transform={`translate(${dx},${dy})`}>
                  <circle r={5} fill="#fff" stroke={COLORS[ln]} strokeWidth={4} />
                  <text className="label" x={lx} y={ly} fontSize={10} fill="#25282B">{info?.name ?? an.stopId}</text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Trains overlay (on top) */}
        <g id="train-layer" style={{ pointerEvents: 'auto' }}>
          {trainPoints.map((tp) => (
            <g
              key={tp.key}
              transform={`translate(${tp.xy.x},${tp.xy.y}) rotate(${tp.angle})`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedKey(tp.key);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Simple train glyph: rounded body + nose */}
              <rect x={-8} y={-5} width={16} height={10} rx={3} fill={COLORS[tp.ln]} stroke="#111" strokeWidth={1} />
              <path d="M8,-5 L14,0 L8,5 Z" fill={COLORS[tp.ln]} stroke="#111" strokeWidth={1} />
              {/* windows */}
              <rect x={-4} y={-2.5} width={3} height={5} rx={1} fill="#fff" opacity={0.85} />
              <rect x={0} y={-2.5} width={3} height={5} rx={1} fill="#fff" opacity={0.85} />
            </g>
          ))}
        </g>

        {/* Tooltip following selected train */}
        {selectedKey && snapshot && (() => {
          const tp = trainPoints.find(t => t.key === selectedKey);
          if (!tp) return null;
          const [ln, id] = selectedKey.split(':', 2) as [LineName, string];
          const tr = snapshot.lines[ln]?.trains.find(t => t.id === id);
          if (!tr) return null;
          const nextName = stationById[tr.to]?.name || tr.to;
          const eta = tr.etaNext;
          const mins = Math.floor(eta / 60);
          const secs = eta % 60;
          const etaStr = eta === 0 ? 'arriving' : `${mins}:${secs.toString().padStart(2, '0')}`;

          // Sizing params
          const fsTitle = 9; // ~70%
          const fsSub = 8;
          const padX = 10; // ~20px total horizontal padding
          const padY = 6;
          const lineGap = 4;
          const lineHeight1 = fsTitle + lineGap;
          const lineHeight2 = fsSub;
          const approx = (text: string, fs: number) => Math.max(30, text.length * fs * 0.6);
          const wText = Math.max(approx(`Next: ${nextName}`, fsTitle), approx(`ETA: ${etaStr}`, fsSub));
          const w = Math.ceil(wText + padX * 2);
          const h = Math.ceil(padY * 2 + lineHeight1 + lineHeight2);

          // Default position: close and centered vertically beside the train
          let sideRight = true;
          let boxX = tp.xy.x + 8; // closer to train
          let boxY = tp.xy.y - h / 2;
          // Flip to left if it would overflow to the right
          if (boxX + w > viewBox.width) {
            sideRight = false;
            boxX = tp.xy.x - 8 - w;
          }
          // Clamp vertically within viewBox
          if (boxY < 2) boxY = 2;
          if (boxY + h > viewBox.height - 2) boxY = viewBox.height - h - 2;
          return (
            <g transform={`translate(${boxX},${boxY})`} onClick={(e) => e.stopPropagation()}>
              {/* Box */}
              <rect x={0} y={0} width={w} height={h} rx={6} fill="#fff" stroke="#333" strokeWidth={1} opacity={0.96} />
              {/* Arrow pointing to the train */}
              {sideRight ? (
                // Arrow pointing toward the train on the left: tip at (-6, h/2)
                <path d={`M0 ${h/2 - 4} L0 ${h/2 + 4} L-6 ${h/2} Z`} fill="#fff" stroke="#333" strokeWidth={1} />
              ) : (
                // Arrow pointing toward the train on the right: tip at (w+6, h/2)
                <path d={`M${w} ${h/2 - 4} L${w} ${h/2 + 4} L${w + 6} ${h/2} Z`} fill="#fff" stroke="#333" strokeWidth={1} />
              )}
              <text x={padX} y={padY + fsTitle} fontSize={fsTitle} fill="#111">Next: {nextName}</text>
              <text x={padX} y={padY + lineHeight1 + fsSub - 1} fontSize={fsSub} fill="#555">ETA: {etaStr}</text>
            </g>
          );
        })()}
      </svg>
      <style>{`.station .label{opacity:0;transition:opacity .12s ease-in-out;pointer-events:none}.station:hover .label{opacity:1}`}</style>
    </div>
  );
}
