# Phase 2 — Milestone Breakdown

> **STATUS: VALIDATED.**

**Goal:** decompose the validated architecture + refined PRD into ordered, actionable, independently-shippable milestones.

**Read `references/loop-process.md` first.**

**Input packet:** Phase 1 artifacts + codebase.

---

## Loop 1 — Technical Program Manager (Author)

**Mandate:** author the milestone breakdown as vertical, value-delivering slices.

**Do:** decompose into milestones that each ship something coherent; define goal, scope, and exit criteria per milestone; map dependencies; sequence for incremental value. Prefer thin vertical slices over horizontal layers.

**Produces — Milestone Plan (first draft).**

## Loop 2 — Tech Lead (Ground)

**Mandate:** ground the breakdown against engineering reality.

**Do:** test whether slices are genuinely independent (no hidden dependency cycles); confirm each milestone is buildable, testable, and shippable on its own; right-size them; pull risk and uncertainty forward (de-risking spikes first); verify against the codebase's actual seams.

**Produces:** critique + re-sequenced/re-scoped revisions.

## Loop 3 — Engineering Manager (Pressure-test)
*The delivery-feasibility lens.*

**Mandate:** pressure-test the plan as something a real team must execute, and audit Loop 2.

**Do:** trace the critical path; assess parallelizability across people/squads; surface risk concentration and single points of failure; check that uncertainty is front-loaded and that a slip in one milestone doesn't cascade. Verdict.

**Produces:** delivery pressure-test + verdict.

---

## Synthesis — `milestone-plan.md`
```markdown
# Milestone Plan — <feature>
## Milestones (each: goal / scope / exit criteria / dependencies / value shipped)
## Sequencing & rationale (why this order)
## Critical path
## Risk-front-loading & de-risking spikes
## Parallelization map
## Open decisions
## Verdict
```
