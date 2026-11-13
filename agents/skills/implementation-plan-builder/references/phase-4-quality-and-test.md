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
  - `build-now` — add it to the eng spec's task list as a verifier task, ordered before the tasks it guards. Phase 3 has already settled the rest of the spec, so keep it consistent: put the task in the commit plan (in the PR with the task it guards, or its own PR just before), add its files to the Changes and Traceability sections, and add them to the milestone's `touches` in the manifest. The executor schedules parallel work from `touches`, so a missing file there can put two milestones on the same file at once;
  - `post-merge` — a rung that only exists after merge (shadow, load, canary, rollout): state the evidence it should produce, so the PR carries a verification plan;
  - `out-of-scope` — with the reason.
  Every verifier to build names the failure mode it catches; one that can't is cut.
- **Test strategy** — what is verified at which level, and why. Use the levels the repo already runs, plus the verifiers this milestone builds.
- **Coverage plan** — map every task's acceptance criteria to the test(s) that prove it, weighted toward the highest blast-radius / data-sensitivity paths.
- **Unit test design** — for the criteria the verifier map assigns to unit or property tests in TypeScript code, run the `typescript-unit-testing` skill in embedded **plan** mode with the tasks, those criteria and the eng spec. It returns, per test: a behaviour title and the criterion it proves, the cases (boundaries, error paths, transitions, properties), the double for each dependency and why, where expected values come from, and the **bugs to catch** — concrete mutations the test must fail on, which the executor probes literally and the gate checks. It also lists what deliberately gets no unit test. Paste it into the test plan's "Unit test design" section. The `verifier` skill decides *which* rung proves a criterion; `typescript-unit-testing` designs the tests on the unit rung.
- **Concrete e2e tests** — grounded in the codebase's actual frameworks, fixtures, and CI.
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
## Unit test design (per test: behaviour title → criterion, cases, doubles, oracle, bugs to catch; what gets no unit test)
## E2E tests (flows, scenarios, data / environments)
## CI integration & flakiness considerations
## Coverage gaps & accepted risks
## Traceability — eng-spec / codebase references
```
