# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Root manifests (IMPORTANT)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Package manifests for caching
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Dev install only for what we need to build the backend (+ its workspace deps)
RUN pnpm install --filter @metro/backend... --prod=false

# Copy sources
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

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Bring root manifests so pnpm knows the workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Bring ONLY package.json for the workspaces backend depends on
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/
COPY apps/backend/package.json ./apps/backend/

# Production install for backend + its deps across the workspace
RUN pnpm install --prod --filter @metro/backend...

# Copy compiled backend output
COPY --from=build /app/apps/backend/dist ./dist

# Provide workspace files so pnpm's symlinks resolve at runtime
# (lightweight: just copy sources; they’re small)
COPY packages ./packages

# TLS CA bundle (optional; remove if you'll mount as secret)
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
