// Tests for probe-mutation.mjs. Run with: node --test <this file>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const script = join(dirname(fileURLToPath(import.meta.url)), 'probe-mutation.mjs');
const ORIGINAL = 'export const limit = 100;\n';

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'probe-test-'));
  writeFileSync(join(dir, 'src.ts'), ORIGINAL);
  return dir;
}

function probe(dir, cmd, extra = []) {
  const r = spawnSync(
    process.execPath,
    [script, '--file', 'src.ts', '--find', '100', '--replace', '101', '--cmd', cmd, '--log', 'probes.jsonl', ...extra],
    { cwd: dir, encoding: 'utf8' },
  );
  const logPath = join(dir, 'probes.jsonl');
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { status: r.status, stdout: r.stdout, log };
}

const node = (code) => `"${process.execPath}" -e ${JSON.stringify(code)}`;

test('a failing test command is KILLED and the file is restored', () => {
  const dir = project();
  const r = probe(dir, node('process.exit(1)'), ['--no-baseline']);
  assert.match(r.stdout, /^KILLED/);
  assert.equal(r.log[0].result, 'KILLED');
  assert.equal(readFileSync(join(dir, 'src.ts'), 'utf8'), ORIGINAL);
});

test('a passing test command is SURVIVED', () => {
  const dir = project();
  const r = probe(dir, node('process.exit(0)'), ['--no-baseline']);
  assert.match(r.stdout, /^SURVIVED/);
  assert.equal(r.log[0].result, 'SURVIVED');
});

test('verbose output does not turn a passing run into KILLED', () => {
  const dir = project();
  const r = probe(dir, node("process.stdout.write('x'.repeat(4 * 1024 * 1024))"), ['--no-baseline']);
  assert.match(r.stdout, /^SURVIVED/);
  assert.equal(r.log[0].result, 'SURVIVED');
});

test('a timeout kills the whole process tree before the file is restored', async () => {
  const dir = project();
  // The shell runs node as a child (the trailing `; true` stops sh from exec-ing it),
  // so killing only the shell would leave node alive to write the marker.
  const writer = node("setTimeout(() => require('fs').writeFileSync('marker', 'x'), 2500)");
  const r = probe(dir, `${writer}; true`, ['--no-baseline', '--timeout', '1']);
  assert.match(r.stdout, /^TIMEOUT/);
  assert.equal(r.log[0].result, 'TIMEOUT');
  assert.equal(readFileSync(join(dir, 'src.ts'), 'utf8'), ORIGINAL);
  await sleep(3500);
  assert.equal(existsSync(join(dir, 'marker')), false, 'test runner child outlived the probe');
});
