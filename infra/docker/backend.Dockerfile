FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV TURBO_TELEMETRY_DISABLED=1
# Pin pnpm without relying on Corepack downloads/signature changes at runtime.
RUN npm install --global pnpm@8.15.5
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm --filter @metro/backend test
RUN pnpm --filter @metro/backend deploy --prod /app/deploy

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NODE_EXTRA_CA_CERTS=/app/certs/metro-ca-bundle.pem \
    FRONTEND_DIST_DIR=/app/frontend \
    METRO_MOCK_FILE=/app/fixtures/metro.json
COPY --from=build --chown=node:node /app/deploy ./
COPY --from=build --chown=node:node /app/apps/frontend/dist ./frontend
COPY --chown=node:node infra/certs/metro-ca-bundle.pem ./certs/metro-ca-bundle.pem
COPY --chown=node:node tools/assets/mock-sequence.json ./fixtures/metro.json
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
