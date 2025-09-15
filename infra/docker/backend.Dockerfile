# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate

# We copy the main manifests first to cache the install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/tsconfig.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/station-data/package.json ./packages/station-data/

# Install everything with lockfile
RUN pnpm install --frozen-lockfile

# Now copy the WHOLE repo (source code)
COPY . .

# 👉 Only build backend + dependencies (exclude apps/frontend)
RUN pnpm -r --filter @metro/backend... build

# ---------- runtime ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# (Optional) Bundle Metro CA
# COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
# ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

# Only the necessary
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist

# non-root user
RUN addgroup -S nodejs && adduser -S node -G nodejs
USER node

EXPOSE 8080
CMD ["node", "apps/backend/dist/index.js"]
