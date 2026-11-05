---
name: implementation-plan-executor
description: Autonomously execute an existing engineering implementation plan against a codebase — milestone by milestone, test-first, self-validating and self-correcting — until the whole implementation is complete or it safely hard-stops. Use this skill whenever the user wants to implement, execute, or "build out" a plan produced by the implementation-plan-builder (or any plan with milestones, eng specs, and a test plan), work through the milestones, or turn an approved implementation plan into shipped code. Trigger it when the user says things like "implement the plan," "execute the implementation plan," "work through the milestones," or "build this out from the plan" — even if they just point at a .ai-dev/implementation-plan folder and a repo. It runs unattended and only returns for a final report or an escalation, so prefer it over ad hoc implementation whenever a structured plan exists.
---

# Implementation Plan Executor

Take an approved implementation plan and turn it into shipped, verified code — **autonomously**. The executor grounds in the codebase, works through each milestone in dependency order, and self-validates and self-corrects at every step. It runs unattended end to end and returns to the human in exactly two situations: a **final report** when the whole plan is implemented, or an **escalation report** when it hits a wall it cannot safely pass.

This is the companion to `implementation-plan-builder`. The builder produces the plan; this skill executes it.

## Inputs

1. **The implementation plan** — a feature-slug folder under `.ai-dev/implementation-plan/<feature-slug>/`, produced by `implementation-plan-builder`, holding the per-milestone eng specs (design, tasks, acceptance criteria, commit plan) and test plans. The handoff contract (identity, milestone list, sign-off status) is the builder's shared `.ai-dev/implementation-plan/manifest.yaml`, one level up. It is either a single feature entry or, once a second plan exists, a top-level `features:` list; use the entry whose `folder` matches the selected `<feature-slug>`. **All other context for the run lives in the feature folder** — reference it throughout.
2. **The codebase** — the current working repository.

### Selecting the plan (before the autonomous run)
Plan selection happens *before* the run goes heads-down, so asking the user here is allowed — it is not a mid-run checkpoint.

- **No plan folders found** → stop and tell the user to run `implementation-plan-builder` first. Never improvise a plan.
- **Exactly one plan folder** → that's the candidate.
- **Multiple plan folders** → ask the user which `<feature-slug>` to execute. Never guess.

### Verifying the plan is safe to execute
Before doing anything, read the selected feature's manifest entry and refuse to proceed unless all hold — refusing here is the point of the contract:
- `.ai-dev/implementation-plan/manifest.yaml` exists, parses, and has exactly one entry whose `folder` is the selected `<feature-slug>`.
- `signed_off: true` **and** `status: complete`. A plan that isn't signed off (Phase 5 didn't bless it) or isn't complete is **not executable** — stop and report why. Executing an unfinished or blocked plan is exactly the failure this skill exists to prevent.
- No entry in `open_decisions` is blocking. An entry with `blocking: true`, or with no `blocking` field, means humans still owe the plan a call; don't paper over it by executing anyway. Entries with `blocking: false` are deferred items: list them in the run summary and proceed.
- `target_repo` matches the repo this is being run against. On mismatch, stop and ask — the plan may belong to a different codebase.

### Confirm before going autonomous
As the last thing before the unattended run begins, echo back exactly what will run: feature name + slug, milestone count and names, target branch, and the sign-off date. This is the human's one chance to catch "wrong plan" before it runs heads-down. Then proceed without further interruption.

## Autonomy model

The run is fully unattended. **There are no per-milestone human approvals.** The human re-enters in exactly two places:

- **Success** → the final implementation report.
- **Unrecoverable wall** → a hard-stop at the last green commit, plus an escalation report.

Everything between is automatic: implement → verify → self-correct → independent review → advance. Removing the human checkpoint does not loosen the gates — it shifts their weight onto the machine controls below, which is why those controls are strict.

## Why this is built the way it is

Five principles drive every design choice. When in doubt, resolve toward these.

1. **The plan is a hypothesis; the codebase is the truth.** The plan was written earlier and the repo has moved. Reconcile plan against current code at startup and at each milestone pre-flight. Minor drift → adapt and note it. Major drift (the plan's premises no longer hold) → there is no human to re-plan mid-run, so **hard-stop and escalate** rather than improvise a large deviation.
2. **Stay green.** Establish a known baseline before touching anything; verify every increment; never advance on red. A change that introduces a new failure is not done.
3. **"Done" is acceptance criteria met + tests passing — never "looks done."** Phase 3's eng spec gave every task acceptance criteria; Phase 4 gave the test plan. Treat those as the literal, machine-checkable definition of done. This is what makes self-validation trustworthy instead of self-congratulatory.
4. **Bounded self-correction with a safe failure mode.** Self-correct within an explicit budget. "Move on to the next milestone" never means "move on past red" — if a milestone can't reach green within budget, advancing would compound the corruption through every downstream milestone, so the run **hard-stops** instead.
5. **Resumable.** Long runs get interrupted. A progress ledger in the repo records exactly where it is, so a resumed run continues without redoing or double-applying work.

## The pipeline

| Stage | Scope | What it does | Reference |
|-------|-------|--------------|-----------|
| 0 | once | Ground in the codebase, load + reconcile the plan, discover the toolchain, establish a green baseline, branch, init the ledger | `references/stage-0-ground-and-baseline.md` |
| 1 | per milestone (dependency order) | Pre-flight reconcile → execution loop → independent review gate → advance or hard-stop | `references/stage-1-milestone-execution.md` |
| 2 | once | Full-suite green, requirement→task→commit→test traceability, whole-system conformance, final report | `references/stage-2-end-to-end-validation.md` |

The reusable heart is the **execution loop** (`references/execution-loop.md`) — the per-task build→verify→self-correct→commit cycle plus the per-milestone independent review gate. Every milestone runs through it.

The **control spine** (`references/verification-ledger-escalation.md`) defines verification discipline, the progress ledger, self-correction bounds, the hard-stop discipline, and the report formats. Read it before Stage 0 — it governs all three stages.

## Output & boundaries

The executor works on a dedicated branch and writes everything inside the plan's own folder, so the plan and its execution record stay together:
- **Code + commits** — per the milestone's commit plan (eng spec, Phase 3).
- **The ledger** — `.ai-dev/implementation-plan/<feature-slug>/.execution/ledger.md` (progress, baseline, last green commit).
- **Reports** — `.ai-dev/implementation-plan/<feature-slug>/.execution/` (final report on success, escalation report on hard-stop).

Operating boundaries, in addition to the principles:
- **Commit locally; do not push or open PRs automatically.** Pushing and PR creation are the natural human review surface — leave them to the person. The final report says exactly what's ready to push. (Configurable, but this is the default and the safe one.)
- **Never advance on red. Never advance past an unrecoverable wall.** These are absolute.

## Where to go next

- Before anything → read `references/verification-ledger-escalation.md` (the control spine).
- Then run Stage 0 → `references/stage-0-ground-and-baseline.md`.
- Per milestone → `references/stage-1-milestone-execution.md`, which drives `references/execution-loop.md`.
- At the end → `references/stage-2-end-to-end-validation.md`.
