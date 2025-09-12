# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Root manifests (IMPORTANT: include root package.json so pnpm sees workspaces)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Package manifests for caching
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install all deps needed to build backend and its workspace deps
RUN pnpm install --filter @metro/backend... --prod=false

# Copy sources
COPY packages ./packages
COPY apps/backend ./apps/backend

# Build backend
WORKDIR /app/apps/backend
RUN pnpm run build

# Sanity check: Fastify must exist in the built node_modules graph
WORKDIR /app
RUN node -e "console.log('fastify at:', require.resolve('fastify/package.json'))"


# ---------- Runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy compiled backend output
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./

# Copy the entire workspace node_modules from build (includes .pnpm store)
COPY --from=build /app/node_modules ./node_modules

# Optional: if your backend imports workspace libs at runtime, keep sources
COPY --from=build /app/packages ./packages

# TLS CA bundle (optional; remove if you’ll mount a secret instead)
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
