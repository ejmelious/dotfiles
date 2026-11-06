# Build — make a verifier that meets the bar

Input: a verifier to build — named by the user, or from an escape proposal, an audit gap, or a planned task. Output: the verifier in the repo, wired where it should run, with evidence that it catches what it's for.

## Process

1. **Pin the spec.** Rung, invariant, the bad case it must catch, command, where it runs, owner. If anything is missing, fill it from the proposal or ask one question.
2. **Make the bad case first.** Get a reproduction of the failure the verifier targets: the commit before the fix (check it out in a worktree), the fix reverted locally, or an injected fault. Without a bad case you can't prove anything.
3. **Write the verifier** using the repo's existing tools and conventions. Add a new tool only when no existing one can express the check, and say why.
4. **Prove it catches.** Run it against the bad case: it must fail, *for the reason it's meant to* — read the failure, don't just see red. Then run it on correct code: it must pass. Keep both outputs as evidence.
5. **Make the failure teach.** Rewrite the message until someone who's never seen the rule knows what to do instead. Include the alternative ("use X"), not only the violation.
6. **Wire it in where it runs.** Fast rungs: into the existing lint/test command, so hooks and CI pick it up without extra setup. Slow rungs: a CI job on the right trigger (PR, schedule, release). Changes to CI config, hooks, or CODEOWNERS are called out to the user before they're made.
7. **Protect it.** Note where it lives, and if the repo uses CODEOWNERS, propose an owner entry. Flag any existing skips or `warn` levels that undermine it.
8. **Record it.** Add it to `.ai-dev/verifiers/ladder-audit.md` if one exists.

Then report: what was built, where it runs, the red and green evidence, and anything left undone. Commit only after the user confirms (staging by explicit path); never push without a second confirmation.

## Recipes by rung

- **Lint / architecture rule.** A custom ESLint rule (with `RuleTester` valid and invalid cases) or a dependency-cruiser `forbidden` rule with a `comment` that names the allowed path. Set to `error`, not `warn`. The invalid case is the bad case.
- **Property test.** Express the invariant over generated inputs (`fast-check`, Hypothesis). Bias generators toward the shape that failed (empty pages, nulls, boundary sizes). Check that shrinking reproduces the escape's input.
- **Golden dataset / snapshot.** Synthetic fixtures modeled on real shapes and past failures, with expected outputs reviewed by a person. Changing an expected output needs an explicit approval step, not a blanket snapshot update.
- **Contract test.** Consumer-driven contracts (Pact), or recorded vendor payloads validated against the schema the code expects. Re-record on a schedule so drift shows up.
- **E2E / browser check.** Assert the user-visible outcome, not implementation details. Capture screenshots or traces as evidence. Keep it to the flows the failure touched.
- **Shadow run.** Run old and new paths on sampled inputs, compare outputs, log mismatches. Read-only: the new path's side effects are suppressed.
- **Load / SLO check.** A script at realistic peak (largest-customer scale, the busiest region), with thresholds taken from the SLO. Runs on a schedule or before raising a limit.
- **Mutation testing.** Scope to the package that matters; set a score threshold and track it over time rather than chasing 100%.
- **LLM judge / eval.** A rubric, plus a calibration set of at least 20 human-labeled examples; measure agreement before trusting it. On high-risk paths, pair it with a deterministic gate.
- **Canary / synthetic.** A scheduled check of the key endpoint or flow, alerting to the owning team, with a runbook link in the alert.
- **Rollout gate.** A staged rollout (by region or percentage) that compares the error rate and latency to the previous version, with automatic halt or rollback criteria.
