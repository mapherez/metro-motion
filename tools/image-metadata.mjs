import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { normalizeVersion, readVersion } from './version.mjs';

export function imageMetadata({ repository, sha, ref, version }) {
  version = normalizeVersion(version);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Invalid GITHUB_REPOSITORY');
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('Invalid GITHUB_SHA');
  if (ref?.startsWith('refs/tags/') && ref !== `refs/tags/v${version}`) throw new Error('A tag deve coincidir com a versão do package.json.');
  const image = `ghcr.io/${repository.toLowerCase()}-app`;
  return { image, version, tags: `${image}:${version},${image}:sha-${sha}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const metadata = imageMetadata({ repository: process.env.GITHUB_REPOSITORY, sha: process.env.GITHUB_SHA, ref: process.env.GITHUB_REF, version: await readVersion() });
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(metadata).map(([key, value]) => `${key}=${value}\n`).join(''));
    console.log(`${metadata.image}:${metadata.version}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
