# Test smell catalogue (for audits)

Each entry: **symptom** → how to **confirm** it → why it **matters** →
the **fix** → default **verdict / severity**. Severity rises one level when
the behaviour involved is money, auth, permissions, data integrity, or a
parser at a trust boundary; it falls when the test is in throwaway or
prototype code.

## Contents

- A. Tests that can't fail (false confidence)
- B. Tests coupled to implementation (false alarms)
- C. Tests that protect nothing worth protecting
- D. Redundancy
- E. Non-determinism and isolation
- F. Type-safety holes in test code
- G. Gaps (missing tests)

---

## A. Tests that can't fail

**A1. No assertion.** The test runs code and asserts nothing; it passes
unless something throws.
Confirm: no `expect`/`assert` and no assertion helper in the body (check
helpers — a `renderAndCheck()` may assert internally).
Fix: assert the outcome. If "doesn't throw" really is the behaviour, say so
explicitly: `expect(() => f()).not.toThrow()` with a title that says it.
Verdict: Strengthen. Severity: High.

**A2. Un-awaited async assertion.** `expect(p).rejects.toThrow()` or
`.resolves` without `await` (or `return`). The test finishes before the
promise settles; a failure surfaces as an unhandled rejection or not at all.
Same for `expect` inside `.then()`/`subscribe()`/event callbacks the test
doesn't wait for.
Confirm: probe — make the promise resolve instead of reject. Version matters
(`vitest.md` §1): v5 fails an un-awaited `rejects`/`resolves`; v4 auto-awaits
it with a warning; older versions may let it pass. Callback assertions
(`.then`/`.catch`/`subscribe`/event handlers the test doesn't wait for) can't
fail on any version.
Fix: `await expect(...)`; for callbacks, convert to a promise
(`await once(emitter, 'done')`, `firstValueFrom(obs$)`).
Verdict: Strengthen. Severity: High for callbacks and pre-v4 `rejects` (Critical on important paths); Low on v5, where the runner already catches it.

**A3. Assertion in a `catch` that may never run.**
```ts
try { await withdraw(acct, 500); } catch (e) { expect(e).toBeInstanceOf(InsufficientFunds); }
```
If `withdraw` succeeds, nothing is asserted.
Fix: `await expect(withdraw(acct, 500)).rejects.toThrow(InsufficientFunds)`,
or `expect.assertions(1)` as a guard.
Verdict: Strengthen. Severity: High.

**A4. Tautological oracle.** The expected value is computed by the code
under test or by the same formula: `expect(total(items)).toBe(items.reduce(...same logic...))`,
or the test imports the production constant and multiplies.
Confirm: change the formula in production; the test changes with it.
Fix: hard-code the expected literal from an independent source (worked by
hand, from the spec).
Verdict: Rewrite. Severity: High.

**A5. Asserting the stub.** A mock is set to return `X`, the subject
forwards it, and the test asserts `X` came back. Only the mocking library is
tested. Common in controller tests that mock the service.
Confirm: the subject has no logic between the stub and the return value.
Fix: if there's no logic, delete and rely on an integration test of the
route; if there is logic (mapping, status codes, error translation), assert
that.
Verdict: Delete or Rewrite. Severity: Medium.

**A6. Weak oracle.** `toBeDefined()`, `toBeTruthy()`, `not.toBeNull()`,
`toBeInstanceOf(Object)`, `toHaveLength(n)` alone, `.resolves.not.toThrow()`,
`expect.anything()` everywhere, `toMatchObject({})` — when the actual value
is known. A `findOne` returning `null` passes `toBeDefined()`.
Confirm: probe — return a wrong-but-present value; the test stays green.
Fix: assert the specific value or the fields that matter.
Verdict: Strengthen. Severity: Medium (High if it's the only test of that behaviour).

**A7. Literal or self-referential expectation.** `expect(true).toBe(true)`,
`expect(x).toBe(x)`, `expect(mock).toBe(mock)`.
Verdict: Delete or Strengthen. Severity: High.

**A8. Committed `.only`.** `.only` makes the rest of that file skip. Vitest
refuses it when `CI` is set (`allowOnly` defaults to `!process.env.CI`), but
local runs, and CI that doesn't set `CI` or sets `allowOnly: true`, run a
fraction of the suite while staying green.
Fix: remove it; keep `allowOnly` off in CI; add `vitest/no-focused-tests`
(`@vitest/eslint-plugin`).
Verdict: Strengthen. Severity: Critical.

**A9. Skipped tests with no reason.** `.skip`, `xit`, `.todo`, commented-out
tests. They read as coverage that doesn't exist.
Confirm: `git log -S'.skip(' -- <file>` — how long has it been skipped?
Fix: re-enable and fix, delete, or keep with a linked ticket in the reason.
Verdict: depends; report each. Severity: Medium (High if it guards
important behaviour).

**A10. Mocking the subject.** `vi.spyOn(service, 'calculate').mockReturnValue(...)`
on the very object under test, then asserting on its output.
Verdict: Rewrite. Severity: High.

## B. Coupled to implementation

**B1. Interaction assertions on owned collaborators or queries.**
`toHaveBeenCalledWith`/`toHaveBeenCalledTimes` on internal helpers,
repositories used for reads, mappers, loggers.
Confirm: is the asserted dependency an unmanaged out-of-process system
receiving a *command*? If not, it's coupling.
Fix: assert the output or resulting state; use a fake instead of a mock.
Verdict: Rewrite. Severity: Medium.

**B2. Call order.** `toHaveBeenCalledBefore`, `mock.invocationCallOrder`,
`toHaveBeenNthCalledWith` across different collaborators — unless ordering
is the contract (write-ahead before publish, lock before mutate).
Verdict: Rewrite. Severity: Medium.

**B3. Private access.** `service['privateField']`, `(svc as any).helper`,
`vi.spyOn(svc as any, 'privateMethod')`, testing non-exported functions via
rewire-style hacks.
Fix: test through the public API; if the private logic is complex enough to
want its own tests, it wants to be its own exported unit.
Verdict: Rewrite. Severity: Medium.

**B4. Internal module mocks.** `vi.mock('./pricing')`, `vi.mock('@/lib/db')`
for modules the repo owns. The test proves the subject calls the mock the
way the mock was set up to be called.
Confirm: the mocked path is relative or an internal alias, not a package
for an external service.
Not this smell: a **thin adapter you own whose only job is to talk to an
unmanaged external system** (a `notifier.ts` wrapping an email API, a
`stripe-gateway.ts`). That module *is* the seam to mock at, and asserting
the command sent through it is correct (`principles.md` §4–5). Prefer
injecting it over `vi.mock` when the code allows, and cover the adapter
itself with an MSW test at the HTTP edge.
Fix: use the real module; if it does I/O, inject a fake through a parameter
or constructor; or move the test up a level.
Verdict: Rewrite. Severity: Medium (High when several internal modules are
mocked and the test asserts only interactions).

**B5. Snapshot abuse.** Large `toMatchSnapshot()` of whole objects, rendered
trees or API responses; snapshots containing timestamps/IDs; `.snap` files
updated in the same commits as the code with no review (check
`git log -p -- '*.snap'`).
Fix: assert the few fields that matter; use small inline snapshots for
genuinely textual contracts; property matchers
(`toMatchSnapshot({ id: expect.any(String) })`) for dynamic fields.
Verdict: Rewrite. Severity: Medium.

**B6. Exact prose / log assertions.** Asserting full error messages that
aren't contract, log lines, or AI-generated text.
Fix: assert error type/code, or a stable key fragment; assert logs only when
logging is the product (audit trails).
Verdict: Strengthen/Rewrite. Severity: Low–Medium.

**B7. Over-specified fixtures in assertions.** `toEqual` on a 40-field object
where the test is about one field — every unrelated schema change breaks it.
Fix: `toMatchObject` / `expect.objectContaining` on the relevant fields, or
assert the field directly.
Verdict: Strengthen. Severity: Low.

## C. Protects nothing worth protecting

**C1. Tests the compiler.** "rejects non-string input" for a function typed
`(s: string)` with only internal callers; `@ts-expect-error` passing a wrong
type to call it at runtime. Exception: the function is a public API called
from untyped JS or across a trust boundary.
Verdict: Delete. Severity: Low.

**C2. Tests the framework or a library.** That `z.string().email()` rejects
`"x"`, that `ParseIntPipe` parses, that `Array.prototype.map` maps, that
React renders a prop. Exception: your schema's *composition* (which fields
are required, refinements you wrote) is your behaviour — test that.
Verdict: Delete. Severity: Low.

**C3. Tests declarations.** Enums, constants, interfaces, re-exports,
`expect(module).toBeDefined()` / "should be defined" boilerplate generated
by scaffolding (NestJS `it('should be defined')`).
Verdict: Delete. Severity: Low.

**C4. Tests trivial code.** Getters, setters, pure pass-throughs with no
branching. They inflate coverage and the edit cost of renames.
Verdict: Delete (or Merge into a test of the behaviour that uses them).
Severity: Low.

## D. Redundancy

**D1. Same partition, same oracle.** `discount(150)` and `discount(175)`
both in the "over threshold" partition, asserting the same rule.
Confirm: probe — every mutation that kills one kills the other.
Fix: keep one per partition plus boundary cases; collapse genuine data
variations into `it.each`.
Verdict: Merge. Severity: Low–Medium (by edit cost).

**D2. Same behaviour tested at several levels.** A unit test, an integration
test and an e2e test all asserting the same rule on the same input. Keep the
cheapest one that catches the bug; keep the higher-level ones for wiring.
Verdict: Merge/Delete the duplicate unit-level case. Severity: Low.

**D3. Copy-pasted setup.** Twenty tests with the same 15-line arrange block.
Not redundant coverage, but maintenance cost — extract a typed factory.
Verdict: Strengthen (refactor). Severity: Low.

**D4. Shared helper with one consumer.** A `*.testutil.ts` that one test file
imports, or a helper that only forwards its arguments (`build(x) => new X(x)`).
The module and the indirection cost a reader a jump and protect nothing.
Confirm: `node <skill-dir>/scripts/find-single-use-testutils.mjs <package> [--only=<files>]`.
Fix: move the helper into its consumer until a second suite needs it. Keep a
forwarding wrapper only when it does something a reader can't see, and say
what in a one-line comment (e.g. it keeps a lint false positive to one line).
Verdict: Merge. Severity: Low.

## E. Non-determinism and isolation

**E1. Real time.** `Date.now()`, `new Date()`, real `setTimeout` sleeps,
timezone-dependent formatting, tests that fail near midnight or month-end.
Fix: `vi.useFakeTimers()` + `vi.setSystemTime(...)`, inject a clock, pin
`TZ` in the test env, wait on outcomes (`vi.waitFor`, `expect.poll`) not
durations.
Verdict: Rewrite. Severity: High if it has flaked; Medium otherwise.

**E2. Unseeded randomness / UUIDs** affecting assertions.
Fix: inject the generator or seed it; assert shape, not value, where the
value is genuinely random.
Verdict: Rewrite. Severity: Medium.

**E3. Shared mutable state / order dependence.** Module-level fixtures
mutated by tests, `beforeAll` setup with per-test mutation, mocks configured
in one test leaking to the next because `mockReset` isn't set
(`clearMocks`/`clearAllMocks` clear calls but **keep** `mockReturnValue` /
`mockResolvedValue` implementations; on v4+ `restoreMocks` only restores
`vi.spyOn` spies).
Confirm: `vitest run <file> --sequence.shuffle --repeats 10`, and run the
file's tests one at a time with `-t`.
Fix: fresh state in `beforeEach`; set `mockReset: true` (and
`restoreMocks: true` for spies) in config; avoid module-level mutable
fixtures.
Verdict: Rewrite. Severity: High.

**E4. Env / global mutation without restore.** `process.env.X = ...`,
`globalThis.fetch = ...`, `Date.prototype` patches with no `finally`/
`afterEach` restore.
Fix: `vi.stubEnv` / `vi.stubGlobal` with `unstubEnvs`/`unstubGlobals` in
config; or try/finally.
Verdict: Strengthen. Severity: Medium.

**E5. Real network or filesystem** in a "unit" test. Slow, flaky, and
sometimes hitting real services.
Fix: MSW with `onUnhandledRequest: 'error'`; in-memory fs (`memfs`) or a
temp dir created and removed per test.
Verdict: Rewrite. Severity: Medium–High.

**E6. Leaked handles.** Timers, sockets, DB pools left open: the run hangs
after the tests finish, or a "close timed out" warning appears.
`--reporter=hanging-process` shows what's holding it open.
Fix: close what you open in `afterEach`/`afterAll` (servers, pools, Redis
`quit()`), clear intervals, `vi.useRealTimers()` after fake-timer tests.
Killing the process (e.g. `teardownTimeout` tricks) hides the leak; don't
adopt it as a fix.
Verdict: Strengthen. Severity: Medium.

## F. Type-safety holes in test code

**F1. `as any` / `as unknown as T` fixtures.** Hide drift between fixtures
and real types; the test passes on shapes production can't produce.
Fix: typed factory with valid defaults and `Partial<T>` overrides; parse
through the real schema; `satisfies T` for literals.
Verdict: Strengthen. Severity: Medium (High at trust boundaries, where
realistic shapes are the point).

**F2. Untyped mocks.** `const repo: any = { find: vi.fn() }`, mocks missing
methods the subject calls (silently `undefined`).
Fix: `vi.mocked(...)`, `vi.fn<Fn>()` with a function type, a small class
implementing the interface, or `vitest-mock-extended` `mock<T>()` if
already in use.
Verdict: Strengthen. Severity: Low–Medium.

**F3. Tests not type-checked at all.** The tsconfig used by `tsc` excludes
test files, and Vitest strips types without checking them. Type tests (`expectTypeOf`,
`@ts-expect-error`) silently test nothing.
Fix: a `tsconfig.test.json` (or include tests in the main one) run in CI;
Vitest `--typecheck` for type tests.
Verdict: report as a suite-level finding. Severity: Medium (High if the repo
relies on type tests).

## G. Gaps

Look for behaviour with no test that would fail if it broke:

- Boundaries of every comparison in business rules (`>=` vs `>`).
- Every `throw`/error result a caller can observe — list them from the
  source (`rg -n "throw new|err\(|Result\.err|reject\(" src/<area>`) and map
  each to a test that checks its type/code.
- Each variant of a discriminated union in reducers and handlers.
- Parsers and guards at trust boundaries, with hostile and malformed input.
- Partial failure after a side effect: for code that does more work after a
  write has saved, each dependency of that later work failing on its own.
  Find them by listing the awaited calls after the write
  (`Promise.all([...])` entries, chained `.then`s). A `.catch` on only some
  of them is the usual sign. Severity: High when the caller would report a
  saved write as failed and retrying would repeat it.
- Recently fixed bugs without a regression test (`git log --grep -i fix`).
- Surviving mutants from a Stryker run or probes.

Rank gaps by risk (impact × likelihood), not by count. A missing test on
refund rounding outranks ten missing tests on a string formatter.
