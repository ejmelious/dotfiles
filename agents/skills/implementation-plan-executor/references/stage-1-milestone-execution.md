# Stage 1 — Milestone Execution (per layer, autonomous)

Work through the layers and batches computed in Stage 0, in order. The orchestrator schedules, dispatches, gates, and merges; milestone workers write the code. The mechanics of each worker's task cycle and each gate live in `execution-loop.md`.

## Per batch

### 1. Prepare a workspace per milestone
- **Batch of one milestone:** create branch `<feature-slug>-m<N>` from the integration branch head and work in the main checkout. No worktree, no extra install.
- **Batch of several:** for each milestone, create a worktree **outside the main checkout** on its own branch from the integration branch head:
  `git worktree add -b <feature-slug>-m<N> ../<repo>.worktrees/<feature-slug>/m<N> <integration-head>`
  Outside, because tools run in the main checkout (test runners, `tsc` include globs) can pick up files nested inside it. Then run the repo's install command in the worktree.

Record each milestone's branch, workspace path, and `start_commit` in the main ledger; mark it `in_progress`.

### 2. Dispatch milestone workers (in parallel)
One fresh subagent per milestone, all in one message. Keep the prompt to the specifics — the worker reads this skill's references itself:

> "You are the milestone worker for milestone N of `<feature-slug>`. Read `execution-loop.md` and the control spine in `<abs path to this skill>/references/`. Work only in `<abs workspace path>` on branch `<branch>`. Your inputs (absolute paths, main checkout): eng spec, test plan, holistic architecture, milestone ledger. Toolchain: <commands>. Baseline failure set: <list or path>. `concurrent_tests: <true|false>`. Run pre-flight, the per-task cycle for every task, then the full suite, updating your milestone ledger as you go. Return: status (`ready_for_gate` / `halted`), branch head SHA, full-suite result vs baseline, and one line per task."

**When `concurrent_tests: false`:** tell workers to run only targeted tests during the task cycle and to return `ready_for_full_suite` instead of running the full suite. The orchestrator then runs each milestone's full suite in its workspace one at a time and records the result in that milestone's ledger.

### 3. Gate each milestone
As each worker returns `ready_for_gate`, run that milestone's **review gate** (`execution-loop.md`) — don't wait for siblings. Fix findings go back to **the same worker** (continue it with SendMessage in Claude Code so it keeps its context); if it can't be continued, start a fresh worker with the milestone ledger, the findings file, and the same workspace.

### 4. Merge passed milestones
Merge each milestone that passed its gate into the integration branch, one at a time, in milestone-id order:
- **First merge in the batch:** the integration branch hasn't moved since the branch was cut, so `git merge --no-ff <branch>` produces the tree the gate already verified. Commit it.
- **Each later merge:** `git merge --no-ff --no-commit <branch>`, run the full suite, and commit only if it's green against the baseline. If it's red or the merge conflicts, `git merge --abort` (the integration branch is untouched) and send the milestone back to its worker: merge the current integration branch into its milestone branch, resolve, re-run the full suite, and re-gate. This counts against the milestone's gate budget.

After each successful merge, set `last_green_commit` to the new integration head, mark the milestone `done`, and remove its worktree (`git worktree remove`). Keep the milestone branch until the run ends.

### 5. Advance or stop
- Every milestone in the batch `done` → next batch / layer.
- A milestone is **unrecoverable** (budget exhausted, major drift, scope explosion, non-progress, escalated gate) → stop dispatching new work. Let siblings already in flight finish their gate; merge the ones that pass. Then **hard-stop** per the control spine. Nothing that depends on the failed milestone starts.

## Pre-flight (worker, per milestone)
- Re-read the eng spec, task list, test plan, and the minor drift recorded in your milestone ledger.
- **Reconcile against current code again** — earlier layers just changed the repo. Minor drift → adapt and note. Major drift → return `halted` with the evidence.
- Confirm the workspace is at `start_commit` and that the toolchain runs.

## Serial fallback (no subagents)
Run the same stages with the orchestrator playing every role, one milestone at a time, in the main checkout on each milestone's branch: re-read only that milestone's inputs before starting it, run the per-task cycle, then run each gate reviewer as a separate, explicitly re-anchored pass that reviews the diff without relying on the reasoning that produced it. Merge and advance as above. No worktrees.

## Sequencing notes
- Never start a milestone whose `depends_on` aren't all `done`.
- A later milestone builds on earlier milestones' merged code — that's why every merge after the first in a batch runs the full suite, and every gate does.
