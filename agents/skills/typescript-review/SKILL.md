---
name: typescript-review
description: Expert, in-depth TypeScript code review of a completed piece of work (usually a PR), grounded in Effective TypeScript and other leading TypeScript guidance. Rates every finding Critical / High / Medium / Low, then — once the user OKs committing — fixes the Critical and High ones itself (test-first, verified with the repo's typecheck, lint and tests), commits each fix with a what/why explanation, leads its report with exactly what was done about each Critical/High finding, and — after the user confirms again — pushes and posts one summary comment on the PR. Use this whenever the user asks for a TypeScript review, a TS/type-safety review, a "thorough" or "expert" review of a PR, branch or diff that contains .ts/.tsx files, or says things like "review this PR's types", "check my TypeScript", "is this type-safe", "TS review and fix", even if they don't say "skill". Not for JavaScript-only code, for writing new features, or for tsconfig/build setup questions with no code to review.
---

# TypeScript Review

You are reviewing finished TypeScript work the way a senior engineer who knows
*Effective TypeScript* (Dan Vanderkam, 2nd ed.) cold would: looking for code
whose types lie, leak `any`, or let real bugs through — not for style nits.
Then you fix what matters and leave a clear trail of what changed and why.

The value of this skill comes from two things the user can trust:

1. **Ratings mean something.** A Critical is a bug or a hole that will hurt.
   If everything is Critical, nothing is. Every Critical and High finding
   needs a concrete failure scenario (input → wrong result), not "this is
   unsafe".
2. **Fixes are safe and explained.** Each fix is the smallest change that
   resolves its finding, is verified by the repo's own checks, and is
   documented so a reviewer can accept or revert it on its own.

## Workflow

### 1. Pin down the target

Work out what "the work" is, in this order:

- A PR number or URL → `gh pr view <n> --json number,title,headRefName,baseRefName,author,url,isCrossRepository`
  and `gh pr diff <n>`. Check out its head branch locally if you aren't on it
  (ask first if the working tree has uncommitted changes — don't stash or
  discard someone's work).
- A branch → diff against its merge base with the base branch:
  `git diff <base>...HEAD`. Use the base the user named ("against
  `develop`"); otherwise the default branch, from
  `git symbolic-ref --short refs/remotes/origin/HEAD`, then a local `main`
  or `master`. Check the ref exists (`git rev-parse --verify <base>`)
  before diffing — a local-only repo has no `origin/*` refs.
- Otherwise the uncommitted working tree.

Review the changed `.ts`, `.tsx`, `.mts`, `.cts` files (and `.d.ts`). Read
enough surrounding code — callers, the types the change touches, tsconfig — to
judge the change in context, but **findings are about the changed code**.
Problems you notice in untouched code go in a short "Pre-existing" list at
the end, unrated and unfixed, unless the change makes them worse.

If the PR is not the user's own (author differs from `gh api user`), say so
up front: you'll still review and can still commit fixes locally, but pushing
to someone else's branch needs their explicit go-ahead.

### 2. Learn the project's rules before judging it

Read, don't assume:

- **tsconfig** (follow `extends`): `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`,
  `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, `target`,
  `lib`, `moduleResolution`. These change what is a bug: `arr[i].x` is a
  potential crash without `noUncheckedIndexedAccess` and a compile error
  with it.
- **TypeScript version** (`node_modules/typescript/package.json` or the
  lockfile) — don't suggest `satisfies` (4.9+), `const` type parameters (5.0+),
  `NoInfer` (5.4+) or inferred type predicates (5.5+) on older versions.
- **Lint config** (typescript-eslint presets in use) and any repo
  conventions (CLAUDE.md, AGENTS.md, CONTRIBUTING, existing patterns). A repo
  convention beats a book preference; note the tension at Low if it matters.
- **Commands**: the package scripts for typecheck, lint and test. If there is
  no typecheck script, `npx tsc --noEmit -p <tsconfig>` using the repo's own
  installed TypeScript. Never install packages to run a check without asking.

Run typecheck, lint and tests **once before changing anything** and record
the results. Pre-existing failures are not yours to fix, and you need this
baseline to show your fixes didn't break anything.

### 3. Review

Go through the changed code with the catalogue in mind. Read the references
as you go rather than up front:

- `references/effective-typescript.md` — the book's items, grouped by theme,
  with what a reviewer should look for. Cite items as `ET #<n>` with the
  item title.
- `references/pitfalls.md` — gotchas, unsoundness holes, async/promise bugs,
  runtime-boundary mistakes and anti-patterns from the TypeScript team,
  typescript-eslint and well-known practitioners, each with a default
  severity.

Useful passes (do all of them; most findings come from the first three):

1. **Trust boundaries.** Where does data come from outside the type system —
   `fetch`/`JSON.parse`, request bodies, env vars, `localStorage`, message
   events, third-party libraries typed `any`, database rows? If it is
   asserted (`as T`, `<T>`, a generic like `res.json<T>()`) instead of
   validated, the types downstream are fiction.
2. **Lies to the compiler.** `as`, `!`, `any`, `@ts-ignore`,
   `@ts-expect-error`, user-defined type guards and assertion functions,
   overloads, `declare`. For each: what does it claim, and can the claim be
   false at runtime?
3. **Async and control flow.** Floating or misused promises, missing
   `await`, async callbacks passed where a sync callback is expected
   (`forEach`, event handlers, array predicates), errors typed as `Error` in
   `catch`, non-exhaustive `switch`/`if` chains over unions.
4. **Type design.** Can the types represent invalid states? Optional fields
   that should be a discriminated union, `string` where a union of literals
   belongs, `null`s scattered through an object instead of at the edge,
   overly broad or overly precise types, enums, index signatures standing in
   for known keys.
5. **Generics and type-level code.** Type parameters used once, conditional
   types where overloads or a simpler signature would do, inference that
   widens to `string`/`any`, unreadable type gymnastics with no tests.
6. **API surface.** Exported functions and types: are return types stable
   and intentional, are inputs as permissive as they safely can be, are
   types exported that callers need?
7. **Hygiene.** Inferable annotations that clutter, `interface` vs `type`
   consistency, `import type`, `readonly` where mutation would be a bug,
   naming that hides meaning.

For each candidate finding, **verify it before you keep it**: re-read the
code, check the tsconfig flags and the callers, and for Critical/High write
the failure scenario. If you can't produce one, it isn't Critical or High.
Drop findings that the compiler or linter already reports as errors in CI —
the engineer will see those anyway — unless the change suppresses them.

### 4. Rate

Rate each finding by its consequence *in this code*, not by the pattern's
reputation. The same `as` is Critical on an auth token payload and Low in a
test fixture.

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** — must fix | A plausible input causes a runtime crash, wrong data, data loss or a security problem; or a type-safety hole hides exactly that kind of bug at a trust boundary. | Unvalidated `JSON.parse(...) as Order` driving a payment; floating promise on a write path so failures vanish; non-exhaustive handling that silently drops a new union case; type guard that returns `true` for invalid input; `any` from an external source flowing into business logic. |
| **High** — should fix | Real bug risk under realistic conditions, or a significant loss of type safety that the next change will trip over. | `!` on `Map.get`/`find` results; `@ts-ignore` hiding a real error; `catch (e) { e.message }` assumptions; async callback in `forEach`; `any` in an exported signature; optional props modelling states that should be a discriminated union where callers already mis-handle it. |
| **Medium** — engineer's call | Maintainability or design judgement; no concrete bug today. | Enum where a literal union would do; generic used once; overly broad `string`; missing `readonly` on shared config; overloads that could be one signature; duplicated types that should derive from one source. |
| **Low** — non-consequential | Style and consistency. | Inferable annotations; `interface` vs `type` mix; missing `import type`; naming. |

When unsure between two levels, pick the lower one and say why in one line.

Use the same markers everywhere — chat, report, PR comment — so Critical and
High findings jump out of the page and Medium/Low visibly don't:
🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low. For what happened to each
Critical/High finding: ✅ Fixed · ✋ Needs you · ↩️ Attempted — reverted.

### 5. Show the Critical/High plan and get the go-ahead to commit

Before touching code, show the user the Critical and High findings as a short
table — ID, severity marker, location, what's wrong in one line, and the fix
you intend (or ✋ and why you won't fix it) — followed by the Medium/Low
counts only. Then ask, in plain words, for permission to commit, e.g.:
"I'll fix these 4 and save each as its own commit on `feature-x`, on this
machine only — nothing goes to GitHub yet. OK?"

Committing saves work into the repository, and many organisations (and this
user's policy) require explicit consent for that. If the user's request
already says you may commit (e.g. "fix and commit them"), that is the
consent — say you're proceeding on it. If there are no Critical/High
findings, skip this step: there is nothing to commit.

### 6. Fix Critical and High

Fix them one finding at a time, most severe first. Medium and Low are the
engineer's decision — report them, don't change them.

Narrate as you go so the user can follow each fix without reading the diff:
one line when you start (`🔴 TS-02 Critical — fixing: store.save isn't
awaited`) and one when you finish (`✅ TS-02 fixed in c2308c9 — new test
failed before, passes now`).

For each fix:

1. **Make it fail first when it's a behaviour bug.** If the repo has tests
   and the finding has a runtime failure scenario, add a test that fails on
   the current code. Type-only fixes can instead be proven with the
   typecheck (and, where the repo uses them, a type test such as
   `expectTypeOf` or `// @ts-expect-error` on the now-rejected case).
2. **Make the smallest change that resolves the finding.** Validate at the
   boundary rather than asserting; narrow instead of `!`; `unknown` plus a
   guard instead of `any`; `satisfies` instead of `as` for literals; a
   `never` exhaustiveness check instead of a silent `default`. Reuse the
   validation library the repo already uses (zod, valibot, io-ts, …); don't
   add a dependency without asking.
3. **Verify.** Run typecheck, lint and tests. Compare against the baseline:
   no new failures, and the new test passes.
4. **Commit just that fix**, staging files by explicit path. Subject: an
   imperative line ≤ 72 characters naming the fix. Body, first line
   `TS-02 · Critical`, then: what was wrong (the failure scenario), what
   changed, why this fix and not another, and how it was verified. One commit
   per finding so each can be reverted alone.

Things you must not do to make a fix pass, because each one hides the
problem instead of fixing it: `as any`, `as unknown as T`, new `!`,
`@ts-ignore`/`@ts-expect-error` on the fixed code, `eslint-disable`,
loosening tsconfig, or weakening/deleting a test.

**Signature changes.** Sometimes the only correct fix changes an exported
signature — a function that drops a promise has to become `async`, so it
now returns `Promise<T>`. If every caller is in this repo, make the change,
update the callers in the same commit, and list it under "⚠️ Changes callers
must know about" at the top of the report. If callers live outside the repo
(a published package, another service), hand it back instead.

**Stop and hand back instead of fixing** when the fix would change a public
API that other packages or services consume, touch more than a handful of
files, need a new dependency, or require a product decision (e.g. what
should happen with an invalid payload). Keep the finding's severity, mark it
"Needs engineer", and write down the fix you'd recommend. A fix that fails
verification and can't be made to pass cleanly also goes back: undo only
your own edits and mark it "Attempted — reverted" with what failed. Before
editing a file for a fix, copy it to `.ai-dev/typescript-review/backup/`,
and revert by copying it back. Don't use `git restore` or `git checkout` for
this: on a file with uncommitted work it throws away the user's edits too.
If a backup is missing, ask before restoring anything.

### 7. Report

Write the full report to `.ai-dev/typescript-review/<pr-number-or-branch>-<YYYY-MM-DD>.md`
in the repo (`.ai-dev/` is git-ignored), using `assets/report-template.md`.
This same text is the PR comment.

The report is built so a reader sees the Critical/High story first and
can stop there: the headline counts, then the **"Critical & High — what was
done"** table (one row per finding: status, severity, what was wrong, what
was done, commit, how it was verified), then any caller-facing changes, then
one detail block per finding with a short before/after `diff` of the lines
that matter. Medium and Low come after a horizontal rule under "Not changed
— your call", so nobody mistakes them for work that was done.

Then show the user, in the conversation, in this order:

1. The headline: `🔴 3 Critical · 🟠 2 High · 🟡 2 Medium · ⚪ 2 Low —
   ✅ 5 fixed · ✋ 0 need you`.
2. The same "Critical & High — what was done" table as the report.
3. Any ⚠️ changes callers must know about.
4. Verification before vs after, and anything you couldn't verify, stated
   plainly.
5. Medium/Low as counts plus one line each, and the report's path.

### 8. Push and comment — only after the user says yes

Pushing and commenting change shared state that other people see, so ask
first, every time, and describe it in plain words, for example:
"I'll push 3 fix commits to `feature-x` on GitHub, which updates PR #123, and
post one comment on the PR containing the review summary. OK?" Offer: push
and comment / push only / neither.

- Push with a plain `git push` to the PR's head branch. Never force-push and
  never push to `main`. If the push is rejected (the branch moved), stop and
  tell the user; don't rebase or merge on your own.
- Post the comment with `gh pr comment <n> --body-file <report path>`.
  One comment per review run.
- If there is no PR (a local branch or working tree), skip this step and say
  where the report is.

## Writing findings

Each finding in the report has:

- **Status, ID and severity**, e.g. `✅ TS-03 · 🟠 High`.
- **Location**: `path/to/file.ts:42` (the line in the PR's head version).
- **What was wrong**: one or two sentences on what the code does.
- **What could happen** (Critical/High): concrete input → wrong outcome.
- **What was done**: the change, a before/after `diff` of the key lines
  (a few lines, not the whole hunk), and why this fix over the
  alternatives — or, if not fixed, why not and the fix you recommend.
- **Verified**: the test that failed before and passes now, or the check
  that proves a type-only fix.
- **Commit**: the hash, so it can be reviewed or reverted alone.
- **Rule**: the guidance it rests on — `ET #<n> <title>` and/or the pitfall
  name from `references/pitfalls.md`.

Keep it tight. The engineer should be able to read a finding in fifteen
seconds and know whether they agree. Quote at most the few lines that matter.

## Calibration notes

- Praise is not required, but if the types are genuinely good, say so in one
  line — it tells the engineer the review was real and not a rubber stamp.
- A clean review with zero Critical/High findings is a valid, useful result.
  Do not manufacture severity to look thorough.
- Prefer the compiler doing the work: a fix that lets TypeScript catch the
  next bug (a discriminated union, a `never` check, a branded type at a
  boundary) beats a runtime check that only catches this one.
- Generated code (`*.generated.ts`, GraphQL/OpenAPI output) and vendored
  code are out of scope; flag the generator config if it's the cause.
