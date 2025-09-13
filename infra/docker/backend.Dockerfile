# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Root manifests (workspace awareness)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Package manifests (cache)
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Dev deps para construir backend + deps do workspace
RUN pnpm install --filter @metro/backend... --prod=false

# Código fonte
COPY packages ./packages
COPY apps/backend ./apps/backend

# Build do backend
WORKDIR /app/apps/backend
RUN pnpm run build


# ---------- Runtime stage ----------
FROM node:20-alpine AS runner

# Não dependemos do WORKDIR; vamos usar caminhos absolutos
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copiar a store do pnpm (raiz) e os links do backend
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules /app/apps/backend/node_modules

# Copiar o output compilado e package.json do backend
COPY --from=build /app/apps/backend/dist /app/apps/backend/dist
COPY --from=build /app/apps/backend/package.json /app/apps/backend/package.json

# (Opcional) se importas workspaces em runtime
COPY --from=build /app/packages /app/packages

# TLS (opcional)
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080

# ABSOLUTE path — não depende do WORKDIR
CMD ["node", "/app/apps/backend/dist/index.js"]
