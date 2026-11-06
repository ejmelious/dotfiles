---
name: implementation-plan-executor
description: Autonomously execute an existing engineering implementation plan against a codebase — milestone by milestone, test-first, self-validating and self-correcting — until the whole implementation is complete or it safely hard-stops. Use this skill whenever the user wants to implement, execute, or "build out" a plan produced by the implementation-plan-builder (or any plan with milestones, eng specs, and a test plan), work through the milestones, or turn an approved implementation plan into shipped code. Trigger it when the user says things like "implement the plan," "execute the implementation plan," "work through the milestones," or "build this out from the plan" — even if they just point at a .ai-dev/implementation-plan folder and a repo. It runs unattended and only returns for a final report or an escalation, so prefer it over ad hoc implementation whenever a structured plan exists.
---

# Implementation Plan Executor

Take an approved implementation plan and turn it into shipped, verified code — **autonomously**. The executor grounds in the codebase, then works through the milestones in dependency layers. Each milestone is implemented by its own worker subagent, and independent milestones in a layer run in parallel in separate git worktrees. Every milestone passes an independent review gate before it's merged. The run returns to the human in exactly two situations: a **final report** when the whole plan is implemented, or an **escalation report** when it hits a wall it cannot safely pass.

This is the companion to `implementation-plan-builder`. The builder produces the plan; this skill executes it.

## Inputs

1. **The implementation plan** — a feature-slug folder under `.ai-dev/implementation-plan/<feature-slug>/`, produced by `implementation-plan-builder`, holding the per-milestone eng specs (design, tasks, acceptance criteria, commit plan) and test plans. The handoff contract (identity, milestones with `depends_on` and `touches`, sign-off status) is the builder's shared `.ai-dev/implementation-plan/manifest.yaml`, one level up. It is either a single feature entry or a top-level `features:` list; use the entry whose `folder` matches the selected `<feature-slug>`.
2. **The codebase** — the current working repository.

### Selecting the plan (before the autonomous run)
Asking the user here is allowed — it happens before the run goes heads-down.

- **No plan folders found** → stop and tell the user to run `implementation-plan-builder` first. Never improvise a plan.
- **Exactly one plan folder** → that's the candidate.
- **Multiple plan folders** → ask which `<feature-slug>` to execute. Never guess.

### Verifying the plan is safe to execute
Read the selected feature's manifest entry and refuse to proceed unless all hold:
- `manifest.yaml` exists, parses, and has exactly one entry whose `folder` is the selected `<feature-slug>`.
- `signed_off: true` **and** `status: complete`. A plan that isn't signed off (Phase 5 didn't bless it) or isn't complete is **not executable** — stop and report why.
- No entry in `open_decisions` is blocking. An entry with `blocking: true`, or with no `blocking` field, means humans still owe the plan a call. Entries with `blocking: false` are listed in the run summary and the run proceeds.
- `target_repo` matches the repo this is being run against. On mismatch, stop and ask.

### Confirm before going autonomous
As the last thing before the unattended run, echo back exactly what will run, in plain words:
- feature name + slug, sign-off date, the integration branch name;
- the milestones grouped into the layers they'll run in, and which run in parallel;
- that parallel milestones each get a temporary git worktree next to the repo, each runs the repo's dependency install there, worktrees are removed after their milestone merges, and everything is committed locally only — nothing is pushed.

This is the human's one chance to catch "wrong plan" or "don't run installs in parallel here". Then proceed without further interruption.

## Autonomy model

The run is fully unattended. **There are no per-milestone human approvals.** The human re-enters only for the final report or an escalation. Removing the human checkpoint does not loosen the gates — it shifts their weight onto the machine controls in the control spine, which is why those controls are strict.

## Why this is built the way it is

1. **The plan is a hypothesis; the codebase is the truth.** Reconcile plan against current code at startup and at each milestone pre-flight. Minor drift → adapt and note it. Major drift → there is no human to re-plan mid-run, so **hard-stop and escalate**.
2. **Stay green.** The integration branch only ever moves to a commit where the full suite is green relative to the baseline. Never advance on red.
3. **"Done" is acceptance criteria met + tests passing — never "looks done."** The eng spec gives every task acceptance criteria; the test plan gives the tests. Treat those as the literal definition of done.
4. **Bounded self-correction with a safe failure mode.** Self-correct within explicit budgets. If a milestone can't reach green within budget, the run **hard-stops** rather than building on it.
5. **Fresh context per milestone.** The orchestrator never reads or writes product code. Each milestone worker starts with only its own spec, test plan, the architecture, and the code it touches — so milestone 6 is implemented with the same clarity as milestone 1.
6. **Resumable.** Ledgers on disk record exactly where every milestone is, so a resumed run continues without redoing or double-applying work.

## Roles

| Role | Context | Does |
|------|---------|------|
| **Orchestrator** (you) | manifest, ledgers, worker/reviewer summaries | Stage 0 baseline, scheduling layers, creating worktrees, dispatching workers and reviewers, merging, the main ledger, reports. Never edits product code. |
| **Drift checker** (read-only, one per milestone, Stage 0) | one milestone's eng spec + the code it names | Reports minor / major plan-vs-code drift. |
| **Milestone worker** (one per milestone) | its eng spec, test plan, holistic architecture, milestone ledger, its worktree | Pre-flight, the per-task cycle, the milestone's full suite, fixing gate findings. |
| **Acceptance & architecture reviewer** (fresh, per gate) | spec, test plan, architecture, milestone diff, suite results | Tries to falsify acceptance criteria, test reality, architecture conformance. |
| **TypeScript reviewer** (fresh, per gate, when `.ts`/`.tsx` changed) | `typescript-review` in embedded, report-only mode | Rated type-safety findings on the milestone's commit range. |

If subagents aren't available (e.g. some Codex setups), the orchestrator plays every role itself, serially, in the main checkout — see the serial fallback in `references/stage-1-milestone-execution.md`.

## The pipeline

| Stage | Scope | What it does | Reference |
|-------|-------|--------------|-----------|
| 0 | once | Load + verify the plan, discover the toolchain and whether tests can run concurrently, green baseline, parallel drift checks, compute layers, integration branch, ledgers | `references/stage-0-ground-and-baseline.md` |
| 1 | per layer | Worktrees → parallel milestone workers → two-reviewer gate per milestone → merge into the integration branch | `references/stage-1-milestone-execution.md` |
| 2 | once | Full-suite green, requirement→task→commit→test traceability, whole-system conformance, final report | `references/stage-2-end-to-end-validation.md` |

The per-task cycle and the review gate are in `references/execution-loop.md`. The **control spine** (`references/verification-ledger-escalation.md`) defines green, the ledgers, budgets, the hard-stop, and the report formats — read it before Stage 0.

## Output & boundaries

- **Code + commits** — on per-milestone branches (`<feature-slug>-m<N>`), following each eng spec's commit plan, merged into the integration branch (`<feature-slug>`).
- **Ledgers** — `.ai-dev/implementation-plan/<feature-slug>/.execution/ledger.md` (orchestrator) and `.execution/milestone-<N>/ledger.md` (each worker).
- **Reviews** — `.execution/milestone-<N>/typescript-review.md` and `gate-review.md`.
- **Reports** — `.execution/implementation-report.md` on success, `.execution/escalation-report.md` on hard-stop.

`.ai-dev/` is git-ignored, so it does **not** exist inside worktrees. Always pass workers and reviewers absolute paths into the main checkout's plan folder.

Operating boundaries:
- **Commit locally; do not push or open PRs.** The final report says exactly what's ready to push.
- **Never advance on red. Never advance past an unrecoverable wall.** These are absolute.
