import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { buildServer } from './server.js';
import { loadConfig } from './config.js';
import { createRedis, closeRedis } from './redis.js';
import { Ingestor } from './ingestor.js';

async function main() {
  loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
  loadEnv();
  const config = loadConfig();
  const redis = createRedis(config);
  let app;
  try { app = buildServer(config, { redis }); }
  catch (error) { await closeRedis(redis); throw error; }
  const ingestor = new Ingestor(config, redis, app.log);
  app.addHook('preClose', async () => { await ingestor.stop(); });
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    try { await app.close(); }
    catch { process.exitCode = 1; }
    finally { clearTimeout(deadline); }
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await ingestor.start();
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (error) {
    await shutdown();
    throw error;
  }
}

main().catch((error: unknown) => {
  // Configuration errors identify the field without exposing its value.
  console.error(`Startup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
});
