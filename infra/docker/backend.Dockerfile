# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm via Corepack
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Copy workspace manifests first for caching
COPY pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install all deps needed for build
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

# Enable pnpm again in runtime
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Copy lockfile + backend package.json
COPY pnpm-lock.yaml ./
COPY apps/backend/package.json ./ 

# Install only production deps (all workspaces if needed)
RUN pnpm install --prod

# Copy build output
COPY --from=build /app/apps/backend/dist ./dist

# TLS: copy CA bundle
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
