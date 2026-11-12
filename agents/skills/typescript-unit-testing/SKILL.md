---
name: typescript-unit-testing
description: Expert TypeScript unit testing with two jobs. (1) Write unit tests that earn their place — behaviour-focused, deterministic, typed without casts, mocking only what must be mocked, and each one proven able to fail. (2) Audit existing tests for validity and necessity — find tests that can't fail, restate their mocks, pin implementation details, duplicate each other, are flaky, or only test the compiler or the framework — give each a Keep / Strengthen / Rewrite / Merge / Delete verdict backed by evidence (mutation probes, not coverage %), and name the untested behaviour that matters. Built for Vitest (v3–v5): its mocking, fake timers, config, type tests and version differences. Use this whenever the user asks to write, add, improve, review, audit, clean up, de-flake or prune unit tests in a .ts/.tsx codebase; asks "are these tests any good", "do we need all these tests", "why didn't our tests catch this", "is this test useful"; mentions *.test.ts / *.spec.ts files, Vitest, vi.mock / vi.fn / vi.spyOn, mocks, fakes, fixtures, snapshots, fake timers, coverage, mutation testing, Stryker or fast-check; or wants test-first work on TypeScript code — even if they never say "unit test". Not for end-to-end/browser suites, load tests, or reviewing production-code types (use typescript-review for that).
---

# TypeScript Unit Testing

A test suite is a bet: every test costs reading time, run time and refactoring
friction, and pays back only when it catches a real bug that nothing else
would. This skill writes tests that pay back and audits whether existing ones
do. It is opinionated in the direction of the strongest modern testing
literature — Khorikov's *Unit Testing: Principles, Practices, and Patterns*,
Kent Beck's Test Desiderata, mutation testing, and property-based testing —
applied to how TypeScript code is really built and how agents really get
tests wrong.

The two failure modes this skill exists to prevent:

1. **False confidence.** Tests that pass no matter what the code does:
   no assertion, an un-awaited `rejects`, an expected value computed by the
   code under test, a mock asserting its own stubbed return value. Coverage
   goes up; protection doesn't.
2. **False alarms.** Tests that fail when nothing is wrong: pinned call order
   between internal helpers, spies on private methods, giant snapshots, real
   clocks. They train people to update tests blindly, which turns every
   other test into a rubber stamp too.

## The model, in one screen

Read `references/principles.md` the first time you use this skill in a
session; it has the reasoning and the edge cases. The short version:

- **A unit is a unit of behaviour, not a class or a file.** Test through the
  public surface a real caller uses. A function's private helpers are covered
  by testing the function.
- **Four pillars** (Khorikov): protection against regressions, resistance to
  refactoring, fast feedback, maintainability. Resistance to refactoring is
  not negotiable — a test that breaks on a behaviour-preserving refactor is a
  defect. Trade the other three against each other consciously.
- **What to replace with a double** — sort every dependency of the subject:
  - *In-process code you own* (helpers, domain objects, internal services):
    use the real thing. Needing several internal mocks is a design signal —
    widen the test or extract the logic into a pure function.
  - *Non-determinism* (clock, randomness, UUIDs, env): control it — fake
    timers, an injected clock, a seeded generator, `vi.stubEnv`.
  - *Out-of-process dependencies only your app touches* (your database, your
    cache): use a fake or in-memory implementation in unit tests; the real
    one belongs in integration tests.
  - *Out-of-process dependencies others observe* (third-party APIs, email,
    payment, messages to other teams): mock them, at the network edge where
    possible (MSW). Assert the **commands** you send them — that the charge
    was requested with the right amount — and never assert the **queries**
    you stubbed — that you called `getUser` is not behaviour.
- **TypeScript changes the calculus.** The compiler is the cheapest test you
  have. Don't write runtime tests for what the types already guarantee to
  internal callers (that `add` rejects a string). Do test every place where
  `unknown` data becomes typed data — parsers, schemas, guards, API and
  message handlers — because that is where types stop protecting you. Test
  type-level APIs with type tests (`expectTypeOf`, `@ts-expect-error`).
- **The oracle must be independent of the code.** Expected values are
  literals or come from a simpler, obviously-correct computation — never
  from re-running the production logic in the test.
