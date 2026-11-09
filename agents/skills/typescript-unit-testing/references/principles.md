# Principles

The reasoning behind the skill's defaults. When a situation isn't covered by a
rule in SKILL.md, reason from here.

## Contents

1. What a unit test is for
2. The four pillars and how to trade them
3. Kent Beck's desiderata as a checklist
4. Classical vs. mockist — and why this skill defaults to classical
5. Commands vs. queries: the one rule for interaction assertions
6. TypeScript and the type system as a test layer
7. Design for testability: functional core, imperative shell
8. Coverage, mutation score, and what "enough tests" means
9. When a unit test is the wrong tool

---

## 1. What a unit test is for

A unit test verifies one unit of **behaviour**, runs fast, and runs in
isolation from other tests. "Isolation" means tests don't share state and can
run in any order or in parallel — not that the subject is isolated from every
collaborator. The unit is whatever a caller relies on: a function, a class's
public methods, a module's exports, a reducer, a hook's return value.

Tests exist so you can change code with confidence. That has two halves:
they must catch the changes that break things, and they must stay quiet for
the changes that don't. A suite that misses bugs is useless; a suite that
cries wolf on every refactor is worse, because it teaches people to update
tests without reading them.

## 2. The four pillars (Khorikov)

| Pillar | Question | Destroyed by |
|---|---|---|
| Protection against regressions | Would a plausible bug make it fail? | No/weak assertions, tautological oracles, testing trivial code, over-mocking the code that can break |
| Resistance to refactoring | Does it stay green when behaviour is preserved? | Asserting how instead of what: call order, internal calls, private state, big snapshots |
| Fast feedback | Does it run in milliseconds? | Real I/O, real timers, heavy module graphs |
| Maintainability | Is it cheap to read and change? | Big arrange blocks, clever helpers, unclear titles, many mocks |

The first two multiply: a test with zero in either is worth zero. **Resistance
to refactoring is effectively binary** — either a test is coupled to
implementation details or it isn't — so treat it as non-negotiable and trade
off the others. End-to-end tests max out protection and refactoring
resistance but lose speed; trivial tests are fast and robust but protect
nothing; mock-heavy tests are fast but brittle. Good unit tests sit on
domain logic and algorithms, where all four can be high together.

## 3. Beck's Test Desiderata

Useful as an audit checklist: **isolated** (any order), **composable**,
**deterministic**, **fast**, **writable**, **readable**, **behavioural**
(sensitive to behaviour changes), **structure-insensitive** (insensitive to
structure changes), **automated**, **specific** (a failure points at the
cause), **predictive** (passing means the code works in production),
**inspiring** (passing gives confidence). No test has all of them; know
which ones you're giving up and why.

## 4. Classical vs. mockist

The **mockist (London)** school replaces every collaborator with a mock and
tests each class alone. The **classical (Detroit)** school uses real
collaborators and replaces only what is shared, slow or non-deterministic.

This skill defaults to classical because mockist tests couple to the
collaboration graph: rename a method, merge two helpers, or move logic
between classes, and dozens of tests fail while the product works. They also
hide integration bugs — two units each pass against their mocks of each
other, but disagree in reality ("the mocks agree").

Dependency sorting (expanded from SKILL.md):

| Dependency | Example | In a unit test |
|---|---|---|
| Pure in-process code you own | domain objects, helpers, validators, mappers | Real |
| In-process but non-deterministic | `Date.now`, `Math.random`, `crypto.randomUUID`, `process.env` | Control it (fake timers, injected clock/id generator, seeded RNG, `vi.stubEnv`) |
| Out-of-process, **managed** (only your app touches it) | your DB, your cache, your file store | A fake/in-memory implementation; real one in integration tests |
| Out-of-process, **unmanaged** (observable by others) | Stripe, SES, Slack, another team's queue, third-party APIs | Mock — preferably at the network edge (MSW) or at a thin adapter you own |

Mock at a **seam you own**: if your code calls the Stripe SDK through a
`PaymentGateway` interface, mock `PaymentGateway`, not the SDK's internals.
Then contract-test or integration-test the real adapter separately.

A **fake** (a working in-memory implementation of an interface) usually beats
a mock for managed dependencies: tests assert on resulting state
(`await repo.findById(id)`) instead of on calls, so they survive refactors.
Keep fakes honest by running the same contract test suite against the fake
and the real implementation when the stakes justify it.

