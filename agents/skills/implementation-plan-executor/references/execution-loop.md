# The Execution Loop

Every milestone runs through it: the worker's **per-task cycle** builds and verifies the work, then the orchestrator's **review gate** independently confirms the milestone is done before it's merged. Read the control spine (`verification-ledger-escalation.md`) first — it defines green, budgets, and the hard-stop.

## Per-task cycle (milestone worker)

For each task in the order the eng spec's task list defines:

1. **Read the task** — its description, **acceptance criteria** (eng spec), and the **test the test plan specifies** for it.

2. **Test-first (where a test is specified).** Write or extend that test *before* implementing, and run it to **watch it fail**. A test that passes before the code exists is testing nothing. Where the test plan didn't pre-specify a test, add one alongside the implementation.

3. **Implement** what the eng spec specifies — no more and no less. Honor its reuse-vs-net-new decisions and the architecture, and the error handling and edge cases it lists. Anything in its "Not doing" list is off-limits, even when it looks like an obvious improvement; so are the out-of-scope findings you were given. Scope explosion is an unrecoverable trigger, not a license to keep going.

   **Search before writing a helper.** Before adding a function that parses, normalizes or adapts a shape other code also handles (an error envelope, an ID format, a date, a response body), search for an existing one. Search by the shape's most distinctive access, not by a name you'd choose: `rg -n "networkError.result" packages/`, not `rg parseError`. Check shared packages first, then sibling packages. When you find one, reuse it if it fits. If it almost fits, record in the ledger why it doesn't, and note it as a follow-up candidate. Write a near-duplicate only when the eng spec calls it net-new.

   **Non-blocking open decisions** (in the eng spec or the manifest): don't stop. Take the option the plan recommends; if it names none, take the one most consistent with the holistic architecture. Record the choice and why in your milestone ledger.

4. **Verify (inner loop)** — the task's targeted tests plus typecheck/lint. The previously-failing test should now pass.

5. **Self-correct on failure** — within the per-task budget, each attempt a *different* hypothesis. Same failure signature twice → stop (non-progress). Budget exhausted → return `halted` with the evidence.

6. **Confirm acceptance criteria** — explicitly check each one is met. Tests passing and criteria met are both required.

7. **Commit** per the eng spec's commit plan, staging files by explicit path. Commit locally — never push. Keep each planned PR's commits contiguous and in plan order, so every PR is a clean range on the branch, and record each PR's last commit in the ledger.

8. **Update the milestone ledger** — task status, commit(s), criteria satisfied, tests covering it.

After the last task, confirm each of the milestone's **exit criteria** (milestone plan) is met — task-level criteria passing doesn't guarantee it. Then run the full suite in the workspace and return `ready_for_gate`.

