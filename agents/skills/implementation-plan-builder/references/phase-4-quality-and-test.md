# Phase 4 — Quality & Test (per milestone)

**Goal:** for each milestone, define how its tasks will be proven done — the test strategy, coverage plan, and concrete unit and e2e tests.

**Per-milestone, single review pass.** Each milestone gets its own artifact:
```
phase-4-quality/
├── milestone-1/  test-plan.md
├── milestone-2/  ...
```
Milestones are independent here — run them in parallel.

**Read `references/loop-process.md` for the traceability and integrity rules.** The three-loop mechanics don't apply.

**Input packet (per milestone):** the milestone's final eng spec (Phase 3, post-G2) including its tasks and acceptance criteria, the milestone definition (Phase 2), the holistic architecture (Phase 1), + codebase.

---

## Single Pass — Test Architect

*In an engineers-own-quality org, a test-minded Staff Engineer fills this seat.*

**Mandate:** define how quality will be assured for this milestone, using the repo's existing test infrastructure.

**Do:**
- **Test strategy** — what is verified at which level, and why. Use only the test levels the repo already runs.
- **Coverage plan** — map every task's acceptance criteria to the test(s) that prove it, weighted toward the highest blast-radius / data-sensitivity paths.
- **Concrete unit and e2e tests** — grounded in the codebase's actual frameworks, fixtures, and CI.
- Don't add tests no acceptance criterion needs.
- Flag coverage gaps and accepted risks.

---

## Output — `milestone-N/test-plan.md`
```markdown
# Test Plan — Milestone N: <name>
## Test strategy (levels & what each covers)
## Coverage plan (task → acceptance criteria → test; risk-weighted)
## Unit tests (what, where, against which behavior)
## E2E tests (flows, scenarios, data / environments)
## CI integration & flakiness considerations
## Coverage gaps & accepted risks
## Traceability — eng-spec / codebase references
```
