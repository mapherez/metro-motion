import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const repoRoot = fileURLToPath(new URL('../', import.meta.url));

export function normalizeVersion(input) {
  const value = input.trim().replace(/^v/, '');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error('Usa uma versão estável no formato X.Y.Z, por exemplo 1.0.1.');
  }
  return value;
}

export function assertVersionIncrease(current, next) {
  const before = normalizeVersion(current).split('.').map(BigInt);
  const after = normalizeVersion(next).split('.').map(BigInt);
  for (let i = 0; i < 3; i++) {
    if (after[i] > before[i]) return;
    if (after[i] < before[i]) break;
  }
  throw new Error(`A nova versão deve ser superior a ${current}.`);
}

export async function readVersion(root = repoRoot) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  return normalizeVersion(pkg.version || '1.0.0');
}

export async function checkVersionFiles(root = repoRoot) {
  const version = await readVersion(root);
  const compose = await readFile(path.join(root, 'compose.yaml'), 'utf8');
  const example = await readFile(path.join(root, '.env.example'), 'utf8');
  if (!compose.includes('${APP_IMAGE_TAG:-latest}') || !/^APP_IMAGE_TAG=latest\r?$/m.test(example)) {
    throw new Error('compose.yaml e .env.example devem usar APP_IMAGE_TAG com o valor latest.');
  }
  return version;
}

export async function updateVersionFiles(root, version) {
  version = normalizeVersion(version);
  await checkVersionFiles(root);
  const file = path.join(root, 'package.json');
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  pkg.version = version;
  await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkVersionFiles().then(version => console.log(`Versão do projeto: ${version}`)).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
