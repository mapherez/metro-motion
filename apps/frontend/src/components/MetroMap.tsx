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

  // Train positions along curves
  const trainPoints = useMemo(() => {
    const out: Array<{ key: string; ln: string; xy: XY; angle: number }> = [];
    if (!snapshot) return out;
    for (const ln of lineNames as LineName[]) {
      const trains = snapshot.lines[ln]?.trains || [];
      const path = paths[ln];
      const a = anchors[ln];
      if (!path || !a || a.length === 0) continue;
      const L = path.getTotalLength?.() ?? 0;
      const indexMap = new Map<string, number>();
      a.forEach((an, idx) => indexMap.set(an.stopId, idx));
      for (const tr of trains) {
        const iFrom = indexMap.get(tr.from);
        const iTo = indexMap.get(tr.to);
        if (iFrom == null || iTo == null) continue;
        const tFrom = a[iFrom].pos;
        const tTo = a[iTo].pos;
        const t = tFrom + (tTo - tFrom) * Math.max(0, Math.min(1, tr.progress01));
        const s = t * L;
        const pt = path.getPointAtLength?.(s) as any;
        // Approximate tangent angle for marker rotation
        const delta = 2; // px along path
        const p0 = path.getPointAtLength?.(Math.max(0, s - delta)) as any;
        const p1 = path.getPointAtLength?.(Math.min(L, s + delta)) as any;
        // Face toward the next station along the canonical line order
        const forward = (iTo ?? 0) > (iFrom ?? 0);
        let angleRad = Math.atan2((p1?.y ?? 0) - (p0?.y ?? 0), (p1?.x ?? 0) - (p0?.x ?? 0));
        if (!forward) angleRad += Math.PI; // flip for reverse direction
        const angle = (angleRad * 180) / Math.PI;
        out.push({ key: `${ln}:${tr.id}`, ln, xy: { x: pt?.x ?? 0, y: pt?.y ?? 0 }, angle });
      }
    }
    return out;
  }, [snapshot, paths, anchors]);

  return (
    <div style={{ border: '1px solid #4443', borderRadius: 8, position: 'relative' }}>
      {/* Base map using canonical paths */}
      <svg
        ref={wrapperRef}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Lines */}
        <path id={linePaths.azul.id} d={linePaths.azul.d} stroke="#467DED" strokeWidth={8} fill="none" strokeLinecap="round" />
        <path id={linePaths.vermelha.id} d={linePaths.vermelha.d} fill="#E7343F" />
        <path id={linePaths.amarela.id} d={linePaths.amarela.d} stroke="#FFB83B" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path id={linePaths.verde.id} d={linePaths.verde.d} stroke="#07AC56" strokeWidth={8} fill="none" strokeLinecap="round" />

        {/* Station dots + hover labels using anchors */}
        {(lineNames as LineName[]).map((ln: LineName) => (
          <g key={`stations-${ln}`}>
            {(anchors[ln] || []).map((an) => (
              <g key={`st-${ln}-${an.stopId}`} className="station" transform={`translate(${an.xy.x},${an.xy.y})`}>
                <circle r={5} fill="#fff" stroke={COLORS[ln]} strokeWidth={4} />
                <text className="label" x={8} y={-8} fontSize={10} fill="#25282B">{stationById[an.stopId]?.name ?? an.stopId}</text>
              </g>
            ))}
          </g>
        ))}

        {/* Trains overlay (on top) */}
        <g id="train-layer" style={{ pointerEvents: 'none' }}>
          {trainPoints.map((tp) => (
            <g key={tp.key} transform={`translate(${tp.xy.x},${tp.xy.y}) rotate(${tp.angle})`}>
              {/* Simple train glyph: rounded body + nose */}
              <rect x={-8} y={-5} width={16} height={10} rx={3} fill={COLORS[tp.ln]} stroke="#111" strokeWidth={1} />
              <path d="M8,-5 L14,0 L8,5 Z" fill={COLORS[tp.ln]} stroke="#111" strokeWidth={1} />
              {/* windows */}
              <rect x={-4} y={-2.5} width={3} height={5} rx={1} fill="#fff" opacity={0.85} />
              <rect x={0} y={-2.5} width={3} height={5} rx={1} fill="#fff" opacity={0.85} />
            </g>
          ))}
        </g>
      </svg>
      <style>{`.station .label{opacity:0;transition:opacity .12s ease-in-out;pointer-events:none}.station:hover .label{opacity:1}`}</style>
    </div>
  );
}
