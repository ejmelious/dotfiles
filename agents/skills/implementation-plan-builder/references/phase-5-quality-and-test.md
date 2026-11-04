# Phase 5 — Quality & Test (per milestone)

> **STATUS: VALIDATED — per your spec.** Truncated to a single quality review — not the full three loops.

**Goal:** for each milestone, produce a quality review of the plans — architect the test strategy, define the coverage plan, and build out how the milestone will be covered with unit and e2e tests.

**Per-milestone, single review:** Phase 5 runs **one quality review pass per milestone**. Each milestone gets its own artifact:
```
phase-5-quality/
├── milestone-1/  test-plan.md
├── milestone-2/  ...
```

**Read `references/loop-process.md` for the traceability and integrity rules.** The three-loop mechanics do not apply here — this is a single pass.

**Input packet (per milestone):** the milestone's eng spec (Phase 3) and execution plan (Phase 4), the milestone definition (Phase 2), the holistic architecture (Phase 1), + codebase.

---

## Single Loop — Test Architect (Quality Review)
*In an engineers-own-quality org, a test-minded Staff Engineer fills this seat.*

**Mandate:** review the milestone's plans and define how quality will be assured.

**Do:**
- **Architect the test strategy** for the milestone — what is verified, at which level, and why.
- **Define the coverage plan** — what must be covered, mapped to the milestone's stories/tasks and acceptance criteria, weighted toward the highest blast-radius / data-sensitivity paths.
- **Build out unit and e2e coverage** — the concrete unit tests and end-to-end tests that will cover the milestone, grounded in the codebase's actual test infrastructure (frameworks, fixtures, CI).
- Flag coverage gaps and accepted risks.

**Produces — the milestone Test Plan.**

---

## Output — `milestone-N/test-plan.md`
```markdown
# Test Plan — Milestone N: <name>
## Test strategy (levels & what each covers)
## Coverage plan (mapped to stories/tasks & acceptance criteria; risk-weighted)
## Unit tests (what, where, against which behavior)
## E2E tests (flows, scenarios, data / environments)
## CI integration & flakiness considerations
## Coverage gaps & accepted risks
## Traceability — eng-spec / execution-plan / codebase references
```
