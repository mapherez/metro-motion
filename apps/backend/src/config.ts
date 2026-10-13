import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Config = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  function positiveInt(name: string, fallback: number, max = Number.MAX_SAFE_INTEGER) {
    const value = env[name] === undefined || env[name] === '' ? fallback : Number(env[name]);
    if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
      throw new Error(`${name} must be a positive integer <= ${max}`);
    }
    return value;
  }
  function url(name: string, value: string, protocols: string[]) {
    try {
      const parsed = new URL(value);
      if (!protocols.includes(parsed.protocol) || !parsed.hostname) throw new Error();
      return value;
    } catch {
      throw new Error(`${name} must be a valid ${protocols.join('/')} URL`);
    }
  }
  if (env.METRO_MOCK && !['0', '1'].includes(env.METRO_MOCK)) throw new Error('METRO_MOCK must be 0 or 1');
  if (env.METRO_TLS_INSECURE === '1' || env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS verification must remain enabled');
  const mock = env.METRO_MOCK === '1';
  const base = env.METRO_API_BASE || 'https://api.metrolisboa.pt:8243/estadoServicoML/1.0.1/';
  const key = env.METRO_API_KEY?.trim() || '';
  if (!mock && !key) throw new Error('METRO_API_KEY is required unless METRO_MOCK=1');
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
  return {
    production: env.NODE_ENV === 'production',
    port: positiveInt('PORT', 8080, 65535),
    metroApi: { base: url('METRO_API_BASE', base, ['https:']), key },
    mock,
    mockFile: env.METRO_MOCK_FILE || path.join(repoRoot, 'tools/assets/tempoEspera_Estacao_todos.json'),
    pollIntervalMs: positiveInt('POLL_INTERVAL_MS', 2000, 3600000),
    dwellSeconds: positiveInt('DWELL_SECONDS', 25),
    redis: {
      url: url('REDIS_URL', env.REDIS_URL || '', ['redis:', 'rediss:']),
      ttlSeconds: positiveInt('REDIS_TTL_SECONDS', 15),
      channel: env.REDIS_CHANNEL || 'metro:events',
      snapshotKey: env.REDIS_SNAPSHOT_KEY || 'metro:snapshot',
      stationEtaKey: env.REDIS_STATION_ETA_KEY || 'metro:station-etas'
    },
    frontendDist: env.FRONTEND_DIST_DIR || path.join(repoRoot, 'apps/frontend/dist')
  };
}