## 5. Commands vs. queries

- An outgoing **command** has a side effect the outside world can observe:
  send email, charge a card, publish an event. If the dependency is
  unmanaged, the command *is* the behaviour, so assert it:
  `expect(gateway.charge).toHaveBeenCalledWith({ amount: 1800, currency: 'usd' })`.
  Check it's called the right number of times when duplicates would be a bug
  (double-charging), not by habit.
- An outgoing **query** fetches data to compute with (`repo.findById`,
  `config.get`). Stub its answer, then assert on the subject's *output*.
  Asserting that the query was called couples the test to how the result was
  computed and adds no protection — if the query weren't called, the output
  would be wrong anyway.
- **Never assert a stub's own return value**: stubbing `getUser` to return
  `u` and then asserting the result is `u`, when the subject only forwards
  it, tests the mocking library.

## 6. TypeScript and the type system as a test layer

- **Don't test what the compiler guarantees** for internal callers: that a
  function rejects a wrong-typed argument, that an enum has certain members,
  that an interface has certain fields. Those tests can't fail without a
  compile error first.
- **Do test where the types are a promise, not a proof**: anywhere `unknown`
  or `any` becomes a typed value — `JSON.parse`, request bodies, env vars,
  message payloads, third-party responses, `as` casts, type predicates
  (`x is Foo` is unchecked by the compiler — a wrong predicate is a lie the
  compiler repeats everywhere). These need runtime tests with hostile inputs.
- **Exhaustiveness**: if a `switch` over a discriminated union ends in an
  `assertNever(x)`, the compiler guarantees new variants are handled; a
  unit test per variant is still needed to check each is handled *correctly*.
- **Type-level APIs** (generic helpers, inferred return types, overloads,
  branded types) deserve type tests, which fail at compile time:
  `expectTypeOf(parse(s)).toEqualTypeOf<Result<User, ParseError>>()` and
  `// @ts-expect-error` lines that must stay errors. They only run if the
  test files are type-checked — check that they are.
- **Casts in tests are a smell for the same reason as in production**: an
  `as User` fixture compiles after `User` gains a required field, and the
  test keeps passing on data the real system can't produce.
- **`strict` options change what's worth testing**: without
  `noUncheckedIndexedAccess`, `arr[0].id` on an empty array is a runtime
  crash the compiler won't flag — that boundary deserves a test.

## 7. Functional core, imperative shell

Code is easiest to unit test when decisions are pure functions of values and
I/O lives in a thin outer layer. When a unit test needs elaborate setup —
many stubs, a module mock, a fake clock, *and* a fake repository — the test
is telling you the code mixes decisions with effects. The useful response is
usually a design one (pull the decision out as a pure function and test it
with plain values; test the shell with one integration test), not a bigger
harness. Propose that refactor; don't do it unasked.

Hard-to-test signals: `new` of a dependency inside the function, module-level
singletons, reading `Date.now()`/`process.env` deep inside logic, functions
taking a whole context object to use one field.

## 8. Coverage, mutation score, and "enough"

- **Line/branch coverage tells you what definitely isn't tested** — a line
  never executed can't be verified. It cannot tell you what *is* tested: a
  test with no assertions gives 100% coverage of everything it runs. Use it
  to find gaps, never as proof of quality, and never write tests to move the
  number.
- **Mutation testing** answers the real question: if this code were wrong,
  would a test fail? Stryker generates mutants (flipped operators, removed
  conditions, changed literals); each surviving mutant is a concrete,
  checkable gap or an equivalent mutant (behaviour-identical — ignore it).
  It is slow on big codebases, so scope it to the files that matter or to a
  PR's changes; the manual probe script covers single questions cheaply.
- **"Enough"** is when every behaviour a caller depends on has a test that
  fails if it breaks, risk-weighted: exhaustive for money, auth, permissions,
  parsers and data migrations; light for glue; none for declarations.

## 9. When a unit test is the wrong tool

- The bug is in wiring between modules, config, serialization over a real
  boundary, SQL, or framework behaviour → integration test.
- The behaviour is visual or depends on a real browser → browser/e2e test.
- The rule is "never do X anywhere" (no `console.log`, no direct DB access
  from controllers) → lint rule or architecture check, not a test per file.
- The property is about scale, latency or concurrency under load → load test.

Saying "this shouldn't be a unit test; here's what should catch it" is a
legitimate and valuable answer.
