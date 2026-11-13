#!/usr/bin/env node
// Heuristic inventory of TypeScript/JavaScript test files: counts tests and flags
// candidate smells. Every hit is a lead to verify by reading the test, not a verdict;
// regexes cannot see intent, helpers that assert, or framework config.
//
// Usage: node scan-test-smells.mjs [root=.] [--json] [--assert-helpers=name1,name2]
//        [--include=<substring>] (only scan test files whose path contains it)
// No dependencies. Read-only.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--')) ?? '.';
const asJson = args.includes('--json');
const includeArg = args.find((a) => a.startsWith('--include='));
const include = includeArg ? includeArg.slice('--include='.length) : null;
const helperArg = args.find((a) => a.startsWith('--assert-helpers='));
const extraHelpers = helperArg ? helperArg.slice('--assert-helpers='.length).split(',').filter(Boolean) : [];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.turbo', 'out', '.stryker-tmp']);
const TEST_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(__tests__\/.*\.[cm]?[jt]sx?$)/;

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name), out);
    } else if (TEST_FILE.test(join(dir, e.name).replaceAll('\\', '/'))) {
      out.push(join(dir, e.name));
    }
  }
  return out;
}

// Replace comments and string/template contents with spaces so later regexes see code
// only, while keeping offsets (and therefore line numbers) intact.
function blankNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { const end = src.indexOf('\n', i); const stop = end === -1 ? src.length : end; blank(i, stop); i = stop; continue; }
    if (c === '/' && n === '*') { const end = src.indexOf('*/', i + 2); const stop = end === -1 ? src.length : end + 2; blank(i, stop); i = stop; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (c === '`' && src[j] === '$' && src[j + 1] === '{') {
          // keep template expressions as code; skip to the matching brace
          let depth = 1; j += 2;
          while (j < src.length && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
          continue;
        }
        j++;
      }
      blank(i + 1, j); i = j + 1; continue;
    }
    i++;
  }
  return out.join('');
}

function lineOf(src, idx) { let l = 1; for (let k = 0; k < idx; k++) if (src[k] === '\n') l++; return l; }

// From the index of an opening paren, return the index just past its matching close.
function matchParen(code, open) {
  let depth = 0;
  for (let k = open; k < code.length; k++) {
    if (code[k] === '(') depth++;
    else if (code[k] === ')') { depth--; if (depth === 0) return k + 1; }
  }
  return code.length;
}

