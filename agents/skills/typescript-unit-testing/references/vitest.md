# Vitest: commands, config and version differences

Check the installed version first —
`node -p "require('vitest/package.json').version"` — several defaults
changed between v3, v4 and v5, and advice written for one is wrong for
another. Prefer the repo's own script (`npm test -- <args>`) so its config
and setup files apply. If `npx vitest` would download Vitest rather than use
the repo's copy, stop and ask.

## Contents

1. Version differences that change advice
2. Command cheat sheet
3. Reading output without flooding context
4. Mock lifecycle and config
5. Module mocking
6. Fake timers and waiting
7. Type tests
8. Flake hunting
9. Coverage
10. Mutation testing (Stryker)
11. Slow suites and hanging processes

---

## 1. Version differences that change advice

| Topic | v3 | v4 | v5 |
|---|---|---|---|
| `restoreMocks` / `vi.restoreAllMocks` | also reset plain `vi.fn` mocks in older versions — check the installed docs | **only** restores `vi.spyOn` spies — plain `vi.fn()` implementations are untouched | same as v4 |
| `mockReset` on `vi.fn(impl)` | resets to empty function | resets to `impl` | same as v4 |
| `clearMocks` default | false | false | **true** (history cleared, implementations kept) |
| Un-awaited `expect(p).rejects/resolves` | may pass silently or only warn, depending on minor version | auto-awaited with a warning | **fails the test** |
| `-t` name matching | segments joined with a space | same | joined with `" > "` — use `-t 'math > adds'` |
| `vi.mock` / `vi.hoisted` inside a function or `test` | warning | warning | **throws** |
| Test options | `test(name, fn, options)` allowed | third-arg options **removed** — use `test(name, { timeout }, fn)` | same |
| Coverage | `coverage.all` exists | `coverage.all` removed: only files loaded in the run are reported | include/exclude relative to root |
| Default `exclude` | many patterns | only `node_modules` and `.git` | same |
| `workspace` config | renamed to `projects` in 3.2 | `projects` | `projects` |
| Fake timers | `Date` faked by default | same | also fakes `Temporal`; `setSystemTime` mocks it |
| Runtime | — | — | Node ≥ 22.12, Vite ≥ 6.4 |
| `toThrow('')` | — | — | matches any message (an empty string asserts nothing) |
| `expectTypeOf(...).toMatchTypeOf` | ok | deprecated in favour of `toExtend` | use `toExtend` |

Consequences for audits: on v3 and earlier treat an un-awaited `rejects` as
a test that may not be able to fail (probe it); on v4 it's a warning to fix; on v5 the runner catches it. A suite that
relied on `restoreMocks: true` to reset `vi.fn()` stubs leaks state after
upgrading to v4.

## 2. Command cheat sheet

| Task | Command |
|---|---|
| Run once (no watch) | `vitest run` (bare `vitest` watches locally, runs once in CI) |
| One file / directory | `vitest run src/billing/discount.test.ts` (positional args are path filters) |
| By test name (regex) | `vitest run -t "refund"` (v5: describe/test segments joined by `" > "`) |
| Repeat each test N times | `vitest run --repeats 20 src/a.test.ts` |
| Shuffle order (replayable) | `vitest run --sequence.shuffle --sequence.seed 1234` |
| Serial | `vitest run --no-file-parallelism` |
| Stop early | `vitest run --bail 1` |
| Only files affected by changes | `vitest run --changed` / `--changed main` |
| Fail on committed `.only` | `--allowOnly=false` (default when `CI` is set) |
| Coverage | `vitest run --coverage` |
| Type tests | `vitest run --typecheck` (or `--typecheck.only`) |
| Compact reporters | `--reporter=dot`, `--reporter=agent` (where available), `--reporter=json` (v5 writes it to `.vitest/json/output.json` by default) |

`npx vitest --help` on the installed version is the ground truth for flags.

## 3. Reading output without flooding context

```bash
npx vitest run src/billing > .ai-dev/run.log 2>&1; echo "exit $?"
tail -40 .ai-dev/run.log
grep -nE "FAIL|×|AssertionError|Expected|Received|Error:" .ai-dev/run.log | head -60
```

Fix failures one at a time: rerun just that test (`-t`), fix, rerun it a few
times (`--repeats 5`), then rerun the wider set once.

## 4. Mock lifecycle and config

| | Clears call history | Resets implementation | Restores real method (spies) |
|---|---|---|---|
| `mockClear()` / `vi.clearAllMocks()` / `clearMocks` | yes | no | no |
| `mockReset()` / `vi.resetAllMocks()` / `mockReset` | yes | yes (v4+: back to the `vi.fn(impl)` impl) | no |
| `mockRestore()` / `vi.restoreAllMocks()` / `restoreMocks` | yes | yes, for `vi.spyOn` spies | yes (v4+: **only** `vi.spyOn` spies) |

