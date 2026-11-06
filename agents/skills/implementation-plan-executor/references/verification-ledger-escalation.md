# Control Spine — Verification, Ledgers, Self-Correction & Escalation

This governs all three stages. With no human in the loop, these controls are what make autonomy safe. Read it before Stage 0.

## Verification discipline

**What "green" means.** All discovered verification commands pass: build, typecheck, lint, and the test suite. The commands are discovered in Stage 0 from the repo — never assumed.

**Baseline-relative green.** If the suite isn't green at rest, Stage 0 records the **exact set of pre-existing failures**. From then on the invariant is **no new failures beyond the baseline set.** A pre-existing failure that stays failing is tolerated and noted; any *new* failure is red.

**Three verification points:**
- **Inner loop (per task, worker):** targeted tests for the change plus typecheck/lint.
- **Gate (per milestone):** the **full suite** on the milestone branch. This catches a milestone breaking anything already merged.
- **Merge (every merge after the first in a batch):** the full suite on the merged tree, before the merge is committed. This catches two independently-green siblings that break each other. Never skip either to save time.

## Ledgers

All ledgers live in the main checkout under `.ai-dev/implementation-plan/<feature-slug>/.execution/`. Update them at every state change — they make the run resumable and auditable.

**Main ledger — `ledger.md` (orchestrator only):**
- `baseline_commit`, `baseline_failure_set`, `concurrent_tests` and any per-workspace test settings
- `integration_branch`, `last_green_commit` (the integration branch's last green merge — the safe fallback)
- the layers and batches from Stage 0
- per milestone: status (`pending` / `in_progress` / `in_gate` / `done` / `halted`), branch, workspace path, `start_commit`, gate cycles used, merge commit
- the PR stack from Stage 2: each branch, its base, and whether the per-milestone fallback was used
- `run_status` — `running` / `complete` / `halted`

**Milestone ledger — `milestone-<N>/ledger.md` (that milestone's worker only):**
- minor drift from Stage 0 and pre-flight, and how it was adapted
- per task: status, commit(s), acceptance criteria satisfied, tests covering it, self-correction attempts used
- the last commit of each planned PR
- open decisions reached: the choice made and why
- exit criteria confirmed
- full-suite results; gate findings received and how each was fixed

One writer per file means parallel workers never conflict.

**Resumability.** On startup, read the main ledger. If a prior run was interrupted (`run_status: running` but nothing is running):
- `done` milestones stay done.
- `in_progress` / `in_gate` milestones: check the workspace still exists and its branch head matches the milestone ledger's last commit; re-dispatch a worker to continue from the first task not marked done, then gate as normal.
- Confirm the integration branch is at `last_green_commit` before merging anything new.

## Bounded self-correction

- **Per-task budget:** 3 correction attempts by default, each a *different* hypothesis.
- **Per-milestone gate budget:** 2 fix cycles by default, shared across both reviewers' findings and any merge-conflict or post-merge-red rework.
- **Non-progress detection:** two consecutive attempts with the **same failure signature** is a loop, not progress — stop spending budget on it.

These defaults are deliberately conservative; raising them trades safety for persistence.

## Unrecoverable walls → hard-stop

A wall is **unrecoverable** when, after self-correction within budget:
- a task or milestone can't reach green;
- **major plan-vs-code drift** — implementing as written would mean redesigning the approach;
- **scope explosion** — the work vastly exceeds what the milestone defined;
- the toolchain or a baseline can't be established;
- a gate reviewer escalates (including a Critical TypeScript finding that needs an engineer);
- non-progress with budget exhausted.

On an unrecoverable wall, **stop the run**: dispatch no new milestones or batches. Siblings already in flight finish their gate and merge if they pass, because their work is independent and already paid for. Nothing that depends on the failed milestone starts.

### Safe-stop procedure (exact order)
1. **Stop dispatching.** Let in-flight siblings finish and merge per Stage 1.
2. **Confirm the integration branch is clean and at `last_green_commit`.** It only ever moves on green merges, so it should be; if a merge is mid-way, `git merge --abort`.
3. **Leave the failed milestone's workspace in place** for the human to inspect — worktree, branch, and any uncommitted changes. Don't delete or reset it. (In the serial fallback, where work happens in the main checkout, commit nothing further and switch the main checkout back to the integration branch only if the tree is clean; otherwise leave it and say so.)
4. **Write the escalation report.**
5. **Set the main ledger** to `run_status: halted` and the failed milestone to `halted`, with where and why.

## Report formats

### Escalation report — `.execution/escalation-report.md`
```markdown
# Escalation Report — <feature>
## Where it stopped — milestone N, task <id> (or gate / merge)
## What was being attempted — the task + its acceptance criteria
## Why it's unrecoverable — budget exhausted / major drift / scope explosion / toolchain / gate escalation / non-progress
## Evidence — failing test(s) / error output (concise), failure signature, or the gate finding
## Self-correction attempts — each distinct hypothesis tried and its result
## Drift detail (if applicable) — what the plan assumed vs. what the code is
## State left behind — integration branch + last_green_commit, milestones merged, the failed milestone's branch and workspace path (with any uncommitted changes)
## Recommended human actions — specific next steps
```

### Final implementation report — `.execution/implementation-report.md`
```markdown
# Implementation Report — <feature>
## Summary — milestones completed, layers run in parallel, total commits, suite status
## PR stack — in merge order: branch, base, the tasks and requirements it covers, its size. Merge bottom-up; after each squash merge, merge `main` into the next branch before merging it.
## Traceability matrix — requirement → milestone → task → commit(s) → test(s), planned vs actual
## Open-decision choices — each non-blocking decision the run settled: the choice and why
## Architecture conformance — adherence to the holistic architecture; any accepted minor drift
## TypeScript review — per milestone: Critical/High found and fixed; High findings that need an engineer; Medium/Low counts; links to each milestone's typescript-review.md
## Baseline note — pre-existing failures carried (if any)
## What's ready — the PR stack, ready to push; its top branch has the same tree as the integration branch. The integration and milestone branches can be deleted once the stack is pushed.
## Follow-ups & accepted risks — High TypeScript findings that need an engineer; test-plan coverage gaps and accepted risks; Phase 5 outstanding concerns and safety flags; `out_of_scope_findings` (left untouched)
```