- **A test earns its place** when (a) a plausible bug would make it fail,
  (b) no other test already fails for that same bug, and (c) no
  behaviour-preserving refactor would make it fail. Coverage percentage
  measures none of these; mutation testing measures (a) and (b) directly.

## Step 0 — Learn the repo first (both jobs)

Read, don't assume. Everything below changes what "correct" looks like:

- **Vitest version and config**: `node -p "require('vitest/package.json').version"`,
  and the `test` block of `vitest.config.*` / `vite.config.*` (or the
  `projects` entry that owns the file you're in). Several defaults changed
  between v3, v4 and v5 — mock reset semantics, un-awaited `rejects`, `-t`
  matching, `clearMocks` — so read the version table in
  `references/vitest.md` before judging or writing anything. If the repo
  uses Jest or another runner instead, the principles here still hold;
  translate the API and say you're doing so.
- **Config that changes test semantics**: `mockReset` / `restoreMocks` /
  `clearMocks`, `environment` / `testEnvironment` (node, jsdom,
  happy-dom, browser), `globals`, `setupFiles`, `sequence.shuffle`,
  `fakeTimers`, `unstubEnvs`. On v4+, `restoreMocks` only restores
  `vi.spyOn` spies — without `mockReset`, a `mockResolvedValue` set in one
  test leaks into the next, which explains a lot of order-dependent flakiness.
- **Are test files type-checked?** Many `tsconfig.json` files `exclude`
  `**/*.test.ts`, and Vitest strips types with esbuild without checking
  them. If tests aren't covered by any `tsc` run, casts and broken fixtures
  rot silently — note it and type-check them yourself
  (`npx tsc --noEmit -p <a tsconfig that includes them>`).
- **Conventions to follow, not fight**: file naming and location
  (`*.test.ts` vs `*.spec.ts`, co-located vs `__tests__`), existing factories
  and fixtures, test utilities, MSW handlers, custom matchers, how mocks are
  typed. Repo conventions (CLAUDE.md, AGENTS.md, CONTRIBUTING) beat this
  skill's style preferences; they don't beat correctness.
- **Tooling already installed**: `fast-check` / `@fast-check/vitest`,
  `@stryker-mutator/core` + `@stryker-mutator/vitest-runner`, `msw`, `@testing-library/*`, `tsd`. Never install a
  package to run a check without asking the user first.
- **Commands**: the package scripts for test, typecheck and lint.

Then run the relevant tests **once** before changing anything and record the
baseline. Send output to a log and read the tail, so a large suite doesn't
flood your context:

```bash
npx vitest run src/billing > .ai-dev/test-baseline.log 2>&1; echo "exit $?"
tail -40 .ai-dev/test-baseline.log
grep -nE "FAIL|✗|×|not ok|Error:" .ai-dev/test-baseline.log | head -40
```

Pre-existing failures are not yours to fix unless asked; you need them on
record so you can show you didn't cause them. `references/vitest.md` has
the commands (filter by file/name, repeat, shuffle, coverage).

## Job 1 — Writing tests

### 1. Find the behaviour, not the methods

Read the subject and its callers, its types, and whatever states intent
(ticket, PR description, docs, the user's words). List the behaviours a
caller relies on, in plain language: "orders of 100 or more get 10% off",
"a webhook with an unknown event type is acknowledged and ignored",
"retries three times then surfaces the last error". Each test title should
read as one of these sentences. Titles like `calls calculateDiscount` or
`should work` mean you're testing structure.

If you can't tell what the intended behaviour is — the code and the ticket
disagree, or an edge case is genuinely undecided — ask. A test that pins
down a guess at behaviour is worse than no test, because it will be trusted.

### 2. Choose the level before writing anything

- Logic buried inside I/O (a handler that parses, decides, then writes):
  test the decision as a pure function if it already is one; if it isn't,
  say so and propose the extraction — don't refactor production code
  unasked just to make it testable.
- Needing more than one mock of your own modules means the unit boundary is
  wrong. Widen the test to include the real collaborators, or test the pure
  core and leave the wiring to an integration test.
- Thin glue with no decisions (a controller that only forwards to a
  service) is usually not worth a unit test; the integration test of the
  route covers it. Say so rather than writing a mock-forwarding test.

### 3. Design the cases deliberately

Work out the case list before writing code, using the techniques in
`references/patterns.md` ("Choosing cases"):

- **Equivalence partitions and boundaries** — one case per partition, plus
  both sides of every boundary (99, 100, 101 for `>= 100`). Off-by-one
  operators are the most common bug that survives example tests.
- **Error and rejection paths** — each distinct error the caller can
  observe: type, code, message where it's part of the contract.
- **State transitions** — for reducers, state machines, and anything with
  status fields: each legal transition and the illegal ones that must be
  refused. Use the discriminated union to enumerate them.
- **Partial failure after a side effect** — once a write, charge or send
  has happened, fail each dependency of the remaining work on its own and
  assert the caller still sees the committed outcome. Enumerate the
  dependencies; mutation probes won't reveal a missing guard. See
  `references/patterns.md` ("Choosing cases").
- **Invariants → property tests.** When a rule holds for all inputs
  (round-trips, idempotence, ordering preserved, totals conserved, output
  always valid per schema), a property test with fast-check finds the case
  you didn't think of. Use it if fast-check is installed; suggest it if not.
- **Skip** what has no behaviour of its own: types, interfaces, enums,
  constants, plain DTOs, trivial getters, and the framework's or library's
  own behaviour (that `z.string()` rejects numbers, that NestJS's
  `ParseIntPipe` parses ints).

Replace near-duplicate tests with a typed table (`it.each` / `test.each`)
when only the data varies — but keep separate tests when the *reason* each
case matters is different and deserves its own title.

### 4. Write each test to the bar

`references/patterns.md` has the TypeScript patterns; the bar is:

- **Arrange–act–assert, visibly.** One behaviour per test. A single act is
  the norm; a sequence is fine when the behaviour *is* a sequence (state
  transitions, idempotency). No `if`/loops deciding what to assert.
- **Specific oracles.** Assert the value, not that a value exists:
  `toEqual({ total: 180, discount: 20 })`, not `toBeDefined()`. Know the
  matchers: `toEqual` ignores `undefined` properties and class identity;
  `toStrictEqual` doesn't; `toMatchObject` is a subset match — use it only
  when extra fields are genuinely irrelevant.
- **Hard-coded expected values.** `expect(price(200)).toBe(180)`, not
  `toBe(200 * DISCOUNT_RATE)`.
- **Errors**: `expect(() => parse(x)).toThrow(ParseError)` (note the arrow);
  `await expect(load(id)).rejects.toThrow(NotFoundError)` (note the
  `await`). Check the code/message when the caller branches on them.
- **Deterministic**: fake timers with the *async* advance functions for
  promise-based code (`vi.advanceTimersByTimeAsync`), a pinned system time,
  seeded randomness, no real sleeps, no network (MSW with
  `onUnhandledRequest: 'error'`), no order dependence, env stubbed and
  restored.
- **Typed without escape hatches.** No `as any` / `as unknown as` in
  fixtures: use a typed factory with valid defaults and `Partial` overrides,
  `satisfies`, or parse the fixture through the real schema so it can't
  drift from the contract. Type mocks with `vi.mocked()`
  or implement the interface with a small fake.
- **Readable failures.** Titles are behaviour sentences; a failing assertion
  should say what broke without opening the test.
- **Small, reviewed snapshots only** — inline, for stable serialized output
  that is itself the contract (a CLI's help text, a generated SQL string).
  Never snapshot a large object to avoid deciding what matters.

### 5. Prove every new test can fail

A test you've only seen pass has not been tested. For each new test, see it
fail for the right reason at least once:

- **Test-first**: write it before the code (or before the fix) and watch it
  go red with the expected message. For a bug fix this is required: the test
  must fail on the unfixed code.
- **Mutation probe** for tests written after the code: introduce the bug the
  test is meant to catch, run it, confirm red, restore. The bundled script
  does this safely (always restores the file, refuses to run if the
  baseline is already red):

  ```bash
  node <skill-dir>/scripts/probe-mutation.mjs --file src/price.ts \
    --find '>= 100' --replace '> 100' --cmd 'npx vitest run src/price.test.ts' \
    --log .ai-dev/probes.jsonl
  ```

  Pick mutations that model real mistakes: flip a comparison, drop a
  condition, change a constant, return early, skip an `await`, swap two
  arguments. If a mutation survives, either the test is weak (fix it) or the
  mutated behaviour isn't specified (decide whether it should be).

- **When the suite is red because the production code has a bug** (the
  tests are right, the code is wrong), the probe script refuses to run — a
  red baseline proves nothing. Copy the project to a scratch directory
  (`.ai-dev/probe-copy/`, or the OS temp dir), apply the fix there only,
  confirm the suite is green, and probe the copy. Never apply the fix to the
  repo just to probe; the fix is the user's call.

Always pass `--log`, and report the probes as a short table (mutation →
KILLED/SURVIVED) in your response or report, with the log's path. An
ERROR (the command couldn't run or died from a signal) or TIMEOUT result is
not evidence either way — fix the command or rerun before counting it. A claim
like "the tests catch 13 bugs" is only as good as the record behind it.
"Tests pass" alone is not evidence the tests work.

Scratch copies and logs go under `.ai-dev/` (git-ignored) or the OS temp
dir. Leave them in place and say where they are — don't `rm -rf` anything to
tidy up — but never leave a mutation applied in one: restore it, or say
plainly which file still carries a planted bug.

### 6. Verify, then hand back

- Run the new tests, then the wider affected suite, then typecheck (with
  test files included) and lint.
- Run the new tests repeated and shuffled
  (`vitest run <file> --repeats 10 --sequence.shuffle`) to flush out order
  dependence and timing flakiness.
- If you added or changed a `*.testutil.*` file, run
  `scripts/find-single-use-testutils.mjs <package> --only=<those files>`.
  Move a helper with one consumer into that test, or say in the PR which
  upcoming change will share it.
- Report: the behaviours covered (as the test titles), what you deliberately
  didn't test and why, the mutation probes and their results, commands run
  with results, and anything you found in the production code while testing
  (a bug the tests exposed is a finding — report it; don't silently "fix"
  the expectation to match buggy output).

## Job 2 — Auditing tests

Scope is whatever the user named: a file, a directory, a PR's tests, or the
whole suite. For a whole suite, sample by risk rather than reading
everything with equal care: start with the code that matters most (money,
auth, permissions, data integrity, parsers at boundaries) and the tests
that fail or get edited most (`git log --format= --name-only -- '*.test.ts' | sort | uniq -c | sort -rn | head`).

### 1. Inventory

Run the heuristic scanner for leads, then read the tests:

```bash
node <skill-dir>/scripts/scan-test-smells.mjs <dir> [--assert-helpers=expectOk,assertValid]
```

For test helper modules, also run
`node <skill-dir>/scripts/find-single-use-testutils.mjs <dir>`: it lists
`*.testutil.*` files with one importer or none (add `--exports` for unused
exports in shared ones).

It flags candidates (no assertion, weak-only assertions, un-awaited
`rejects`/`resolves`, try/catch assertions, `.only`/`.skip`, casts, internal
module mocks, interaction-only tests, real sleeps, nondeterminism,
snapshots, duplicate titles). It is regex-based: it can't see custom
assertion helpers (pass them with `--assert-helpers`), and every hit is a
lead you confirm by reading the test, never a finding by itself. Most real
problems — tautological oracles, redundancy, implementation coupling — need
reading anyway.

### 2. Interrogate each test

For each test (or each group of near-identical tests), answer these, in
this order, and write down the evidence:

1. **What behaviour does it protect?** State it as a sentence a product
   person would recognise. If you can't, that's already a finding.
2. **Can it fail?** Mechanical checks first (no assertion, un-awaited async
   assertion, assertion in a callback that never runs, expected value
   computed by the subject, asserting a stub's own return value, catch-all
   `try/catch`). Then probe (with `--log`): mutate the behaviour it claims to
   protect and see if it goes red. A test that can't fail is the most serious finding an
   audit can make, because people are relying on it.
3. **Does it fail only when behaviour breaks?** Look for coupling to
   implementation: call order or counts on internal collaborators, spies on
   private methods, assertions on intermediate data structures, large
   snapshots, exact log or AI-generated prose. Ask: "would a correct
   refactor break this?"
4. **Is it redundant?** Does another test exercise the same partition with
   the same oracle — so they fail for exactly the same bugs? Confirm with a
   probe: if every mutation that kills this test also kills the other, one
   of them can go. Redundant tests aren't free; they double the edit cost of
   every change to that behaviour.
5. **Is it worth its cost?** Slow (real I/O, real timers), flaky (order,
   time, shared state — check the history), or so heavily mocked that it
   mirrors the implementation line by line.
6. **What's missing?** Behaviours with no test that would fail if they
   broke — especially boundaries, error paths, and every `throw` the caller
   can observe. Mutation testing is the efficient way to find these
   systematically (`references/vitest.md`, "Mutation testing"); probe by
   hand where Stryker isn't installed.

`references/smells.md` is the catalogue to hold tests against: each smell
with how to confirm it, why it matters, the fix, and its default severity.

### 3. Give each test a verdict

| Verdict | Meaning |
|---|---|
| **Keep** | Protects a real behaviour, can fail, resists refactoring. Say nothing more than that unless asked. |
| **Strengthen** | Right target, weak oracle — e.g. `toBeDefined()` where the value is known, missing error type, missing boundary case. |
| **Rewrite** | Right behaviour, wrong approach — mocks its own collaborators, pins call order, snapshot of everything, real timers. |
| **Merge** | Duplicates another test (same partition, same oracle) or is one row of a table that should be `it.each`. Name the test it merges into. |
| **Delete** | Protects nothing: tests the compiler, the framework, a constant, or a mock; or is fully subsumed. State the evidence. |

Rate findings by what they cost the team, so the ratings mean something:

- **Critical** — false confidence on behaviour that matters: a test that
  can't fail guarding money, auth, data integrity or a parser at a trust
  boundary; a committed `.only` silently disabling the rest of the suite.
- **High** — a test that can't fail elsewhere; flaky tests; a real gap on
  important behaviour (an untested error path a caller depends on).
- **Medium** — implementation coupling that will cause false alarms;
  redundancy with real maintenance cost; weak oracles.
- **Low** — readability, naming, structure.

Every Critical and High needs concrete evidence: the probe that survived,
the line where the `await` is missing, the two tests that kill identical
mutants. "This looks weak" is not a finding.

### 4. Report, then change only what was asked

Write the report from `assets/audit-report-template.md` to `.ai-dev/`
(git-ignored) unless the user wants it elsewhere, and summarise it in chat:
the verdict counts, every Critical/High with its evidence, the biggest gaps.

An audit is report-only unless the user asked for fixes. When they do:

- Strengthen and Rewrite are ordinary edits; prove each rewritten test can
  still fail (step 5 of Job 1).
- **Merging or deleting tests removes protection someone may be relying
  on. List exactly which tests you'll remove and why, and get the user's
  confirmation first** — even when they asked for cleanup in general.
- Never delete, skip, or loosen a test to make a run pass. If a test fails
  because the production code is wrong, that's a bug report, not a test fix.
- Run the full affected suite and typecheck after the changes, and report
  the before/after test counts.

## Debugging a failing or flaky test

When the job turns into "why is this failing": run only that test with
output to a log; classify it — the code is wrong, the test is wrong, the
environment differs (timezone, locale, Node version, env vars), or it's
order/time dependent (rerun alone, rerun shuffled, rerun ×10). Fix one
failure at a time and rerun that test a few times before moving on. Check
for leaking state — mocks not restored, module-level singletons, fake
timers left installed, unclosed handles (`--reporter=hanging-process` shows what keeps the process
alive). `references/vitest.md` has the details. Don't "fix" a failure by changing the expected value until you've
shown the old expectation was wrong.

## Reference files

| File | Read when |
|---|---|
| `references/principles.md` | First use in a session; any judgement call about what to test or mock. |
| `references/patterns.md` | Writing tests: choosing cases, typed fixtures and fakes, async/time, errors, property tests, type tests, snapshots, HTTP. |
| `references/smells.md` | Auditing: the smell catalogue with confirmation steps, fixes and default severity. |
| `references/vitest.md` | Vitest v3/v4/v5 differences, commands, mock lifecycle config, `vi.mock`, fake timers, type tests, coverage, Stryker, flake hunting. Read the version table before Job 1 or 2. |
| `assets/audit-report-template.md` | Writing an audit report. |
| `scripts/scan-test-smells.mjs` | Inventory and leads for an audit (read-only, no dependencies). |
| `scripts/probe-mutation.mjs` | Proving a test can fail, or that two tests are redundant (restores the file afterwards). |

Related skills: `typescript-review` reviews production-code type safety;
`verifier` decides which kind of check (lint rule, unit test, property test,
contract test, e2e…) a failure needs. If the right answer to "test this" is
a different rung, say so.
