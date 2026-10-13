import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeVersion, assertVersionIncrease, readVersion, checkVersionFiles } from '../version.mjs';
import { release, githubRepository, parseReleaseArgs } from '../release.mjs';
import { imageMetadata } from '../image-metadata.mjs';

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture(t) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'metro-release-'));
  t.after(async () => {
    const relative = path.relative(tmpdir(), temporary);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(temporary, { recursive: true, force: true });
  });
  const root = path.join(temporary, 'repo');
  const remote = path.join(temporary, 'remote.git');
  await mkdir(root);
  git(temporary, 'init', '--bare', '--initial-branch=main', remote);
  git(root, 'init', '--initial-branch=main');
  git(root, 'config', 'user.name', 'Release Test');
  git(root, 'config', 'user.email', 'release-test@example.invalid');
  git(root, 'remote', 'add', 'origin', 'https://github.com/test/metro-motion.git');
  // Route this fixture's GitHub-looking origin to a local bare repository.
  // No test ever pushes or authenticates against the real GitHub service.
  git(root, 'config', `url.${pathToFileURL(remote).href}.insteadOf`, 'https://github.com/test/metro-motion.git');
  git(root, 'config', 'protocol.file.allow', 'always');
  await mkdir(path.join(root, '.github', 'workflows'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }) + '\n');
  await writeFile(path.join(root, 'compose.yaml'), 'image: ghcr.io/test/metro-motion-app:${APP_IMAGE_TAG:-1.0.0}\n');
  await writeFile(path.join(root, '.env.example'), 'APP_IMAGE_TAG=1.0.0\n');
  await writeFile(path.join(root, '.gitignore'), '.env\n');
  for (const file of ['ci.yml', 'docker-app.yml']) await writeFile(path.join(root, '.github', 'workflows', file), 'name: Test\n');
  await writeFile(path.join(root, 'old.txt'), 'delete me\n');
  git(root, 'add', '--all');
  git(root, 'commit', '-m', 'initial');
  git(root, 'push', 'origin', 'main');
  return { root, remote, temporary };
}

test('version validation, default and CLI options', async t => {
  for (const invalid of ['1.0', '01.0.1', '1.1.0-beta', '1.1.0;cmd', '-1.0.0', '1.0.1\nBAD=1']) assert.throws(() => normalizeVersion(invalid));
  assert.equal(normalizeVersion(' v1.2.3 '), '1.2.3');
  for (const next of ['1.0.1', '1.1.0', '2.0.0']) assert.doesNotThrow(() => assertVersionIncrease('1.0.0', next));
  for (const next of ['1.0.0', '0.9.9']) assert.throws(() => assertVersionIncrease('1.0.0', next));
  assert.deepEqual(parseReleaseArgs(['--dry-run', '--version', '1.0.1']), { dryRun: true, version: '1.0.1' });
  for (const args of [['--unknown'], ['--version'], ['--version', '--dry-run'], ['--version', '1.0.1', '--version', '1.0.2']]) assert.throws(() => parseReleaseArgs(args));
  const { root } = await fixture(t);
  await writeFile(path.join(root, 'package.json'), '{}');
  assert.equal(await readVersion(root), '1.0.0');
});

test('release commits all non-ignored changes, updates version files and pushes branch plus tag', async t => {
  const { root, remote } = await fixture(t);
  await writeFile(path.join(root, 'new.txt'), 'include me\n');
  await writeFile(path.join(root, '.env'), 'METRO_API_KEY=fake-test-value\n');
  await rm(path.join(root, 'old.txt'));
  const result = await release({ root, version: 'v1.1.0', log() {} });
  assert.equal(result.tag, 'v1.1.0');
  assert.equal(await checkVersionFiles(root), '1.1.0');
  assert.equal(git(remote, 'rev-parse', 'main'), result.commit);
  assert.equal(git(remote, 'rev-parse', 'v1.1.0^{}'), result.commit);
  const paths = git(remote, 'ls-tree', '-r', '--name-only', 'main').split('\n');
  assert.ok(paths.includes('new.txt'));
  assert.ok(!paths.includes('old.txt'));
  assert.ok(!paths.includes('.env'));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('dry-run has no file, commit, tag or remote changes', async t => {
  const { root, remote } = await fixture(t);
  const before = await readFile(path.join(root, 'package.json'), 'utf8');
  const head = git(root, 'rev-parse', 'HEAD');
  await writeFile(path.join(root, 'new.txt'), 'pending');
  await release({ root, version: '1.0.1', dryRun: true, log() {} });
  assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), before);
  assert.equal(git(root, 'rev-parse', 'HEAD'), head);
  assert.equal(git(remote, 'rev-parse', 'main'), head);
  assert.equal(git(root, 'tag', '--list'), '');
  assert.match(git(root, 'status', '--porcelain'), /new.txt/);
});

