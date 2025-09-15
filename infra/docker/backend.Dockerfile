# ---------- base ----------
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# ---------- build (dev deps para compilar) ----------
FROM base AS build
WORKDIR /app

# Copiar manifests para cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Instala TUDO (dev + prod) para conseguir compilar TS
RUN pnpm install --frozen-lockfile

# Copia o código
COPY . .

# Compila só o backend e dependências do workspace
RUN pnpm -r --filter @metro/backend... build

# ---------- deploy (prune para prod de 1 workspace) ----------
FROM base AS deploy
WORKDIR /app
# traz a árvore completa compilada do stage build
COPY --from=build /app /app

# Cria um artefacto de produção apenas para o backend,
# com node_modules prunado certinho e sem lixo de outros workspaces
RUN pnpm deploy --filter @metro/backend --prod /app/deploy

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# (Optional) Bundle Metro CA
# COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
# ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

# Copiamos só o artefacto de produção gerado pelo pnpm deploy
COPY --from=deploy /app/deploy ./

# Usa o user 'node' já existente
USER node

EXPOSE 8080
CMD ["sh", "-lc", "node -v; pwd; ls -la; echo '----'; ls -la dist || true; echo '----'; node -e \"import('./dist/server.js').then(m=>{console.log('exports=',Object.keys(m));}).catch(e=>console.error('require error:',e));\"; sleep 3600"]