const TEST_CALL = /\b(it|test)(\.(only|skip|todo|each\s*\([^)]*\)|concurrent|fails))?\s*\(/g;
const ASSERT = new RegExp(
  String.raw`\b(expect|assert|expectTypeOf|assertType|should|t\.(is|deepEqual|true|false|throws|ok|equal))\b|` +
    String.raw`\bassert\.` +
    (extraHelpers.length ? `|\\b(${extraHelpers.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*\\(` : ''),
);
const WEAK = /\.(toBeDefined|toBeTruthy|toBeFalsy|toBeInstanceOf|not\.toBeNull|not\.toBeUndefined|not\.toThrow)\s*\(/g;
const MATCHER = /\.(to[A-Z]\w*|rejects|resolves)\b/g;
const INTERACTION = /\.(toHaveBeenCalled\w*|toBeCalled\w*|toHaveBeenNthCalledWith|toHaveBeenLastCalledWith)\s*\(/g;

function scanFile(file) {
  const src = readFileSync(file, 'utf8');
  const code = blankNonCode(src);
  const findings = [];
  const add = (kind, idx, note) => findings.push({ kind, line: lineOf(src, idx), note });

  const usesFakeTimers = /\b(useFakeTimers|install\(\s*\{|FakeTimers|mock\.timers)\b/.test(code);
  const tests = [];
  const names = new Map();

  for (const m of code.matchAll(TEST_CALL)) {
    const start = m.index;
    const open = start + m[0].length - 1;
    const end = matchParen(code, open);
    const body = code.slice(open, end);
    const rawName = src.slice(open + 1, Math.min(end, open + 200)).match(/^\s*(['"`])(.*?)\1/);
    const name = rawName ? rawName[2] : '(dynamic name)';
    const modifier = m[3] ?? '';
    tests.push({ name, line: lineOf(src, start) });

    if (modifier === 'only') add('focused', start, `.only leaves the rest of the suite unrun: "${name}"`);
    if (modifier === 'skip' || modifier === 'todo') add('skipped', start, `${modifier}: "${name}"`);
    if (modifier.startsWith('each') === false && rawName) {
      const seen = names.get(name);
      if (seen) add('duplicate-name', start, `same title as line ${seen}: "${name}"`);
      else names.set(name, lineOf(src, start));
    }
    if (modifier === 'skip' || modifier === 'todo') continue;

    // A test whose callback has no body (todo-style) or only delegates is skipped by this check.
    const hasCallback = /=>|function\b/.test(body);
    if (hasCallback && !ASSERT.test(body)) add('no-assertion', start, `no expect/assert found — passes as long as it doesn't throw: "${name}"`);

    const matchers = [...body.matchAll(MATCHER)].map((x) => x[0]);
    const weak = [...body.matchAll(WEAK)];
    if (matchers.length > 0 && weak.length === matchers.length) add('weak-assertions-only', start, `only existence/truthiness checks (${weak.map((w) => w[1]).join(', ')}): "${name}"`);

    const interactions = [...body.matchAll(INTERACTION)];
    const nonInteraction = matchers.filter((x) => !/Called|Nth|Last/.test(x));
    if (interactions.length > 0 && nonInteraction.length === 0) add('interaction-only', start, `asserts only that mocks were called — check those mocks are external boundaries: "${name}"`);

    for (const r of body.matchAll(/expect\s*\(/g)) {
      const callEnd = matchParen(body, r.index + r[0].length - 1);
      if (/^\s*\.\s*(not\s*\.\s*)?(rejects|resolves)\b/.test(body.slice(callEnd))) {
        const before = body.slice(Math.max(0, r.index - 12), r.index);
        if (!/\b(await|return)\s*$/.test(before)) add('unawaited-async-assertion', open + r.index, 'expect(...).rejects/resolves without await or return — the assertion can run after the test ends');
      }
    }
    const tryCatch = body.match(/\btry\s*\{[\s\S]*?\}\s*catch\s*(\([^)]*\))?\s*\{([\s\S]*?)\}/);
    if (tryCatch && ASSERT.test(tryCatch[2]) && !/expect\.(assertions|hasAssertions)\s*\(|\b(assert\.)?fail\s*\(/.test(body)) {
      add('try-catch-assertion', start, `assertion inside catch with no guard (expect.assertions / assert.fail after the call) — passes if nothing throws: "${name}"`);
    }
    for (const c of body.matchAll(/\.(then|catch)\s*\(/g)) {
      const stmtStart = Math.max(body.lastIndexOf(';', c.index), body.lastIndexOf('{', c.index), body.lastIndexOf('\n', c.index));
      const stmt = body.slice(stmtStart + 1, c.index);
      const cbEnd = matchParen(body, c.index + c[0].length - 1);
      if (!/^\s*(await|return|const|let|var)\b/.test(stmt) && ASSERT.test(body.slice(c.index, cbEnd))) {
        add('callback-assertion', open + c.index, `assertion inside an un-awaited .${c[1]}() callback — the test ends before it runs, so it can't fail: "${name}"`);
      }
    }
    if (/\bassert\.ok\s*\(|\bassert\s*\(/.test(body) && !/\bassert\.(equal|deepEqual|strictEqual|deepStrictEqual|throws|rejects|match|notEqual)\s*\(|\bexpect\s*\(/.test(body)) {
      add('weak-assertions-only', start, `only assert.ok / assert(...) truthiness checks: "${name}"`);
    }
    for (const k of body.matchAll(/\b(expect|assert\.\w+)\s*\(/g)) {
      const callEnd = matchParen(body, k.index + k[0].length - 1);
      const constants = [...new Set(body.slice(k.index, callEnd).match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? [])];
      if (constants.length) add('constant-in-oracle', open + k.index, `assertion uses ${constants.join(', ')} — if that's a production constant, the expectation moves with the code (tautology) or tests a declaration: "${name}"`);
    }
    if (/\b(if|switch)\s*\(/.test(body) || /\bfor\s*\(/.test(body) || /\.forEach\s*\(/.test(body)) add('logic-in-test', start, `branching/looping in the test body — consider it.each or separate cases: "${name}"`);
    if (/expect\s*\(\s*(true|false|null|undefined|\d+)\s*\)/.test(body)) add('literal-expect', start, `expect(<literal>) — asserts a constant, not the code: "${name}"`);
    if (/new Promise\s*\(\s*\(?\s*\w+\s*\)?\s*=>\s*setTimeout\s*\(/.test(body)) add('real-sleep', start, `sleeps on real time — slow and flaky; use fake timers or wait for an outcome: "${name}"`);
  }

  for (const m of code.matchAll(/\b(fit|fdescribe|describe\.only)\s*\(/g)) add('focused', m.index, `${m[1]} focuses this block`);
  for (const m of code.matchAll(/\b(xit|xdescribe|xtest|describe\.skip)\s*\(/g)) add('skipped', m.index, `${m[1]} skips this block`);
  for (const m of code.matchAll(/\bas\s+any\b|\bas\s+unknown\s+as\b/g)) add('type-escape', m.index, 'cast in test code — a typed factory or Partial-with-defaults usually removes it, and casts hide fixture drift');
  for (const m of code.matchAll(/@ts-ignore|@ts-nocheck/g)) add('type-escape', m.index, 'type checking disabled in test code');
  for (const m of code.matchAll(/\b(vi|jest)\.mock\s*\(\s*/g)) {
    const target = src.slice(m.index + m[0].length, m.index + m[0].length + 120).match(/^(['"`])(.*?)\1/);
    if (target && /^(\.|@\/|~\/|src\/)/.test(target[2])) add('internal-module-mock', m.index, `mocks an internal module '${target[2]}' — the test may prove only that the mocks agree`);
  }
  if (!usesFakeTimers) {
    for (const m of code.matchAll(/\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bMath\.random\s*\(|\bcrypto\.randomUUID\s*\(/g)) add('nondeterminism', m.index, `${m[0].replace(/\s+/g, '')} in a test file with no fake timers — check the result doesn't depend on it`);
  }
  const snapshots = [...code.matchAll(/\.(toMatchSnapshot|toMatchInlineSnapshot|toMatchFileSnapshot)\s*\(/g)];
  if (snapshots.length) add('snapshot', snapshots[0].index, `${snapshots.length} snapshot assertion(s) — check each snapshot is small and reviewed, not a rubber stamp`);

  return { file, tests: tests.length, findings };
}

const files = walk(root, []).filter((f) => !include || f.includes(include)).sort();
const results = files.map(scanFile);
const totals = {};
for (const r of results) for (const f of r.findings) totals[f.kind] = (totals[f.kind] ?? 0) + 1;
const summary = { root, testFiles: results.length, tests: results.reduce((s, r) => s + r.tests, 0), findingsByKind: totals };

if (asJson) {
  process.stdout.write(JSON.stringify({ summary, results: results.map((r) => ({ ...r, file: relative(root, r.file) })) }, null, 2) + '\n');
} else {
  console.log(`# Test smell scan: ${root}\n`);
  console.log(`${summary.testFiles} test files, ~${summary.tests} tests. Heuristic leads only — confirm each by reading the test.\n`);
  if (Object.keys(totals).length) {
    console.log('| Kind | Count |\n|---|---|');
    for (const [k, v] of Object.entries(totals).sort((a, b) => b[1] - a[1])) console.log(`| ${k} | ${v} |`);
    console.log('');
  }
  for (const r of results) {
    if (!r.findings.length) continue;
    console.log(`## ${relative(root, r.file)} (${r.tests} tests)`);
    for (const f of r.findings.sort((a, b) => a.line - b.line)) console.log(`- L${f.line} **${f.kind}** — ${f.note}`);
    console.log('');
  }
}

