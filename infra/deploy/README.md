# Backend Deploy

This folder contains example configuration to deploy the backend.

- Service: Node.js Fastify app exposing `PORT` (default 8080)
- Image: built from `infra/docker/backend.Dockerfile`
- Env: use `apps/backend/.env.example` as reference

## Fly.io

1. Install `flyctl` and log in
2. Create app: `fly launch --no-deploy` and select Dockerfile path
3. Set env vars (Redis, CORS, METRO API): `fly secrets set ...`
4. Deploy: `fly deploy -c infra/deploy/fly.toml --dockerfile infra/docker/backend.Dockerfile`

## Northflank

- Create a service from your Git repo
- Build config: Dockerfile path `infra/docker/backend.Dockerfile`
- Expose port `8080`
- Set env vars from `.env.example`

## Health and Scaling

- Health endpoint: `GET /healthz`
- Autoscaling: 1-2 replicas to start (SSE friendly)
- Redis: Use a `rediss://` endpoint that supports pub/sub. Upstash recommended. Set `REDIS_URL`, `REDIS_TTL_SECONDS`, `REDIS_CHANNEL`, `REDIS_SNAPSHOT_KEY`.
- CORS: set `CORS_ORIGIN` to your frontend domain.
