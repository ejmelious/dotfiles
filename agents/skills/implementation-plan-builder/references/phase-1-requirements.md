# Phase 1 — Requirements Consumption & Breakdown

**Goal:** turn the raw PRD + codebase into three defensible artifacts: a **Refined PRD**, a **System Impact Analysis**, and a **Holistic Architecture Plan** — the overarching system architecture every milestone is later validated against.

**Read `references/loop-process.md` first** — this file only defines Phase 1's personas, their inputs/outputs, and the output templates. The mechanics (independence, synthesis, conflict handling, traceability) live there.

**Input packet:** the raw PRD + the codebase. (No prior-phase artifacts — this is the first phase.) Loops 2 and 3 also receive the prior loop's output.

---

## Loop 1 — Staff Product Manager (Author)

**Mandate:** review the PRD as a staff PM would, examining the requirements *against what actually exists in the codebase*.

**Do:**
- Verify the requirements make sense and are internally consistent.
- Hunt for unaddressed edge cases, ambiguous acceptance criteria, and missing non-functional requirements (auth, permissions, data sensitivity, scale, audit, error states).
- Assess whether each request fits well with the existing product and the solution it implies — flag requirements that fight the grain of the system.
- Make concrete recommendations for improvement: clarify, split, re-scope, sequence, or cut.

**Produces — the Refined PRD (first draft):** the original requirements, restructured and sharpened, with edge cases surfaced, acceptance criteria tightened, ambiguities resolved or flagged, and a recommendations section. Save reasoning to `.loops/loop-1-staff-pm.md` and the draft artifact to `refined-prd.md`.

---

## Loop 2 — Senior Engineer (Ground)

**Mandate:** assess the refined PRD as the Sr. engineer who will implement the system *as a whole*. Build a strong, concrete understanding of the impact these requirements have on the system.

**Do:**
- Do a real codebase-impact assessment — read the relevant code, don't theorize.
- Identify where existing components can be leveraged (name them: file, module, class, route).
- Identify where new classes, components, routes, paths, services, or data are genuinely needed — and why existing ones won't do.
- Map blast radius: which surfaces, data flows, and contracts the requirements touch.
- Critique the refined PRD wherever it's infeasible, underspecified for implementation, or naive about the system.

**Produces — the System Impact Analysis (first draft):** a high-level overview of the system impact and how the requirements can be implemented into the system — reuse vs. net-new, touched surfaces, data/contract changes, risks. Plus a critique of the refined PRD. Save to `.loops/loop-2-sr-engineer.md` and `system-impact-analysis.md`. Feed accepted PRD critiques back into `refined-prd.md` at synthesis.

---

## Loop 3 — Architect (Pressure-test)

**Mandate:** review the requirements *and* the Sr. engineer's system impact analysis from an architect's perspective. Assess the whole system and pressure-test both.

**Do:**
- Judge the design end to end: properly designed, or not? Do we make **surgical modifications**, or must we introduce **brand-new components and surface area**? Justify the call.
- Pressure-test both the requirements (Loop 1) and the system impact analysis (Loop 2) — audit Loop 2's grounding for gaps, anchoring, or convenient assumptions.
- Think holistically: does this meet best-in-class standards for a well-architected system — including **DRY**? Where is duplication being introduced, and can it be avoided?
- **Safety sanity check (lightweight, not a deep security review):** scan the architecture for blatant unsafe practices — e.g. obvious data exposure, missing auth/permission boundaries, secrets handled in the clear. Flag them; don't conduct a formal threat model.
- Decide the holistic architecture: components and their responsibilities, boundaries and contracts, what's reused vs. introduced, key tradeoffs, and the decisions left open.

**Produces — the Holistic Architecture Plan (first draft):** the system architecture for the feature — components and responsibilities, boundaries/contracts, reuse-vs-net-new decisions with justification, DRY assessment, a safety sanity-check note, key tradeoffs, and open decisions. Plus a verdict (ship / revise / escalate) on Phase 1 as a whole. This is the **overarching architecture** every milestone's Phase 3 review validates against. Save to `.loops/loop-3-architect.md` and `holistic-architecture.md`.

---

## Synthesis — Phase 1 outputs

Fold the loops together into three clean final artifacts. Name any unresolved tension (e.g. PM intent vs. engineering feasibility, or surgical vs. net-new) as an open decision rather than resolving it silently. Update `00-index.md`.

### `refined-prd.md`
```markdown
# Refined PRD — <feature>
## Summary
## Requirements (refined)
  - <requirement> — acceptance criteria, edge cases, non-functionals
## Open questions & flagged ambiguities
## PM recommendations (clarify / split / re-scope / sequence / cut)
## Traceability — source PRD section per requirement
```

### `system-impact-analysis.md`
```markdown
# System Impact Analysis — <feature>
## Implementation overview — how the requirements land in the system
## Reuse — existing components to leverage (file / module / symbol)
## Net-new — components/routes/services to introduce + justification
## Blast radius — surfaces, data flows, contracts touched
## Risks & unknowns
## Traceability — codebase references (path + symbol)
```

### `holistic-architecture.md`
```markdown
# Holistic Architecture Plan — <feature>
## Approach — surgical modification vs. new surface area (with justification)
## Components & responsibilities
## Boundaries & contracts
## DRY assessment — duplication risks and how they're avoided
## Safety sanity check — blatant unsafe practices flagged (lightweight)
## Key tradeoffs
## Open decisions (for the human)
## Verdict
```
