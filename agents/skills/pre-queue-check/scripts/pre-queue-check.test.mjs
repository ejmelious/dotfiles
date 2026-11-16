// Tests for pre-queue-check.sh. Run with: node --test <this file>
// Runs the script against a throwaway repo and a local origin, with gh, turbo,
// just and pnpm replaced by stubs that log their arguments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'pre-queue-check.sh');

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();
}

function write(root, path, body) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), body);
}

// A repo whose PR branch adds `prFiles` on top of a main with workspaces
// packages/a and packages/b. `symlinkAiDev` makes .ai-dev a symlink to a
// directory outside the repo, as on machines that share .ai-dev through EFS.
function setup({ prFiles, symlinkAiDev, justFailsOn = 'no-such-path' }) {
  const root = mkdtempSync(join(tmpdir(), 'pre-queue-test-'));
  const origin = join(root, 'origin.git');
  const repo = join(root, 'repo');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  write(repo, 'pnpm-lock.yaml', 'lockfileVersion: 9\n');
  write(repo, 'packages/a/package.json', '{"name":"@x/a"}\n');
  write(repo, 'packages/b/package.json', '{"name":"@x/b"}\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'switch', '-q', '-c', 'pr');
  for (const f of prFiles) write(repo, f, 'test\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'pr');
  const head = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'push', '-q', 'origin', 'pr');
  git(repo, 'switch', '-q', 'main');
  writeFileSync(join(repo, '.git/info/exclude'), '.ai-dev\n');
  if (symlinkAiDev) {
    mkdirSync(join(root, 'shared-ai-dev'));
    symlinkSync(join(root, 'shared-ai-dev'), join(repo, '.ai-dev'));
  }

  const bin = join(root, 'bin');
  const calls = join(root, 'calls.log');
  const meta = JSON.stringify({
    headRefOid: head,
    baseRefName: 'main',
    isDraft: false,
    files: prFiles.map((path) => ({ path })),
  });
  const stubs = {
    gh: `printf '%s\\n' '${meta}'`,
    turbo: `echo "turbo $*" >> '${calls}'`,
    just: `echo "just $*" >> '${calls}'; [[ "$*" != *'${justFailsOn}'* ]]`,
    pnpm: 'exit 0',
  };
  for (const [name, body] of Object.entries(stubs)) {
    write(bin, name, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  return { repo, bin, calls };
}

function run({ repo, bin }) {
  return spawnSync('bash', [script, '7'], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
}

function justCalls(calls) {
  return readFileSync(calls, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('just '));
}

test('runs when .ai-dev is a symlink to a directory outside the repo', () => {
  const env = setup({ prFiles: ['packages/a/src/x.test.ts'], symlinkAiDev: true });
  const r = run(env);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /#7 PASS/);
});

test('runs changed tests once per workspace, since just unit-test takes one workspace', () => {
  const env = setup({
    prFiles: ['packages/a/src/x.test.ts', 'packages/a/src/y.test.ts', 'packages/b/src/z.test.ts'],
    symlinkAiDev: false,
  });
  const r = run(env);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(justCalls(env.calls).sort(), [
    'just unit-test packages/a/src/x.test.ts packages/a/src/y.test.ts',
    'just unit-test packages/b/src/z.test.ts',
  ]);
});

test('fails the PR when one workspace\'s tests fail and another\'s pass', () => {
  const env = setup({
    prFiles: ['packages/a/src/x.test.ts', 'packages/b/src/z.test.ts'],
    symlinkAiDev: false,
    justFailsOn: 'packages/b/',
  });
  const r = run(env);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /#7 FAIL against main: unit tests/);
  assert.equal(justCalls(env.calls).length, 2);
});
