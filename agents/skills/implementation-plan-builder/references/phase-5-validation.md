# Phase 5 — Final End-to-End Validation & Sign-off

**Goal:** one final, end-to-end validation of the complete plan across every milestone. Surface missed edges, gaps, or concerns; confirm the pieces fit into a coherent whole; sign off.

**Scope:** whole plan, run **once**. If the plan has 3+ milestones, run simplification gate **G3** (`simplification-gate.md`) first and apply its accepted cuts, so this pass validates the simplified plan.

**Read `references/loop-process.md` for the traceability and integrity rules.** This is a single pass, not the three-loop process.

**Input packet:** refined PRD + holistic architecture (Phase 1), milestone plan (Phase 2), every milestone's eng spec (Phase 3) and test plan (Phase 4), + codebase.

---

## Single Pass — Architect (End-to-End Validation & Sign-off)

**Mandate:** validate the entire plan end to end and sign off.

**Do:**
- Read the whole plan as one body of work, not milestone by milestone.
- **Surface missed edges and gaps:** requirements with no milestone, acceptance criteria with no test, cross-milestone seams no one owns, sequencing that leaves a milestone unshippable, contracts that don't line up between milestones.
- Surface remaining concerns: architectural drift across milestones, unresolved open decisions, unaddressed safety flags from Phase 1 or Phase 3.
- Confirm the plan delivers the refined PRD in full and fits the holistic architecture.
- **Sign off** — or send back with a specific list of what must be resolved first.

**Produces — Final Validation & Sign-off.** Verdict: signed off / blocked-pending-resolution.

---

## Output — `final-validation.md`
```markdown
# Final End-to-End Validation & Sign-off — <feature>
## Coverage check — every refined-PRD requirement → milestone(s) and the verifier(s) or test(s) that prove it, including post-merge verification
## Cross-milestone seams & integration points
## Missed edges & gaps
## Outstanding concerns, safety flags & unresolved open decisions
## Verdict — signed off / blocked (with required resolutions)
## Traceability — references across all prior artifacts
```
