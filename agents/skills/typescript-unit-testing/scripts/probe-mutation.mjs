#!/usr/bin/env node
// Prove a test can fail: apply one deliberate bug to a source file, run a test command,
// and always restore the file. KILLED (command failed) means some test noticed the bug;
// SURVIVED (command passed) means no test checks that behaviour.
//
// Usage:
//   node probe-mutation.mjs --file src/price.ts --find '>= 100' --replace '> 100' \
//     --cmd 'npx vitest run src/price.test.ts' [--line 42] [--no-baseline] [--timeout 120] \
//     [--log .ai-dev/probes.jsonl]
//
// --log appends one JSON line per probe (mutation, command, result), so the claims in a
// report can be checked later instead of taken on trust.
//
// --find must match exactly once (or exactly once on --line). The original bytes are
// saved to <file>.probe-backup before mutating and restored in a finally block and on
// SIGINT/SIGTERM. If a backup already exists, the script refuses to run: restore it first.
//
// The command runs in its own process group with output streamed to a temp file, so a
// verbose test run can't overflow a buffer, and on timeout (or interruption) the whole
// group — the shell and the test runner it started — is killed before the file is
// restored. A command that can't be run or dies from a signal is reported as ERROR,
// never as KILLED. Process groups make this macOS/Linux only. No dependencies.
//
// Before running anything, the mutated source is syntax-checked, using the repo's own
// `typescript` when it resolves, otherwise Node's type stripping plus `node --check`. A
// mutation that doesn't parse is reported as INVALID and no tests run: a test run that
// fails because the file can't load proves nothing about the tests. If the checker can't
// parse the original file either (an unsupported file type), the check is skipped and
// logged as `unchecked`.

import {
  appendFileSync, closeSync, copyFileSync, existsSync, fstatSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, readSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as nodeModule from 'node:module';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}
const file = arg('file');
const find = arg('find');
const replace = arg('replace');
const cmd = arg('cmd');
const line = arg('line') ? Number(arg('line')) : undefined;
const timeoutSec = Number(arg('timeout') ?? 300);
const baseline = !process.argv.includes('--no-baseline');
const logFile = arg('log');

if (!file || find === undefined || replace === undefined || !cmd) {
  console.error('Usage: probe-mutation.mjs --file <path> --find <text> --replace <text> --cmd <test command> [--line N] [--no-baseline] [--timeout S] [--log <file.jsonl>]');
  process.exit(2);
}
const backup = `${file}.probe-backup`;
if (existsSync(backup)) {
  console.error(`Refusing to run: ${backup} exists from an interrupted probe. Restore it with: mv '${backup}' '${file}'`);
  process.exit(2);
}

const original = readFileSync(file, 'utf8');
const lines = original.split('\n');
let mutated;
if (line !== undefined) {
  const target = lines[line - 1];
  if (target === undefined || target.split(find).length !== 2) {
    console.error(`--find must occur exactly once on line ${line}. Line is: ${JSON.stringify(target)}`);
    process.exit(2);
  }
  lines[line - 1] = target.replace(find, () => replace);
  mutated = lines.join('\n');
} else {
  const count = original.split(find).length - 1;
  if (count !== 1) {
    console.error(`--find occurs ${count} times in ${file}; it must occur exactly once (or pass --line).`);
    process.exit(2);
  }
  mutated = original.replace(find, () => replace);
}

// Returns null when the source parses, or a one-line error when it doesn't.
// Throws 'unsupported' when no checker can handle this file type.
function syntaxError(path, source) {
  const ext = extname(path);
  let ts = null;
  try { ts = createRequire(join(process.cwd(), 'package.json'))('typescript'); } catch { /* not installed */ }
  if (ts && /^\.[cm]?[jt]sx?$/.test(ext)) {
    const out = ts.transpileModule(source, {
      fileName: basename(path),
      reportDiagnostics: true,
      compilerOptions: { allowJs: true, jsx: ts.JsxEmit.Preserve },
    });
    const first = (out.diagnostics ?? [])[0];
    return first ? ts.flattenDiagnosticMessageText(first.messageText, ' ') : null;
  }
  let js = source;
  let inputType;
  if (/^\.[cm]?ts$/.test(ext) && typeof nodeModule.stripTypeScriptTypes === 'function') {
    const emit = process.emitWarning;
    process.emitWarning = () => {}; // stripTypeScriptTypes is experimental and says so on stderr
    try {
      js = nodeModule.stripTypeScriptTypes(source, { mode: 'transform' });
    } catch (e) {
      return String(e.message).split('\n')[0];
    } finally {
      process.emitWarning = emit;
    }
    inputType = ext === '.cts' ? ['commonjs'] : ['module'];
  } else if (ext === '.mjs') inputType = ['module'];
  else if (ext === '.cjs') inputType = ['commonjs'];
  else if (ext === '.js') inputType = ['module', 'commonjs'];
  else throw new Error('unsupported');
  let message = null;
  for (const type of inputType) {
    const r = spawnSync(process.execPath, [`--input-type=${type}`, '--check'], { input: js, encoding: 'utf8' });
    if (r.status === 0) return null;
    message = (r.stderr.split('\n').find((l) => /Error/.test(l)) ?? 'syntax error').trim();
  }
  return message;
}

