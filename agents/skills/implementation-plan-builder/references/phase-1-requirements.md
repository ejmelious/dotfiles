# Phase 1 — Requirements & Architecture

**Goal:** turn the raw PRD + codebase into two defensible artifacts: a **Refined PRD** and a **Holistic Architecture Plan** — the overarching architecture every milestone is later validated against. Then run simplification gate **G1**.

**Read `references/loop-process.md` first** — this file only defines Phase 1's personas and output templates.

**Input packet:** the raw PRD + the codebase. Loops 2 and 3 also receive the prior loops' output.

---

## Loop 1 — Staff Product Manager (Author)

**Mandate:** review the PRD as a staff PM would, against what actually exists in the codebase, and sharpen it — including cutting.

**Do:**
- Verify the requirements are internally consistent and fit the existing product; flag requirements that fight the grain of the system.
- Tighten ambiguous acceptance criteria and surface edge cases the stated requirements actually hit.
- Recommend clarify / split / re-scope / sequence / **cut**. Cutting or narrowing is as valuable as clarifying.
- **Keep what the PRD asks for separate from what you'd add.** Add a non-functional (auth, permissions, audit, scale, error states) to a requirement only when the requirement is broken or unsafe without it. Everything else goes under "Proposed additions" with a one-line reason, not into the requirements.

**Produces — Refined PRD (first draft).** Save reasoning to `.loops/loop-1-staff-pm.md` and the draft to `refined-prd.md`.

---

## Loop 2 — Senior Engineer (Ground)

**Mandate:** assess the refined PRD as the engineer who will implement the system as a whole. Build a concrete understanding of its impact on the codebase.

**Do:**
- Do a real codebase-impact assessment — read the code, don't theorize.
- Identify existing components to leverage (file, module, symbol) — reuse is the default.
- Identify where something genuinely new is needed, and why the closest existing thing won't do.
- Map blast radius: surfaces, data flows, and contracts touched.
- Critique the refined PRD where it's infeasible, underspecified, or naive about the system.
- **Audit the verifiers** for the area the PRD touches: run the `verifier` skill in embedded **audit** mode, scoped to the blast radius, and save the result as `verifier-audit.md`. It tells the plan which rungs it can lean on (and their exact commands) and which are missing or can't actually run.

**Produces — System Impact Analysis + PRD critique**, both in `.loops/loop-2-sr-engineer.md`. The impact analysis is a working document for Loop 3, not a final artifact; its conclusions land in `holistic-architecture.md`.

---

## Loop 3 — Architect (Pressure-test)

**Mandate:** pressure-test the refined PRD and Loop 2's impact analysis from an architect's perspective, and decide the holistic architecture.

**Do:**
- Decide: **surgical modification** or **new components and surface area**? Default to surgical; justify every new component against extending the closest existing one.
- Audit Loop 2's grounding for gaps, anchoring, or convenient assumptions.
- Identify duplication being introduced and how to avoid it.
- **Name what's over-built and what's under-built** — in the PRD's "Proposed additions" and Loop 2's proposed design: what has no concrete need behind it, and which needs (requirements, codebase constraints, failure modes) nothing yet serves.
- **Safety sanity check (lightweight, the only one in the pipeline):** flag blatant unsafe practices — obvious data exposure, missing auth/permission boundaries, secrets in the clear. Not a threat model.

**Produces — Holistic Architecture Plan (first draft)** + verdict on Phase 1. Save to `.loops/loop-3-architect.md` and `holistic-architecture.md`.

---

## Synthesis — Phase 1 outputs

Fold the loops into two clean final artifacts, applying the synthesis rules in `loop-process.md`. Name unresolved tensions as open decisions. Update `00-index.md`. Then run **G1** (`simplification-gate.md`) and apply its accepted cuts before Phase 2.

### `refined-prd.md`
```markdown
# Refined PRD — <feature>
## Summary
## Requirements (refined)
  - <requirement> — acceptance criteria, edge cases, non-functionals it needs to work safely
## Not doing — proposed additions not adopted, and cuts (with reason)
## Open questions & flagged ambiguities
## Traceability — source PRD section per requirement
```

### `holistic-architecture.md`
```markdown
# Holistic Architecture Plan — <feature>
## Approach — surgical modification vs. new surface area (with justification)
## Components & responsibilities (reused vs. new; each new one justified)
## Boundaries & contracts
## Blast radius — surfaces, data flows, contracts touched
## Safety sanity check — blatant unsafe practices flagged (lightweight)
## Key tradeoffs & risks
## Verification — the rungs this feature can rely on (from verifier-audit.md), and the gaps its risks make matter
## Not doing — designs considered and rejected as unnecessary
## Open decisions (for the human)
## Verdict
## Traceability — codebase references (path + symbol)
```
