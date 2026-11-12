#!/usr/bin/env node
// Finds shared test helpers that aren't shared: *.testutil.* files (and their exports)
// imported by at most one other file. A helper module with one consumer adds a file
// and an indirection for nothing; keep the helper in that test until a second suite
// needs it. Every hit is a lead: a helper that a stacked or upcoming change will
// reuse can be right to keep, so say so in the PR.
//
// Usage: node find-single-use-testutils.mjs [root=.] [--only=path1,path2] [--exports] [--json]
//   root       directory whose files count as importers (e.g. one package)
//   --only     report just these testutil files (e.g. the ones a diff adds or changes)
//   --exports  also report exports of shared testutils that one file or none uses
//              (noisier: fixture modules often hold a few one-suite exports)
// Exit 1 when anything is reported, so it can gate a pre-PR check. No dependencies.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
const asJson = args.includes('--json');
const withExports = args.includes('--exports');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').filter(Boolean).map((p) => resolve(p)))
  : null;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.next', '.turbo', 'out', '__generated__']);
const SOURCE = /\.[cm]?[jt]sx?$/;
const TESTUTIL = /\.testutils?\.[cm]?[jt]sx?$/;

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p, out);
    } else if (SOURCE.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// The module name an import would end with: "foo.testutil" for foo.testutil.ts.
const stem = (file) => basename(file).replace(/\.[cm]?[jt]sx?$/, '');

function exportedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|interface|type|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.replace(/^type\s+/, '').trim();
      if (name) names.add(name);
    }
  }
  return names;
}

// Each import or re-export of `target` in src: the names it binds, or "*" for a namespace.
function importsOf(src, target) {
  const found = [];
  const re = /(?:import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const spec = m[3].replace(/\.[cm]?[jt]sx?$/, '');
    if (!spec.endsWith(`/${target}`) && spec !== target) continue;
    const clause = m[2];
    if (/\*\s+as\s+/.test(clause) || clause.trim() === '*') {
      found.push('*');
      continue;
    }
    const braces = clause.match(/\{([^}]*)\}/);
    for (const part of (braces ? braces[1] : '').split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
      if (name) found.push(name);
    }
  }
  return found;
}

const files = walk(root, []);
const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const report = [];

for (const util of files.filter((f) => TESTUTIL.test(f))) {
  if (only && !only.has(util)) continue;
  const target = stem(util);
  const consumersByName = new Map([...exportedNames(sources.get(util))].map((n) => [n, new Set()]));
  const importers = new Set();
  for (const [file, src] of sources) {
    if (file === util) continue;
    const names = importsOf(src, target);
    if (names.length === 0) continue;
    importers.add(file);
    for (const n of names) {
      if (n === '*') for (const set of consumersByName.values()) set.add(file);
      else consumersByName.get(n)?.add(file);
    }
  }
  const unshared = withExports ? [...consumersByName].filter(([, users]) => users.size <= 1) : [];
  if (importers.size > 1 && unshared.length === 0) continue;
  report.push({
    file: relative(process.cwd(), util),
    importers: [...importers].map((f) => relative(process.cwd(), f)),
    exports: unshared.map(([name, users]) => ({ name, users: [...users].map((f) => relative(process.cwd(), f)) })),
  });
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (report.length === 0) {
  console.log('No single-use testutil files or exports.');
} else {
  for (const r of report) {
    const who = r.importers.length === 0 ? 'no importers' : r.importers.length === 1 ? `only ${r.importers[0]}` : `${r.importers.length} importers`;
    console.log(`${r.file}: ${who}`);
    if (r.importers.length > 1) {
      for (const e of r.exports) console.log(`  ${e.name}: ${e.users.length === 0 ? 'unused' : `only ${e.users[0]}`}`);
    }
  }
  console.log('\nMove a helper into its one consumer until a second suite needs it, or say in the PR which upcoming change reuses it.');
}
process.exit(report.length === 0 ? 0 : 1);
