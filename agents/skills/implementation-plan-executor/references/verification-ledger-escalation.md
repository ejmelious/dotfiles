# Control Spine — Verification, Ledger, Self-Correction & Escalation

This governs all three stages. With no human in the loop, these controls are what make autonomy safe. Read it before Stage 0.

## Verification discipline

**What "green" means.** All discovered verification commands pass: build, typecheck, lint, and the test suite. The exact commands are discovered in Stage 0 from the repo (package.json scripts, CI config, Makefile, etc.) — never assumed.

**Baseline-relative green.** Real repos aren't always green at rest. In Stage 0, if the suite is fully green, that's the baseline. If it isn't, record the **exact set of pre-existing failures** as the baseline set. From then on the invariant is: **no new failures beyond the recorded baseline set.** A previously-failing test that stays failing is tolerated and noted; any *new* failure is red.

**Two verification tempos:**
- **Inner loop (per task):** run the targeted tests for the change plus typecheck/lint — fast feedback while implementing.
- **Gate (per milestone, and Stage 2):** run the **full suite**. This is the regression firewall. With no human watching for cross-milestone breakage, a full green suite at every gate is the only thing that catches "milestone 4 quietly broke milestone 2." Never skip it to save time.

## Progress ledger

A single source of truth at `.ai-dev/implementation-plan/<feature-slug>/.execution/ledger.md`. Update it at every state change — it is what makes the run resumable and auditable.

Track:
- `baseline_commit` and the recorded `baseline_failure_set`
- `branch`
- `last_green_commit` — the most recent commit where the gate was green; the safe place to fall back to
- per **milestone**: status (`pending` / `in_progress` / `done` / `halted`), start/end commits
- per **task** within a milestone: status, the commit(s) that implemented it, which acceptance criteria it satisfies, which tests cover it
- `current_position` — milestone + task in progress
- `run_status` — `running` / `complete` / `halted`

**Resumability.** On startup, read the ledger. If a prior run was interrupted (`run_status: running` but the process isn't), re-verify the repo is at `last_green_commit` and green, then resume from `current_position` — do not redo completed tasks or re-apply committed work.

## Bounded self-correction

Self-correction is bounded so a stuck run fails safe instead of thrashing forever.

- **Per-task budget:** a fixed number of correction attempts to get a task green (default 3). Each attempt must be a *different* hypothesis, not a retry of the same edit.
- **Per-milestone gate budget:** a fixed number of fix-cycles after the review gate returns "fix" (default 2) before the milestone is considered unrecoverable.
- **Non-progress detection:** if two consecutive attempts produce the **same failure signature** (same failing test / same error), that's a loop, not progress — stop spending budget on it and treat it as trending toward unrecoverable. Repeating an approach that already failed is the clearest sign the agent is stuck.

These defaults are deliberately conservative. They can be tuned, but raising them trades safety for persistence.

## Unrecoverable walls → hard-stop

A wall is **unrecoverable** when any of these holds and self-correction within budget hasn't cleared it:
- A task or milestone cannot reach green within its budget.
- **Major plan-vs-code drift** — implementing as written would require redesigning the approach, not just adjusting a file path or symbol reference. (Minor drift is adapted and noted; major drift has no human to re-plan it.)
- **Scope explosion** — the work required vastly exceeds what the milestone defined, signaling the plan was wrong about the milestone.
- The verification toolchain can't be established, or a green/baseline state can't be determined.
- Non-progress: repeated identical failure signatures with budget exhausted.

On an unrecoverable wall, **hard-stop the entire run** — do not skip ahead, do not start the next milestone. In a dependency-ordered plan a failed milestone usually blocks what follows, and stopping bounds the blast radius.

### Safe-stop procedure (exact order)
1. **Stop.** No further tasks or milestones.
2. **Leave the repo clean at a known-good state.** If there are uncommitted/in-progress changes from the failed task, revert the working tree to `last_green_commit` so nothing half-applied is left behind. Never leave a broken, dirty tree.
3. **Write the escalation report** (format below).
4. **Set the ledger** to `run_status: halted`, the failed milestone to `halted`, and record where and why.

A clean repo at the last green commit is what makes the hard-stop safe: the human picks up from a known-good state, not a wreck.

## Report formats

### Escalation report — `.ai-dev/implementation-plan/<feature-slug>/.execution/escalation-report.md`
```markdown
# Escalation Report — <feature>
## Where it stopped — milestone N, task <id>
## What was being attempted — the task + its acceptance criteria
## Why it's unrecoverable — budget exhausted / major drift / scope explosion / toolchain / non-progress
## Evidence — failing test(s) / error output (concise), failure signature
## Self-correction attempts — each distinct hypothesis tried and its result
## Drift detail (if applicable) — what the plan assumed vs. what the code actually is
## State left behind — last_green_commit SHA, branch, what's committed vs. not
## Recommended human actions — specific next steps (e.g. re-plan milestone N, fix env, adjust contract)
```

### Final implementation report — `.ai-dev/implementation-plan/<feature-slug>/.execution/implementation-report.md`
```markdown
# Implementation Report — <feature>
## Summary — milestones completed, total commits, suite status
## Traceability matrix — requirement → milestone → task → commit(s) → test(s)
## Architecture conformance — adherence to the holistic architecture; any noted, accepted minor drift
## Baseline note — pre-existing failures carried (if any)
## What's ready — branch + commits ready to push / open PRs (not done automatically)
## Follow-ups & accepted risks
```
