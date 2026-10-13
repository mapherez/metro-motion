import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const platform = process.env.TEST_PLATFORM;
if (platform && !['linux/arm64', 'linux/amd64'].includes(platform)) throw new Error('TEST_PLATFORM must be linux/arm64 or linux/amd64');
const emulatedArm = process.env.TEST_ARM_EMULATION === '1';
if (emulatedArm && platform !== 'linux/arm64') throw new Error('TEST_ARM_EMULATION requires TEST_PLATFORM=linux/arm64');
const temporary = await mkdtemp(`${tmpdir()}/metro-compose-`);
const envFile = `${temporary}/test.env`;
const portProbe = createServer();
await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const project = `metro-motion-test-${process.pid}`;
const tag = `test-${process.pid}`;
await writeFile(envFile, `METRO_MOCK=1\nMETRO_API_KEY=\nAPP_PORT=${port}\nAPP_IMAGE_TAG=${tag}\n`);
const dockerEnv = { ...process.env, METRO_MOCK: '1', METRO_API_KEY: '', APP_PORT: String(port), APP_IMAGE_TAG: tag };
const composeArgs = ['compose', '--project-name', project, '--env-file', envFile, '-f', 'compose.yaml', '-f', 'compose.local.yaml'];
if (platform) {
  const override = `${temporary}/platform.yaml`;
  const redisCommand = emulatedArm
    ? `    command: ${JSON.stringify(['redis-server', '--save', '', '--appendonly', 'no', '--ignore-warnings', 'ARM64-COW-BUG'])}\n`
    : '';
  // QEMU can trigger Redis's ARM64 kernel probe. Opt-out only for this disposable
  // mock test with all persistence disabled; production keeps the safety check.
  await writeFile(override, `services:\n  app:\n    platform: ${platform}\n  redis:\n    platform: ${platform}\n${redisCommand}`);
  composeArgs.push('-f', override);
}
const address = `http://127.0.0.1:${port}`;
const streams = [];
let started = false;

function docker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: root, env: dockerEnv, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Docker command failed (exit ${code})`)));
  });
}
const compose = (...args) => docker([...composeArgs, ...args]);

async function eventually(check, timeout = 60000) {
  const deadline = Date.now() + timeout;
  let failure;
  do {
    try { return await check(); } catch (error) { failure = error; }
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < deadline);
  throw failure;
}

async function get(url) {
  return fetch(`${address}${url}`, { signal: AbortSignal.timeout(5000) });
}

async function snapshot() {
  return eventually(async () => {
    assert.equal((await get('/readyz')).status, 200);
    const response = await get('/api/now');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.serviceOpen, true);
    assert.equal(Object.keys(data.lines).length, 4);
    assert.ok(Object.values(data.lines).some(line => line.trains.length > 0));
    return data;
  });
}

async function nextFrame(reader) {
  let timer;
  try {
    const result = await Promise.race([
      reader.read(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SSE frame timed out')), 10000); })
    ]);
    assert.equal(result.done, false);
    return new TextDecoder().decode(result.value);
  } finally { clearTimeout(timer); }
}

async function connect() {
  const controller = new AbortController();
  const response = await fetch(`${address}/api/stream`, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  streams.push({ reader, controller });
  assert.match(await nextFrame(reader), /data:/);
  return reader;
}

try {
  await docker(['version']);
  await compose('config', '--quiet');
  started = true;
  await compose('up', '-d', '--build', '--wait', '--wait-timeout', '120');
  await compose('exec', '-T', 'app', 'node', '-e', platform
    ? `if(process.arch !== '${platform === 'linux/arm64' ? 'arm64' : 'x64'}') process.exit(1); console.log('Runtime:', process.platform, process.arch)`
    : "console.log('Runtime:', process.platform, process.arch)");
  await snapshot();
  for (const route of ['/', '/about', '/line/azul', '/line/verde', '/line/amarela', '/line/vermelha']) {
    const response = await fetch(`${address}${route}`, { headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, route);
    const html = await response.text();
    assert.match(html, /<div id="root">/);
    if (route === '/') {
      const asset = html.match(/src="(\/assets\/[^" ]+)"/)?.[1];
      assert.ok(asset);
      assert.equal((await get(asset)).status, 200);
    }
  }
  for (const line of ['azul', 'verde', 'amarela', 'vermelha']) {
    const response = await get(`/api/lines/${line}/etas`);
    assert.equal(response.status, 200);
    assert.ok((await response.json()).stations.length > 0);
  }
  assert.equal((await get('/api/missing')).status, 404);
  assert.equal((await get('/assets/missing.js')).status, 404);
  const first = await connect();
  const second = await connect();
  await compose('exec', '-T', 'app', 'node', '--input-type=module', '-e',
    "import { Redis } from 'ioredis'; const redis = new Redis(process.env.REDIS_URL); try { const result = await redis.pubsub('NUMSUB', 'metro:events'); if (Number(result[1]) !== 1) throw new Error('Expected one shared subscriber'); } finally { await redis.quit(); }");
  assert.match(await nextFrame(first), /data:/);
  assert.match(await nextFrame(second), /data:/);
  await compose('restart', 'redis');
  await snapshot();
  const reconnected = await eventually(connect);
  assert.match(await nextFrame(reconnected), /data:/);
  await compose('restart', 'app');
  await snapshot();
  await eventually(connect);
  console.log(`Compose integration passed (${project}, ${platform || 'host architecture'}, mock mode, no Metro token).`);
} catch (error) {
  if (started) await compose('logs', '--no-color', '--tail', '100').catch(() => {});
  throw error;
} finally {
  for (const { reader, controller } of streams) {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
  if (started) await compose('down', '--remove-orphans').catch(error => console.error(error.message));
  await rm(temporary, { recursive: true, force: true });
}
