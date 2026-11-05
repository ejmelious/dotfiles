# Phase 2 — Milestone Breakdown

**Goal:** decompose the refined PRD + holistic architecture (both post-G1) into ordered, independently-shippable milestones that deliver incrementally.

**Read `references/loop-process.md` first.** This phase runs **two loops**: Author → Ground. The Ground loop gives the verdict.

**Input packet:** Phase 1 artifacts + codebase.

---

## Loop 1 — Technical Program Manager (Author)

**Mandate:** author the milestone breakdown as vertical, value-delivering slices.

**Do:** decompose into milestones that each ship something coherent; define goal, scope, exit criteria, and size (S / M / L / XL) per milestone; map dependencies; sequence for incremental value. Prefer thin vertical slices over horizontal layers. Use as many milestones as the work needs to ship safely in slices, and no more — a milestone that can't ship value on its own should merge with its neighbor.

**Produces — Milestone Plan (first draft).** Save reasoning to `.loops/loop-1-tpm.md`.

## Loop 2 — Tech Lead (Ground + Verdict)

**Mandate:** ground the breakdown against engineering reality and decide whether it ships.

**Do:**
- Test that slices are genuinely independent (no hidden dependency cycles) and each is buildable, testable, and shippable on its own.
- Verify the boundaries against the codebase's actual seams.
- Right-size milestones; merge ones that are too thin to stand alone.
- Pull risk and uncertainty forward (de-risking spikes first) so a slip in one milestone doesn't cascade.
- Group milestones into dependency layers (which can be specced in parallel in Phase 3).
- Give a verdict: ship / revise / escalate.

**Produces:** critique + revisions + verdict in `.loops/loop-2-tech-lead.md`.

---

## Synthesis — `milestone-plan.md`
```markdown
# Milestone Plan — <feature>
## Milestones (each: goal / scope / exit criteria / size / dependencies / value shipped)
## Sequencing & rationale (why this order)
## Dependency layers (which milestones can be specced in parallel)
## Risk-front-loading & de-risking spikes
## Open decisions
## Verdict
```
