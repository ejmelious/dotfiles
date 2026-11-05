# Stage 1 — Milestone Execution (per milestone, autonomous)

Work through the milestones in **dependency order**. Each milestone is fully autonomous: pre-flight, execute, gate, then advance or hard-stop. No human approval between milestones. This stage orchestrates; the mechanics live in `execution-loop.md`.

## Per milestone

### 1. Pre-flight
- Mark the milestone `in_progress` in the ledger; record its start commit.
- Re-read this milestone's eng spec with its task list (Phase 3) and test plan (Phase 4).
- **Reconcile against current code again.** Earlier milestones just changed the repo, so this milestone's assumptions may have shifted since the plan — or since Stage 0. Minor drift → adapt and note. Major drift → hard-stop and escalate.
- Confirm the repo is at `last_green_commit` and green before starting work.

### 2. Execute
Run the **per-task cycle** from `execution-loop.md` for every story/task, in the eng spec's task order: test-first → implement → verify → bounded self-correct → confirm acceptance criteria → commit → ledger.

### 3. Review gate
Run the **per-milestone independent review gate** from `execution-loop.md` (fresh-context subagent, full suite, acceptance criteria, architecture conformance, no regressions).

### 4. Advance or stop
- **Pass** → mark the milestone `done`, update `last_green_commit`, move to the next milestone automatically.
- **Fix** → self-correct the cited defects and re-review, within the gate budget.
- **Unrecoverable** (any budget exhausted, major drift, scope explosion, non-progress) → **hard-stop the whole run** per the control spine's safe-stop procedure. Do not start the next milestone.

## Sequencing notes
- Respect dependencies strictly — never start a milestone whose prerequisites aren't `done`.
- A later milestone may legitimately build on an earlier milestone's code; that's expected, which is exactly why the full suite runs at every gate.
- The run continues milestone after milestone with no pause until either all milestones are `done` (→ Stage 2) or a hard-stop fires (→ escalation report, end of run).
