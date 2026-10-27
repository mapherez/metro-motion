import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { assertVersionIncrease, checkVersionFiles, normalizeVersion, readVersion, repoRoot, updateVersionFiles } from './version.mjs';

function git(root, args, { allowFailure = false, inherit = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root, encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: inherit ? 'inherit' : 'pipe'
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args[0]} falhou (${result.status}).`);
  return result;
}

export function githubRepository(remote) {
  const match = remote.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
    || remote.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) throw new Error('origin deve apontar para um repositório GitHub por HTTPS ou SSH.');
  return `${match[1]}/${match[2]}`;
}

export async function release({ root = repoRoot, version, dryRun = false, log = console.log } = {}) {
  const current = await readVersion(root);
  const next = normalizeVersion(version);
  assertVersionIncrease(current, next);
  const branch = git(root, ['branch', '--show-current']).stdout.trim();
  if (branch !== 'main') throw new Error('Executa o release na branch main (sem detached HEAD).');
  if (git(root, ['diff', '--name-only', '--diff-filter=U']).stdout.trim()) throw new Error('Resolve os conflitos de merge antes do release.');
  const repository = githubRepository(git(root, ['config', '--get', 'remote.origin.url']).stdout.trim());
  const tag = `v${next}`;
  if (git(root, ['tag', '--list', tag]).stdout.trim()) throw new Error(`A tag ${tag} já existe localmente.`);
  const visibleFiles = git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).stdout.split('\0');
  if (visibleFiles.some(file => /(^|\/)\.env(?:\..+)?$/.test(file) && !file.endsWith('.env.example'))) {
    throw new Error('Foi encontrado um .env não ignorado pelo Git. Retira-o do conjunto de ficheiros antes do release.');
  }
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/docker-app.yml']) {
    await readFile(path.join(root, file), 'utf8');
  }
  // Validate deployment defaults even for dry-runs; releases keep latest.
  await checkVersionFiles(root);
  log(`${current} → ${next}; commit + tag ${tag} → origin/main`);
  log('Inclui todas as alterações e novos ficheiros não ignorados pelo Git.');
  if (dryRun) {
    log('Dry-run: não alterei ficheiros, não consultei o remoto e não fiz commit/tag/push.');
    return { version: next, tag, repository, dryRun: true };
  }

  // Network/authentication and divergence checks happen before changing files.
  const refs = git(root, ['ls-remote', 'origin', 'refs/heads/main', `refs/tags/${tag}`]).stdout;
  if (refs.includes(`refs/tags/${tag}`)) throw new Error(`A tag ${tag} já existe no GitHub.`);
  if (refs.includes('refs/heads/main')) {
    git(root, ['fetch', '--no-tags', 'origin', 'main']);
    if (git(root, ['merge-base', '--is-ancestor', 'FETCH_HEAD', 'HEAD'], { allowFailure: true }).status !== 0) {
      throw new Error('main está atrás do remoto ou divergiu. Integra as alterações do GitHub antes do release.');
    }
  }
  await updateVersionFiles(root, next);
  git(root, ['add', '--all']);
  git(root, ['commit', '-m', `chore(release): ${tag}`], { inherit: true });
  const commit = git(root, ['rev-parse', 'HEAD']).stdout.trim();
  git(root, ['tag', '-a', tag, '-m', `Release ${tag}`]);
  try {
    git(root, ['push', '--atomic', 'origin', `${commit}:refs/heads/main`, `refs/tags/${tag}`], { inherit: true });
  } catch (error) {
    log(`Commit e tag locais preservados. Para repetir o push: git push --atomic origin ${commit}:refs/heads/main refs/tags/${tag}`);
    throw error;
  }
  log(`Release enviado: https://github.com/${repository}/actions`);
  log('O CI começa pelo push; o CI da tag publica a imagem apenas após todos os checks passarem.');
  return { version: next, tag, repository, commit };
}

export function parseReleaseArgs(args) {
  let dryRun = false;
  let version;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--version' && !version && args[i + 1] && !args[i + 1].startsWith('--')) version = args[++i];
    else throw new Error('Uso: pnpm release [--dry-run] [--version X.Y.Z]');
  }
  return { dryRun, version };
}

async function main() {
  const options = parseReleaseArgs(process.argv.slice(2));
  const current = await readVersion();
  console.log(`Versão atual: ${current}`);
  let version = options.version;
  if (!version) {
    const input = createInterface({ input: process.stdin, output: process.stdout });
    try { version = await input.question('Para que versão queres subir? (X.Y.Z; vazio cancela): '); }
    finally { input.close(); }
  }
  if (!version.trim()) { console.log('Release cancelado.'); return; }
  await release({ version, dryRun: options.dryRun });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Release falhou: ${error.message}`); process.exitCode = 1; });
}
