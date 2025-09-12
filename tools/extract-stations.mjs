// One-off extractor: reads apps/frontend/src/assets/map.svg and writes
// packages/station-data/src/station-positions.ts with cx/cy and label coords.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const CANDIDATES = ['tools/assets/map.svg', 'apps/frontend/src/assets/map.svg'];
const SRC = CANDIDATES.find((p) => existsSync(p));
if (!SRC) {
  console.error('No source SVG found. Expected at:', CANDIDATES.join(', '));
  process.exit(1);
}
const STATIONS_TS = 'packages/station-data/src/stations.ts';

const svg = readFileSync(SRC, 'utf8');

const groupRe = /<g[^>]*data-stationid="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g;
const circleRe = /<circle[^>]*\bcx="([0-9.]+)"[^>]*\bcy="([0-9.]+)"[^>]*>/i;
const labelRe = /<(tspan|text)[^>]*\bx="([0-9.]+)"[^>]*\by="([0-9.]+)"[^>]*>/i;

const out = {};
let m;
while ((m = groupRe.exec(svg))) {
  const id = m[1];
  const inner = m[2];
  const c = circleRe.exec(inner);
  const l = labelRe.exec(inner);
  if (!c) continue;
  const cx = parseFloat(c[1]);
  const cy = parseFloat(c[2]);
  const labelX = l ? parseFloat(l[2]) : cx + 8;
  const labelY = l ? parseFloat(l[3]) : cy - 8;
  out[id] = { cx, cy, labelX, labelY };
}

// Embed positions directly into stationById entries
let ts = readFileSync(STATIONS_TS, 'utf8');
let updates = 0;
for (const [id, pos] of Object.entries(out)) {
  // Find entry for e.g. RB: { ... }
  const entryRe = new RegExp(`(${id}\\s*:\\s*{[\\s\\S]*?})`, 'm');
  const m = ts.match(entryRe);
  if (!m) continue;
  const entry = m[1];
  if (/\bcx\s*:/.test(entry)) continue; // already embedded
  // Insert coordinates before the closing }
  const injected = entry.replace(/}$/, `, cx: ${pos.cx}, cy: ${pos.cy}, labelX: ${pos.labelX}, labelY: ${pos.labelY} }`);
  ts = ts.replace(entry, injected);
  updates++;
}
writeFileSync(STATIONS_TS, ts, 'utf8');
console.log(`Embedded positions for ${updates} stations into ${STATIONS_TS}`);
