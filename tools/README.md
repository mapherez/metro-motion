Tools

This folder contains utility scripts and assets used during development. Nothing here is required at runtime.

Contents

- assets/map.svg: Source SVG used to extract station dot/label positions. Not bundled into the app.
- extract-stations.mjs: One‑off script that parses the SVG and writes `packages/station-data/src/station-positions.ts`.

Optional (mock data)

- You can place a Metro API sample response at `tools/assets/tempoEspera_Estacao_todos.json`.
  If `METRO_MOCK=1` is set in `apps/backend/.env`, the backend ingestor will read this file instead of calling the real API.

Usage

1) Update tools/assets/map.svg with your latest design.
2) Run:

```
pnpm extract:stations
```

This generates (or updates) the TypeScript file with `cx`, `cy`, `labelX`, `labelY` for each `data-stationid` in the SVG. These values are merged into `stationById` at runtime.

Notes

- The app renders lines from canonical path data in `@metro/station-data/geometry`, not from the SVG.
- Station positions are projected to along‑path distances so trains follow the exact curves using `getPointAtLength`.
- You can safely remove or replace `tools/assets/map.svg` without affecting runtime; re‑run the extractor whenever you change it.
- For mock mode, either keep your sample JSON under `tools/assets/tempoEspera_Estacao_todos.json`.
