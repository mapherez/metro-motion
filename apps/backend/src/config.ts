import 'dotenv/config';

function intFromEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) {return fallback;}
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: intFromEnv('PORT', 8080),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  metroApi: {
    base: process.env.METRO_API_BASE || '',
    key: process.env.METRO_API_KEY || '',
    caFile: process.env.METRO_CA_FILE || ''
  },
  pollIntervalMs: intFromEnv('POLL_INTERVAL_MS', 2000),
  dwellSeconds: intFromEnv('DWELL_SECONDS', 25),
  redis: {
    url: process.env.REDIS_URL || '',
    token: process.env.REDIS_TOKEN || '',
    ttlSeconds: intFromEnv('REDIS_TTL_SECONDS', 15),
    channel: process.env.REDIS_CHANNEL || 'metro:events',
    snapshotKey: process.env.REDIS_SNAPSHOT_KEY || 'metro:snapshot',
    stationEtaKey: process.env.REDIS_STATION_ETA_KEY || 'metro:station-etas'
  },
  frontend: {
    distDir: process.env.FRONTEND_DIST_DIR || ''
  }
};
