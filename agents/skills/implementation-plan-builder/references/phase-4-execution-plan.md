# Phase 4 — Technical Execution Plan (per milestone)

> **STATUS: VALIDATED — per your spec.**

**Goal:** for each milestone, turn the milestone definition + eng spec into an **end-to-end technical execution plan with task definitions** — epics, user stories/tasks with acceptance criteria, sequencing, and PR strategy — validated against the codebase and the overarching architecture.

**Per-milestone execution:** run a loop pass independently for every milestone. Each milestone gets its own folder and preserved loop trail:
```
phase-4-execution/
├── milestone-1/
│   ├── execution-plan.md
│   └── .loops/{loop-1-tech-lead, loop-2-sr-engineer, loop-3-architect}.md
├── milestone-2/  └── ...
```

**Read `references/loop-process.md` first.**

**Input packet (per milestone):** the milestone's definition (Phase 2), the milestone's eng spec (Phase 3), the Phase 1 holistic architecture, prior milestones' execution plans, + codebase.

---

## Execution shape — size-adaptive + parallelizable

Unlike Phase 3 (which always runs a full three-loop pass per milestone because the architectural surface is novel each time), Phase 4 builds on an **already-pressure-tested eng spec from Phase 3**. The novel content per milestone is task decomposition + sequencing + PR strategy — much less than Phase 3's architecture work. This admits two cost-aware optimizations.

### Across-milestone parallelization (default)

Phase 4 outputs are **independent across milestones** — each milestone's execution plan consumes only its own already-final Phase 3 eng spec plus the Phase 1 architecture, with no inter-milestone dependencies in the Phase 4 artifacts themselves. The orchestrator should run Phase 4 milestones in parallel:

- All milestone Loop-1s fire in parallel (single message with N Agent calls).
- After all Loop-1s return, all milestone Loop-2s fire in parallel.
- After all Loop-2s return, all milestone Loop-3s fire in parallel (where applicable — see size fast-path below).

Wall-clock drops by ~Nx for the phase.

### Size-adaptive loop count

**For size-S milestones, run a 2-loop fast-path** (Loop 1 Tech Lead + a combined Loop 2 "Sr Engineer + Architect" pass). Phase 4 size-S milestones have a small task surface, the eng spec already validated architecture, and a third specialized loop mostly ceremonies a verdict.

**For size L, XL, or larger, run the full 3-loop pass.** Larger milestones have more sequencing and PR-strategy complexity; the separate Architect pressure-test still earns its keep.

Use the milestone's Phase 2 size tag (S / M / L / XL) to decide.

### Combined Loop 2 (size-S fast-path)

When using the fast-path, the combined Loop 2 persona is **Sr. Engineer + Architect (read-and-validate)**. Mandate:
- Codebase-ground the task breakdown (the original Loop 2 job): are the tasks real, complete, correctly scoped?
- Pressure-test architectural fit (the original Loop 3 job): does the plan slot into the overarching architecture, no drift?
- Best-practice evaluation: name ≥2 distinct practices and how the plan measures up (lighter than the full 3-loop's ≥3).
- Draft the final execution plan, incorporating Loop 1's breakdown.
- Verdict: ship / revise / escalate.

Save the combined critique to `.loops/loop-2-sr-eng-architect.md`. The execution plan is the post-incorporation version. No Loop 3 file in the fast-path.

---

---

## Loop 1 — Tech Lead (Author)

**Mandate:** break the milestone's work into the units the team will actually implement, and define how they'll be executed.

**Do:**
- Take the **milestone definition + eng spec** and decompose the work into **epics** and **user stories / tasks**, each with **acceptance criteria**.
- Define the **sequencing** of the work within the milestone.
- Define the **PR strategy** — branching, how PRs are sliced, review and integration approach.
- Draft the **execution plan** for the milestone.

**Produces — Execution Plan (first draft):** epic / story / task breakdown with acceptance criteria, sequencing, and PR strategy.

## Loop 2 — Senior Engineer / Codebase Expert (Ground)

**Mandate:** load the codebase context, validate the plan against it, and define more completely what will happen in the system to execute the requirements and acceptance criteria as defined.

**Do:**
- Load the relevant **codebase context** — read the code, don't theorize.
- Validate the breakdown against the codebase: are the stories/tasks real, complete, and correctly scoped against what the system actually requires?
- For each epic / story / task, define concretely **what happens in the system** to satisfy the requirement and its acceptance criteria — the actual changes, touchpoints, and behavior.
- **Iterate through each epic / story / task for completeness** — surface missing tasks, hidden work, and gaps in acceptance criteria.

**Produces:** codebase-validated, system-complete task definitions + critique of Loop 1.

## Loop 3 — Architect (Pressure-test & Final Draft)

**Mandate:** review all of this milestone's defined artifacts, compare them to the overarching system architecture, validate for best practice, and draft the final execution plan with the team.

**Do:**
- Review **every artifact defined for this milestone** (Loop 1 breakdown + Loop 2 system definitions).
- Compare against the **overarching system architecture** (Phase 1) — confirm fit, no drift.
- Validate for best practice and make concrete **recommendations for improvement**.
- **Evaluate the plan against at least three distinct architectural best practices** — name each and document how the plan measures up (choose the most relevant, e.g. separation of concerns, DRY, loose coupling / high cohesion, idempotency, fault isolation, contract-first, backward compatibility).
- **Draft the final execution plan**, incorporating the Tech Lead's and Sr. Engineer's work.

**Produces — the final end-to-end technical execution plan with task definitions.** Verdict: ship / revise / escalate.

---

## Synthesis — `milestone-N/execution-plan.md`

In this phase the **Architect (Loop 3) drafts the final artifact directly**, folding in Loops 1 and 2 — not a separate neutral synthesis. Preserve all three loops' raw output in `.loops/`. Name any unresolved tension as an open decision.

```markdown
# Technical Execution Plan — Milestone N: <name>
## Overview & objective
## Epics
  - <epic> — goal
    - Story / Task — description + acceptance criteria + what happens in the system
## Sequencing (order of work within the milestone)
## PR strategy (branching, PR slicing, review/integration)
## Architectural best-practice evaluation (≥3 named practices + how the plan measures up)
## Recommendations incorporated
## Open decisions
## Verdict
## Traceability — eng-spec, milestone, codebase (path + symbol), and architecture references
```
