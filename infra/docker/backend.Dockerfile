# ---------- base with pnpm ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# ---------- deps ----------
FROM base AS deps
WORKDIR /app

# workspace manifests (cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# install deps (with cache)
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# compile all packages + backend
RUN pnpm -r build

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# (Optional) Bundle Metro CA
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

# Copies only the necessary stuff to runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist

# Basic security: non-bot user
RUN addgroup -S nodejs && adduser -S node -G nodejs
USER node

EXPOSE 8080
CMD ["node", "apps/backend/dist/index.js"]
