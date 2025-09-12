# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate
WORKDIR /app

# 1) Install deps in workspace (no lockfile required here; for reproducibility add pnpm-lock.yaml)
FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/package.json
RUN pnpm -w install

# 2) Build all needed packages and backend
FROM deps AS build
COPY . .
RUN pnpm -w build

# 3) Runtime: copy built artifacts and minimal files
FROM node:20-alpine AS runner
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate
WORKDIR /app

# Copy production node_modules for the workspace (from deps stage)
COPY --from=deps /app/node_modules ./node_modules

# Copy built packages (dist) and backend dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json

EXPOSE 8080
WORKDIR /app/apps/backend
CMD ["node", "dist/index.js"]

