# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy package.json + lockfile
COPY apps/backend/package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate \
  && pnpm install --prod --filter @metro/backend...

# Copy compiled code
COPY --from=build /app/apps/backend/dist ./dist

# TLS cert
COPY infra/certs/metro-ca-bundle.pem /etc/ssl/certs/metro-ca-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/metro-ca-bundle.pem

EXPOSE 8080
CMD ["node", "dist/index.js"]
