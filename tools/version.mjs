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
  if (!compose.includes(`APP_IMAGE_TAG:-${version}`) || !new RegExp(`^APP_IMAGE_TAG=${version.replaceAll('.', '\\.')}\r?$`, 'm').test(example)) {
    throw new Error('package.json, compose.yaml e .env.example devem ter a mesma versão. Usa pnpm release.');
  }
  return version;
}

export async function updateVersionFiles(root, version) {
  version = normalizeVersion(version);
  const files = ['package.json', 'compose.yaml', '.env.example'];
  const previous = await Promise.all(files.map(file => readFile(path.join(root, file), 'utf8')));
  const pkg = JSON.parse(previous[0]);
  pkg.version = version;
  if (!/APP_IMAGE_TAG:-[^}]+/.test(previous[1]) || !/^APP_IMAGE_TAG=.*$/m.test(previous[2])) {
    throw new Error('Não encontrei a configuração da versão no Compose/exemplo.');
  }
  const updated = [
    JSON.stringify(pkg, null, 2) + '\n',
    previous[1].replace(/APP_IMAGE_TAG:-[^}]+/, `APP_IMAGE_TAG:-${version}`),
    previous[2].replace(/^APP_IMAGE_TAG=.*$/m, `APP_IMAGE_TAG=${version}`)
  ];
  // Calculate/validate all replacements before modifying any file.
  for (let i = 0; i < files.length; i++) await writeFile(path.join(root, files[i]), updated[i]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkVersionFiles().then(version => console.log(`Versão do projeto: ${version}`)).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
