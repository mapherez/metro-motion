# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Root manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Package manifests (cache)
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Instalar deps para build do backend + deps do workspace
RUN pnpm install --filter @metro/backend... --prod=false

# Código
COPY packages ./packages
COPY apps/backend ./apps/backend

# Build backend
WORKDIR /app/apps/backend
RUN pnpm run build


# ---------- Runtime stage ----------
FROM node:20-alpine AS runner

# ⚠️ Arrancar a partir do package do backend
WORKDIR /app/apps/backend
ENV NODE_ENV=production
ENV PORT=8080

# Output compilado e package.json do backend
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./package.json

# Copiar a store do pnpm e os links do backend
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules ./node_modules

# (Opcional) se importas workspaces em runtime
COPY --from=build /app/packages /app/packages

# TLS (opcional – remove se não precisares)
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
