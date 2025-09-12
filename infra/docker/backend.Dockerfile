# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm via Corepack (same version as your repo)
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Copy workspace manifests first for better caching
COPY pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install only what's needed for the backend and its deps
RUN pnpm install --filter @metro/backend... --prod=false

# Now copy sources
COPY packages ./packages
COPY apps/backend ./apps/backend

# Build backend
WORKDIR /app/apps/backend
RUN pnpm run build


# ---------- Runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy build output and runtime deps
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./
COPY --from=build /app/apps/backend/node_modules ./node_modules

# TLS: copy CA bundle and tell Node to trust it in addition to system CAs
# (If you later switch to a Secret File in Northflank, remove the COPY
#  below and just keep the ENV pointing to the mounted path.)
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
