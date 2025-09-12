# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Copy workspace manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install deps needed for build
RUN pnpm install --filter @metro/backend...

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

# Copy only package.json + lock for backend
COPY apps/backend/package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Install only prod deps for backend
RUN pnpm install --prod --filter @metro/backend...

# Copy build output
COPY --from=build /app/apps/backend/dist ./dist

# TLS cert
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
