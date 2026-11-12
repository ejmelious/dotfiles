// Tests for find-single-use-testutils.mjs. Run with: node --test <this file>
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'find-single-use-testutils.mjs');

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'testutil-test-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), body);
  }
  return dir;
}

function run(dir, extra = []) {
  const r = spawnSync(process.execPath, [script, '.', '--json', ...extra], { cwd: dir, encoding: 'utf8' });
  return { status: r.status, report: JSON.parse(r.stdout) };
}

const UTIL = 'export function buildA() {}\nexport const buildB = () => {};\n';

test('reports a testutil with one importer', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/a.test.ts': 'import { buildA, buildB } from "#pkg/a.testutil.ts";\n',
  });
  const { status, report } = run(dir);
  assert.equal(status, 1);
  assert.deepEqual(report.map((r) => [r.file, r.importers]), [['src/a.testutil.ts', ['src/a.test.ts']]]);
});

test('passes a testutil whose every export has two consumers', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/a.test.ts': 'import { buildA, buildB } from "./a.testutil";\n',
    'src/b.test.ts': 'import { buildA, type buildB } from "../src/a.testutil.js";\n',
  });
  assert.deepEqual(run(dir), { status: 0, report: [] });
});

test('reports exports that only one of several importers uses, with --exports', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/a.test.ts': 'import { buildA, buildB } from "./a.testutil.ts";\n',
    'src/b.test.ts': 'import { buildA } from "./a.testutil.ts";\n',
  });
  assert.deepEqual(run(dir), { status: 0, report: [] });
  const { status, report } = run(dir, ['--exports']);
  assert.equal(status, 1);
  assert.deepEqual(report[0].exports, [{ name: 'buildB', users: ['src/a.test.ts'] }]);
});

test('counts a namespace import as using every export', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/a.test.ts': 'import * as util from "./a.testutil.ts";\n',
    'src/b.test.ts': 'import * as u from "./a.testutil.ts";\n',
  });
  assert.equal(run(dir).status, 0);
});

test('does not count an import of a different module with a similar name', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/a.test.ts': 'import { buildA, buildB } from "./a.testutil.ts";\n',
    'src/b.test.ts': 'import { buildA, buildB } from "./aa.testutil.ts";\n',
  });
  assert.equal(run(dir).report[0].importers.length, 1);
});

test('limits the report to --only files', () => {
  const dir = project({
    'src/a.testutil.ts': UTIL,
    'src/b.testutil.ts': UTIL,
    'src/a.test.ts': 'import { buildA, buildB } from "./a.testutil.ts";\n',
  });
  const { report } = run(dir, ['--only=src/b.testutil.ts']);
  assert.deepEqual(report.map((r) => r.file), ['src/b.testutil.ts']);
});
