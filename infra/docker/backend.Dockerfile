# ---------- Build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# Copy root manifests (important!)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json for backend + its deps
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install all deps (dev+prod) for backend + deps
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

# Copy only built output + node_modules from build stage
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./ 
COPY --from=build /app/node_modules ./node_modules

# TLS CA bundle
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
