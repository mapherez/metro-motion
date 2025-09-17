# Metro Lisboa Live (Realtime Trains)

Metro-motion is a monorepo that renders the Lisbon Metro network with realtime train positions sourced from the official Metro Lisboa API. The backend centralises polling and fans out snapshots to connected frontends via Server-Sent Events so that the UI stays lightweight.

## Highlights

- Single ingestor polls `tempoEspera/Estacao/todos` every 2-3 seconds
- Redis snapshot store with pub/sub fanout to API nodes
- Backend exposes `GET /now` (latest snapshot) and `GET /stream` (SSE)
- Frontend (React + Vite + Zustand + Tailwind) renders an SVG map with animated trains
- Desktop shell shows the map fullscreen; mobile shell offers per-line navigation cards
- Dark/light theme toggle with localStorage persistence and accessible focus states

## Architecture

```
Metro API  ->  Ingestor (Node)
                 polling 2-3s
                 |
             Redis (snapshot + pub/sub)
                 |
           API (Fastify)
            |- GET /now      (REST, latest snapshot)
            |- GET /stream   (SSE, push updates)
                 |
           Frontend (React)
```

## Monorepo Layout

```
metro-motion/
  apps/
    backend/            # Fastify + SSE + Redis + ingestor
    frontend/           # React + Vite + Zustand + Tailwind
  packages/
    shared-types/       # Zod schemas for Snapshot
    station-data/       # Station orders + names + geometry
    shared-utils/       # Normalisation and snapshot utilities
  infra/
    docker/             # Backend Dockerfile
    deploy/             # Fly.io manifest and notes
  tools/
    assets/             # Source map.svg for extraction
    extract-stations.mjs# Embeds positions into station-data/stations.ts
  pnpm-workspace.yaml
  turbo.json
```

## Backend

- Framework: Fastify v5
- Endpoints:
  - `GET /healthz` ? readiness probe
  - `GET /now` ? returns latest validated snapshot (204 if none)
  - `GET /stream` ? SSE, broadcasts new snapshots and heartbeats
- Ingestor:
  - Polls Metro API `tempoEspera/Estacao/todos` (2-3s)
  - Backoff on 429/5xx with jittered intervals
  - Writes Redis: `metro:snapshot` (TTL ~15s) and publishes on `metro:events`
  - Authorisation: `Authorization: Bearer <METRO_API_KEY>`

Environment (`apps/backend/.env`):

```
# Metro API
METRO_API_BASE=https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1/
METRO_API_KEY=...           # Bearer token
POLL_INTERVAL_MS=2000
DWELL_SECONDS=25

# Redis (pub/sub capable)
REDIS_URL=rediss://default:<password>@<host>:<port>
REDIS_TTL_SECONDS=15
REDIS_CHANNEL=metro:events
REDIS_SNAPSHOT_KEY=metro:snapshot

# CORS/Security
CORS_ORIGIN=http://localhost:5174
PORT=8080
```

## Frontend

- React + Vite + TypeScript + Zustand + Tailwind v4
- Shell layout with header, desktop footer and mobile tab bar
- React Router nested routes: Home, LineView, About
- Tailwind design tokens via CSS variables with dark/light theme toggle (persisted in `localStorage`)
- Accessible focus rings, 44px touch targets, tooltips that dismiss on Escape or tap-out
- Metro map:
  - Uses canonical line paths from `@metro/station-data/geometry`
  - Station positions (`cx/cy`) and label placements from `@metro/station-data/stations`
  - Train markers interpolate between anchors with `getPointAtLength`
  - Animations driven by `requestAnimationFrame`, paused when the tab is hidden

## Dev Setup

Prereqs: Node 18+ (Node 20 recommended)

```
corepack enable
corepack prepare pnpm@8.15.5 --activate

# Install deps
pnpm install

# Dev (backend + frontend)
pnpm -w dev

# Build all
pnpm -w build
```

Frontend dev server: http://localhost:5174 (proxies `/api/*` to backend http://localhost:8080)

## Station Geometry Extraction

We store precise station dot and label positions in source for consistency. If you update the SVG design, run:

```
pnpm extract:stations
```

This runs `tools/extract-stations.mjs`, which reads `tools/assets/map.svg` and embeds coordinates into `packages/station-data/src/stations.ts` under each station entry.

## Deploy

- Docker: `infra/docker/backend.Dockerfile`
- Fly.io: see `infra/deploy/fly.toml` and `infra/deploy/README.md`
- Notes:
  - Use `rediss://` Redis (pub/sub). Upstash REST URLs will not work for SSE.
  - Set `CORS_ORIGIN` to your frontend domain.

## Roadmap

- Smooth tweening between snapshots (non-linear easing already in place)
- Dwell visualisation at stations (`etaNext == 0`)
- Line filter toggles and line status badge (`estadoLinha/todos`)
- PWA (offline snapshot cache)