test('duplicate local/remote tags and backwards versions stop before changing files', async t => {
  const { root, remote } = await fixture(t);
  git(root, 'tag', 'v1.0.1');
  git(remote, 'tag', 'v1.0.2', 'main');
  await assert.rejects(release({ root, version: '1.0.1', log() {} }), /localmente/);
  await assert.rejects(release({ root, version: '1.0.2', log() {} }), /GitHub/);
  await assert.rejects(release({ root, version: '1.0.0', log() {} }), /superior/);
  assert.equal(await readVersion(root), '1.0.0');
});

test('release refuses an outdated branch before staging or changing versions', async t => {
  const { root, remote, temporary } = await fixture(t);
  const other = path.join(temporary, 'other');
  git(temporary, 'clone', remote, other);
  git(other, 'config', 'user.name', 'Other Test');
  git(other, 'config', 'user.email', 'other@example.invalid');
  await writeFile(path.join(other, 'remote.txt'), 'new remote commit');
  git(other, 'add', '--all');
  git(other, 'commit', '-m', 'remote update');
  git(other, 'push', 'origin', 'main');
  await assert.rejects(release({ root, version: '1.0.1', log() {} }), /atrás|divergiu/);
  assert.equal(await readVersion(root), '1.0.0');
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('release rejects a non-main branch and tracked env files', async t => {
  const { root } = await fixture(t);
  git(root, 'switch', '-c', 'feature');
  await assert.rejects(release({ root, version: '1.0.1', log() {} }), /branch main/);
  git(root, 'switch', 'main');
  await writeFile(path.join(root, '.env'), 'fake=only');
  git(root, 'add', '--force', '.env');
  await assert.rejects(release({ root, version: '1.0.1', log() {} }), /\.env não ignorado/);
  assert.equal(await readVersion(root), '1.0.0');
});

test('push rejection keeps local commit/tag and changes neither remote ref', async t => {
  const { root, remote } = await fixture(t);
  const before = git(remote, 'rev-parse', 'main');
  await writeFile(path.join(remote, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const messages = [];
  await assert.rejects(release({ root, version: '1.0.1', log: message => messages.push(message) }), /push falhou/);
  assert.equal(git(remote, 'rev-parse', 'main'), before);
  assert.equal(git(remote, 'tag', '--list'), '');
  assert.equal(await checkVersionFiles(root), '1.0.1');
  assert.equal(git(root, 'rev-parse', 'v1.0.1^{}'), git(root, 'rev-parse', 'HEAD'));
  assert.ok(messages.some(message => message.includes('git push --atomic origin')));
});

test('unresolved merge conflicts are not staged or committed by a release', async t => {
  const { root } = await fixture(t);
  git(root, 'switch', '-c', 'feature');
  await writeFile(path.join(root, 'old.txt'), 'feature');
  git(root, 'commit', '-am', 'feature change');
  git(root, 'switch', 'main');
  await writeFile(path.join(root, 'old.txt'), 'main');
  git(root, 'commit', '-am', 'main change');
  const merge = spawnSync('git', ['merge', 'feature'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.notEqual(merge.status, 0);
  await assert.rejects(release({ root, version: '1.0.1', log() {} }), /conflitos de merge/);
  assert.equal(await readVersion(root), '1.0.0');
  assert.match(git(root, 'status', '--porcelain'), /UU old.txt/);
});

test('GHCR metadata is versioned, lowercase and tied to the checked-out release tag', () => {
  const sha = 'a'.repeat(40);
  const metadata = imageMetadata({ repository: 'Mapherez/Metro-Motion', sha, ref: 'refs/tags/v1.2.3', version: '1.2.3' });
  assert.equal(metadata.image, 'ghcr.io/mapherez/metro-motion-app');
  assert.ok(metadata.tags.includes(':1.2.3'));
  assert.ok(metadata.tags.includes(`:sha-${sha}`));
  assert.throws(() => imageMetadata({ repository: 'org/repo', sha, ref: 'refs/tags/v1.2.4', version: '1.2.3' }), /tag/);
  assert.throws(() => imageMetadata({ repository: 'org/repo\nBAD=value', sha, version: '1.2.3' }));
  assert.equal(githubRepository('https://github.com/mapherez/metro-motion.git'), 'mapherez/metro-motion');
  assert.equal(githubRepository('git@github.com:mapherez/metro-motion.git'), 'mapherez/metro-motion');
  assert.throws(() => githubRepository('https://other.example/org/repo'));
});
