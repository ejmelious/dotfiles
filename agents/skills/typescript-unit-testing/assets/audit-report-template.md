# Test audit: <scope>

<date> · Vitest <x.y.z> · <N> test files, <M> tests in scope

## Summary

<Two or three sentences: is this suite protecting the behaviour that matters?
The single most important thing to do next.>

| Verdict | Count |
|---|---|
| Keep | |
| Strengthen | |
| Rewrite | |
| Merge | |
| Delete | |

Critical: <n> · High: <n> · Medium: <n> · Low: <n>

## Critical and High findings

### <ID> <Severity> — <one-line finding>

- **Test**: `path/to/file.test.ts:LINE` — "<test title>"
- **Protects**: <the behaviour, as a sentence — or "nothing identifiable">
- **Evidence**: <the probe that survived (file, find → replace, result), the
  missing `await` on line N, the two tests that kill identical mutants…>
- **Why it matters**: <what bug ships if this stays as is>
- **Fix**: <concrete change> · **Verdict**: <Strengthen / Rewrite / Merge / Delete>

## Gaps — important behaviour with no test that would catch a break

| Risk | Behaviour | Where | Evidence | Suggested test |
|---|---|---|---|---|
| High | | `src/...:LINE` | <surviving mutant / no test references it> | |

## Medium and Low findings

| ID | Sev | Test | Finding | Verdict |
|---|---|---|---|---|

## Suite-level observations

<Config and structure issues that affect every test: mockReset not set,
tests not type-checked, shared DB between parallel tests, slow transform,
.only not blocked in CI… Only what's real.>

## Method

- Scanner: `scan-test-smells.mjs <args>` — <n> leads, <n> confirmed.
- Probes / mutation testing: <table of mutation → KILLED/SURVIVED, and the
  probe log path (e.g. .ai-dev/probes.jsonl); or the Stryker command and
  score per file>.
- Commands run and results: <baseline run, shuffled run, typecheck>.
- Not checked: <anything out of scope or not verifiable here>.

## Proposed removals (need confirmation before any change)

| Test | Reason | Covered instead by |
|---|---|---|