function checkMutant(path, before, after) {
  try {
    if (syntaxError(path, before) !== null) return { status: 'unchecked' };
    const error = syntaxError(path, after);
    return error === null ? { status: 'ok' } : { status: 'invalid', error };
  } catch {
    return { status: 'unchecked' };
  }
}

const KILL_GRACE_MS = 2000;
let activeGroup = null;

function killGroup(pid, signal) {
  try { process.kill(-pid, signal); } catch { /* group already gone */ }
}

function lastLines(path, count) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, 64 * 1024);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, size - length);
    return buf.toString('utf8').split('\n').slice(-count).join('\n');
  } finally {
    closeSync(fd);
  }
}

// Resolves once the command has exited and nothing from its process group is left running.
async function run() {
  const outDir = mkdtempSync(join(tmpdir(), 'probe-mutation-'));
  const outPath = join(outDir, 'output.log');
  const outFd = openSync(outPath, 'w');
  const child = spawn(cmd, {
    shell: true,
    detached: true, // own process group, so the runner's children can be killed with it
    stdio: ['ignore', outFd, outFd],
    env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
  });
  closeSync(outFd);
  activeGroup = child.pid ?? null;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killGroup(child.pid, 'SIGTERM');
    setTimeout(() => killGroup(child.pid, 'SIGKILL'), KILL_GRACE_MS).unref();
  }, timeoutSec * 1000);
  const { code, signal, error } = await new Promise((resolve) => {
    child.once('error', (err) => resolve({ code: null, signal: null, error: err }));
    child.once('exit', (c, s) => resolve({ code: c, signal: s, error: null }));
  });
  clearTimeout(timer);
  if (child.pid) killGroup(child.pid, 'SIGKILL'); // reap anything the shell left behind
  activeGroup = null;
  const tail = lastLines(outPath, 25);
  rmSync(outDir, { recursive: true, force: true });
  return { code, signal, error, timedOut, tail };
}

function describeFailure(r) {
  if (r.error) return `could not run the command: ${r.error.message}`;
  if (r.timedOut) return 'timed out';
  if (r.signal) return `killed by ${r.signal}`;
  return `exit ${r.code}`;
}

const syntax = checkMutant(file, original, mutated);
const describeMutation = `${JSON.stringify(find)} → ${JSON.stringify(replace)} in ${line !== undefined ? `${file}:${line}` : file}`;
if (syntax.status === 'invalid') {
  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), file, line, find, replace, cmd, result: 'INVALID', syntaxCheck: 'invalid', error: syntax.error }) + '\n');
  }
  console.log(`INVALID — ${describeMutation}: the mutated file doesn't parse (${syntax.error}). No tests were run; a failure here would prove nothing. Fix the find/replace text.`);
  process.exit(6);
}

if (baseline) {
  const b = await run();
  if (b.code !== 0 || b.error || b.timedOut) {
    console.log(`BASELINE FAILED (${describeFailure(b)}) — the command fails without any mutation, so a probe would prove nothing.\n${b.tail}`);
    process.exit(3);
  }
}

let restored = false;
function restore() {
  if (restored) return;
  writeFileSync(file, original);
  if (existsSync(backup)) unlinkSync(backup);
  restored = true;
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (activeGroup) killGroup(activeGroup, 'SIGKILL');
    restore();
    process.exit(130);
  });
}

copyFileSync(file, backup);
let result;
try {
  writeFileSync(file, mutated);
  result = await run();
} finally {
  restore();
}
// Belt and braces: confirm the restore produced the exact original bytes.
if (readFileSync(file, 'utf8') !== original) {
  writeFileSync(`${file}.probe-original`, original);
  console.error(`WARNING: ${file} does not match its original after restore; original saved to ${file}.probe-original`);
  process.exit(4);
}

const where = line !== undefined ? `${file}:${line}` : file;
// Only a normal non-zero exit is evidence that a test noticed the mutation.
const verdict = result.error || (result.signal && !result.timedOut)
  ? 'ERROR'
  : result.timedOut ? 'TIMEOUT' : result.code === 0 ? 'SURVIVED' : 'KILLED';
if (logFile) {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), file, line, find, replace, cmd, result: verdict, exitCode: result.code, signal: result.signal, syntaxCheck: syntax.status }) + '\n');
}
if (verdict === 'ERROR') {
  console.log(`ERROR — ${JSON.stringify(find)} → ${JSON.stringify(replace)} in ${where}: ${describeFailure(result)}. This is not evidence either way; rerun or fix the command.\n--- last lines ---\n${result.tail}`);
  process.exit(5);
}
if (result.timedOut) {
  console.log(`TIMEOUT — mutation ${JSON.stringify(find)} → ${JSON.stringify(replace)} in ${where} made the command hang (counts as killed, but check for an infinite loop).`);
  process.exit(0);
}
if (result.code === 0) {
  console.log(`SURVIVED — ${JSON.stringify(find)} → ${JSON.stringify(replace)} in ${where}: the tests still pass, so nothing checks this behaviour.`);
} else {
  console.log(`KILLED — ${JSON.stringify(find)} → ${JSON.stringify(replace)} in ${where}: the command failed (exit ${result.code}).\n--- last lines ---\n${result.tail}`);
}
process.exit(0);
