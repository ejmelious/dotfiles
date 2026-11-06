# Phase 4 — Verification & Test (per milestone)

**Goal:** for each milestone, define how its tasks will be proven done — which verifiers prove each criterion, which must be built, what can only be verified after merge, and the concrete tests.

**Per-milestone, single review pass.** Each milestone gets its own artifact:
```
phase-4-quality/
├── milestone-1/  test-plan.md
├── milestone-2/  ...
```
Milestones are independent here — run them in parallel.

**Read `references/loop-process.md` for the traceability and integrity rules.** The three-loop mechanics don't apply.

**Input packet (per milestone):** the milestone's final eng spec (Phase 3, post-G2) including its tasks and acceptance criteria, the milestone definition (Phase 2), the holistic architecture and `verifier-audit.md` (Phase 1), + codebase.

---

## Single Pass — Test Architect

*In an engineers-own-quality org, a test-minded Staff Engineer fills this seat.*

**Mandate:** define how quality will be assured for this milestone, using the repo's existing test infrastructure.

**Do:**
- **Verifier map** — run the `verifier` skill in embedded **map** mode with this milestone's acceptance and exit criteria and the failure modes its eng spec and the architecture name. For each criterion: the cheapest ladder rung that proves it, and the existing verifier or `missing`. Each missing one is classed:
  - `build-now` — add it to the eng spec's task list as a verifier task, ordered before the tasks it guards;
  - `post-merge` — a rung that only exists after merge (shadow, load, canary, rollout): state the evidence it should produce, so the PR carries a verification plan;
  - `out-of-scope` — with the reason.
  Every verifier to build names the failure mode it catches; one that can't is cut.
- **Test strategy** — what is verified at which level, and why. Use the levels the repo already runs, plus the verifiers this milestone builds.
- **Coverage plan** — map every task's acceptance criteria to the test(s) that prove it, weighted toward the highest blast-radius / data-sensitivity paths.
- **Concrete unit and e2e tests** — grounded in the codebase's actual frameworks, fixtures, and CI.
- Don't add tests no acceptance criterion needs.
- Flag coverage gaps and accepted risks.

---

## Output — `milestone-N/test-plan.md`
```markdown
# Test Plan — Milestone N: <name>
## Verifier map (criterion → rung → existing verifier / build-now / post-merge / out-of-scope)
## Verifiers to build (each: failure mode, rung, command, where it runs, bad case that proves it)
## Post-merge verification (shadow / load / canary / rollout — the evidence each should produce)
## Test strategy (levels & what each covers)
## Coverage plan (task → acceptance criteria → test; risk-weighted)
## Unit tests (what, where, against which behavior)
## E2E tests (flows, scenarios, data / environments)
## CI integration & flakiness considerations
## Coverage gaps & accepted risks
## Traceability — eng-spec / codebase references
```