**Verifier tasks** (from the test plan's "Verifiers to build", or a whole `kind: verifier` milestone) use the `verifier` skill's embedded **build** mode: make the bad case first, then show the verifier fails on it for the right reason and passes on correct code. Record both runs in the milestone ledger. A verifier is proven before any task it guards starts — the guarded task's tests then run with it.

**Spike milestones** answer questions rather than ship behavior. Write the answers, with evidence, to `.execution/milestone-<N>/spike-findings.md`. Commit only code the eng spec says ships; throwaway exploration stays off the branch.

**TypeScript fix rules apply throughout** — not only when fixing review findings. Never make code compile or tests pass with `as any`, `as unknown as T`, a new non-null `!`, `@ts-ignore` / `@ts-expect-error`, `eslint-disable`, loosened tsconfig, or a weakened or deleted test or verifier — no lowered rule levels or thresholds, new skips, or golden or snapshot updates that aren't the intended behavior change. Validate data at trust boundaries instead of asserting its type.

## Review gate (orchestrator)

The gate replaces the human checkpoint, so it must be independent: reviewers are fresh subagents that see only the result, never the worker's reasoning. Fire both reviewers **in parallel**:

### Reviewer A — acceptance & architecture
Inputs: the milestone's exit criteria (milestone plan), the eng spec, task list, acceptance criteria, test plan, holistic architecture, the cross-milestone seams it touches, the milestone diff (`start_commit..branch head`), the milestone ledger, and the full-suite result. Ask it to actively try to falsify:
- **Every acceptance criterion** for every task is met — actually, not approximately — and so is every **exit criterion** of the milestone.
- **Scope** — nothing from the eng spec's "Not doing" list was built, and nothing beyond the spec was added. The error handling and edge cases the spec lists are implemented and tested.
- **Seams** — each cross-milestone seam this milestone touches matches the other side: the merged code, or the other milestone's eng spec if it isn't built yet.
- **Open-decision choices** recorded in the ledger are consistent with the plan and the architecture.
- **Spikes:** the findings answer every question the spike was for, with evidence.
- The **full suite is green** (no new failures beyond the baseline set).
- **Architecture conformance** — no drift from the holistic architecture; reuse honored; net-new introduced cleanly.
- **No regressions** — the milestone's changes are self-consistent and nothing earlier broke.
- **Tests are real** — they assert the behavior, not tautologies.
- **Partial failure after a side effect** — where code does more work after a write, charge or send has happened, each dependency of that later work has a test failing it on its own. A `.catch` on only some of them is a defect: the caller would report a saved write as failed.
- **Duplication** — no new helper repeats one the repo already has. Search by the distinctive access the new code makes, and name the existing helper in the finding.
- **Verifiers** — every **pre-merge** verifier the test plan maps to this milestone ran and passed; each new verifier has its red and green proof in the ledger; no existing verifier was weakened. **Post-merge** entries (shadow, load, canary, rollout) can't run yet: check only that each has a verification plan stating the evidence it should produce. They go to the PR notes in Stage 2, and their absence of results is not a defect.
- **Escapes** — if it finds a defect the verifiers all passed, it says so. The orchestrator runs the `verifier` skill's **escape-note** on it and appends the result to `.execution/milestone-<N>/verifier-escapes.md`. The run doesn't build these; they go to the final report.

It writes `.execution/milestone-<N>/gate-review.md` and returns `pass`, `fix` (with specific defects), or `escalate` (a problem that isn't a local fix: drift, scope, design).

### Reviewer B — TypeScript (when the diff touches `.ts`, `.tsx`, `.mts`, `.cts`)
Run the `typescript-review` skill in **embedded, report-only mode** (see that skill's "Embedded mode" section). Give it: the workspace path, the commit range `start_commit..branch head`, the report path `.execution/milestone-<N>/typescript-review.md` (absolute, main checkout), and the full-suite result so it doesn't re-run the checks. It makes no edits and no commits.

Its findings map to the gate like this:

| Finding | Gate effect |
|---------|-------------|
| 🔴 Critical or 🟠 High, fixable by the worker | `fix` — goes to the worker |
| 🔴 Critical marked "needs engineer" (public API used outside the repo, product decision, new dependency) | `escalate` |
| 🟠 High marked "needs engineer" | doesn't block; carried to the final report's follow-ups |
| 🟡 Medium / ⚪ Low | doesn't block; counted in the final report |

### Combining the verdicts
- Both `pass` (B's only findings non-blocking) → **Pass**: merge per Stage 1.
- Either `escalate` → **Escalate**: unrecoverable → hard-stop per the control spine.
- Otherwise → **Fix**: send the worker one combined, numbered list of defects (A's and B's, with B's IDs like `TS-03`). The worker fixes them with the per-task cycle — test-first where the finding has a runtime failure scenario; a type-only fix is proven with typecheck — commits each fix with the finding ID in the body, re-runs the full suite, and returns `ready_for_gate`. Then re-review: A re-checks the cited defects plus the new diff; B re-checks only its cited findings against the new commits. Bounded by the gate budget.

Only a clean **Pass** lets a milestone merge. There is no "merge with known blocking issues" path.
