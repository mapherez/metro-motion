# Metro Lisboa • Live (Realtime Trains)

Metro-motion is a monorepo that shows the full Lisbon Metro network and animates trains in near‑realtime (2–3s) using the official Metro Lisboa API. It’s built for scale and respects the provider’s rate limits by centralizing polling on the backend and broadcasting snapshots to all clients via SSE.

## Highlights

- Single ingestor polls `tempoEspera/Estacao/todos` every 2–3s
- Redis for snapshot storage (TTL) and pub/sub fanout
- Backend serves `GET /now` (latest snapshot) and `GET /stream` (SSE)
- Frontend (React + Vite) renders an SVG map; trains move along canonical paths
- Station positions are extracted from a design SVG and checked into source

## Architecture

```
Metro API  ->  Ingestor (Node)
                 polling 2–3s
                 ↓
             Redis (snapshot + pub/sub)
                 ↓
           API (Fastify)
            ├─ GET /now      (REST, latest snapshot)
            └─ GET /stream   (SSE, push updates)
                 ↓
           Frontend (React)
```

## Monorepo

```
metro-motion/
  apps/
    backend/            # Fastify + SSE + Redis + ingestor
    frontend/           # React + Vite + Zustand
  packages/
    shared-types/       # Zod schemas for Snapshot
    station-data/       # Station orders + names + geometry
    shared-utils/       # Normalization and snapshot utilities
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
  - `GET /healthz` – readiness probe
  - `GET /now` – returns latest validated snapshot (204 if none)
  - `GET /stream` – SSE, broadcasts new snapshots and heartbeats
- Ingestor:
  - Polls Metro API `tempoEspera/Estacao/todos` (2–3s)
  - Backoff on 429/5xx, jittered intervals
  - Writes Redis: `metro:snapshot` (TTL ~15s) and publishes on `metro:events`
  - Authorization: `Authorization: Bearer <METRO_API_KEY>`

Environment (apps/backend/.env)

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

- React + Vite + TypeScript + Zustand
- Map rendering:
  - Canonical line paths live in `@metro/station-data/geometry`
  - Station positions (`cx/cy`) and name labels come from `@metro/station-data/stations` (embedded by the extractor)
  - Train markers use path length interpolation (`getPointAtLength`) to follow curves
- Realtime:
  - On load: `GET /now`
  - Then: `EventSource('/stream')`
  - Simple “last updated” indicator based on snapshot `t`

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

Frontend dev server: http://localhost:5174  → proxies `/api/*` to backend http://localhost:8080

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
  - Use `rediss://` Redis (pub/sub). Upstash REST URLs won’t work for SSE.
  - Set CORS_ORIGIN to your frontend domain.

## Roadmap

- Smooth tweening between snapshots (rAF easing)
- Dwell visualization at stations (`etaNext == 0`)
- Line filter toggles and line status badge (`estadoLinha/todos`)
- PWA (offline snapshot cache)