Leak-proof default for a repo on v4/v5:

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    mockReset: true,     // stubs like mockResolvedValue can't leak into the next test
    restoreMocks: true,  // vi.spyOn spies put the real method back
    unstubEnvs: true,    // vi.stubEnv undone before each test
    unstubGlobals: true, // vi.stubGlobal undone before each test
  },
});
```

`mockReset: true` also wipes implementations set at module scope or in
`vi.mock` factories before each test — if the suite relies on those, set them
in `beforeEach` instead, or reset per mock. Proposing a config change to a
repo is a suite-level finding for the user to decide, not something to slip
into a test PR.

## 5. Module mocking

- `vi.mock(path, factory?)` is **hoisted** to the top of the file and applies
  to every import of that module in the file. Must be top level (v5 throws
  otherwise).
- Variables the factory uses must come from `vi.hoisted(() => ({ ... }))`.
- Partial mocks: `vi.mock('./mailer', async (importOriginal) => ({ ...(await importOriginal<typeof import('./mailer')>()), send: vi.fn() }))`.
- `vi.mock(path, { spy: true })` keeps the real implementations while
  recording calls — useful when you need to assert a command but want the
  real behaviour.
- `vi.doMock` is not hoisted; it affects subsequent dynamic `import()`s only.
- Type mocked imports with `vi.mocked(fn)` (`vi.mocked(obj, true)` or
  `{ deep: true }` for nested).
- The path must resolve to the same module the subject imports (alias vs.
  relative). A mock that silently doesn't apply means the test runs against
  the real module — probe it.

Prefer injection over module mocks for code you own (see
`principles.md`); keep `vi.mock` for third-party packages with no seam.

## 6. Fake timers and waiting

```ts
beforeEach(() => {
  vi.useFakeTimers();                                  // fakes setTimeout/setInterval/Date…; not nextTick/queueMicrotask
  vi.setSystemTime(new Date('2026-03-31T23:59:30Z'));  // doesn't fire timers
});
afterEach(() => vi.useRealTimers());
```

- Advance with the async variants whenever promises are involved:
  `await vi.advanceTimersByTimeAsync(ms)`, `await vi.runAllTimersAsync()`,
  `await vi.runOnlyPendingTimersAsync()`. The sync ones don't let awaited
  continuations run between timers.
- `runAllTimers` stops at `fakeTimers.loopLimit` (10 000) — an interval that
  keeps rescheduling needs `advanceTimersByTime` instead.
- Waiting for an outcome instead of a duration:
  `await vi.waitFor(() => expect(store.status).toBe('done'))` or
  `await expect.poll(() => store.status).toBe('done')`. Both advance fake
  timers between attempts. `expect.poll` must be awaited.

## 7. Type tests

```ts
// src/pick.test-d.ts — picked up by `vitest --typecheck` (default pattern *.test-d.ts)
import { expectTypeOf } from 'vitest';
expectTypeOf(pick({ a: 1, b: 'x' }, ['a'])).toEqualTypeOf<{ a: number }>();
expectTypeOf<Admin>().toExtend<User>();
// @ts-expect-error — 'c' is not a key
pick({ a: 1 }, ['c']);
```

`expectTypeOf`/`assertType` do nothing at runtime. Without `--typecheck`
(or a `tsc` run that includes the file) they test nothing — check the repo's
scripts/CI actually run them.

## 8. Flake hunting

1. `vitest run src/a.test.ts -t "name" --repeats 30` — does it fail sometimes?
2. `--sequence.shuffle` with a fixed `--sequence.seed` to replay an
   order-dependent failure.
3. Alone vs. in its file vs. full run — passes alone, fails together → shared
   state; fails alone → it relied on an earlier test's setup.
4. Usual causes: real time and timezones, unseeded randomness, un-awaited
   promises, leaking stubs (`mockReset` not set), module singletons, parallel
   files sharing a DB/port/temp dir, `concurrent` tests sharing mocks
   (mock config hooks interact across concurrent tests).
5. Fix the cause. `retry` hides flakiness from CI, not from users; use it
   only as a labelled stopgap.

## 9. Coverage

- Default provider `v8` (AST-based remapping since v4, accurate enough for
  branch analysis); `istanbul` is the alternative.
- Since v4 only files loaded by tests are reported — completely untested
  files don't appear at all. Set `coverage.include` (e.g. `['src/**']`) to
  see them.
- Use coverage to find unexecuted code in risky modules; never write
  assertion-free tests to move a threshold.

## 10. Mutation testing (Stryker)

`@stryker-mutator/core` + `@stryker-mutator/vitest-runner` (optionally
`@stryker-mutator/typescript-checker` to drop mutants that don't compile).
Don't install without asking.

```bash
npx stryker run --mutate "src/billing/discount.ts"         # one file
npx stryker run --mutate "src/billing/discount.ts:20-48"   # a line range
npx stryker run --incremental                              # reuse previous results
```

- Scope it to the files under audit or changed by a PR; whole-repo runs are
  slow.
- **Survived** mutants are missing/weak tests or equivalent mutants (judge
  which). **No coverage** mutants are untested code.
- With the `json` reporter, `reports/mutation/mutation.json` lists which
  tests killed each mutant — two tests killing exactly the same set are
  redundant with each other.
- Without Stryker, `scripts/probe-mutation.mjs` does the same one mutant at a
  time.

## 11. Slow suites and hanging processes

- `--reporter=hanging-process` shows what keeps the process alive after
  tests finish. Close servers, DB pools, Redis clients (`quit()`), clear
  intervals, restore real timers.
- Barrel imports (`index.ts` re-exporting everything) make each test load
  the whole module graph; import from the defining module.
- `environment: 'node'` (default) unless the test needs a DOM; jsdom and
  happy-dom cost startup time per file.
- Vitest strips types with esbuild and doesn't type-check tests; run `tsc`
  over the test files separately (see SKILL.md Step 0).
