# The Execution Loop

The reusable heart of the executor. Every milestone runs through it: a **per-task cycle** to build and verify the work, then a **per-milestone review gate** to independently confirm the milestone is genuinely done before advancing. Read the control spine (`verification-ledger-escalation.md`) first — it defines green, budgets, and the hard-stop this loop relies on.

## Per-task cycle

For each story/task in the milestone, in the order the execution plan defines:

1. **Read the task** — its description, **acceptance criteria** (Phase 4), and the **test the Phase 5 plan specified** for it.

2. **Test-first (where a test is specified).** Write or extend that test *before* implementing, and run it to **watch it fail**. This proves the test actually exercises the new behavior — a test that passes before you've written the code is testing nothing. Where Phase 5 didn't pre-specify a test, implement and add the test alongside. Test-first is the load-bearing signal that makes "done" un-fudgeable with no human watching.

3. **Implement** per the milestone's eng spec — honor the reuse-vs-net-new decisions and the architecture. Make the smallest change that satisfies the task; resist scope creep (scope explosion is an unrecoverable trigger, not a license to keep going).

4. **Verify (inner loop)** — run the task's targeted tests plus typecheck/lint. The previously-failing test should now pass.

5. **Self-correct on failure** — within the per-task budget, each attempt a *different* hypothesis. On the same failure signature twice, stop (non-progress). If budget is exhausted without green → unrecoverable → hard-stop per the control spine.

6. **Confirm acceptance criteria** — explicitly check each of the task's acceptance criteria is met. Tests passing and criteria met are both required; neither alone is "done."

7. **Commit** per the milestone's PR strategy (Phase 4). Commit locally — do not push.

8. **Update the ledger** — task status, commit(s), criteria satisfied, tests covering it.

The inner loop stays tight: small change, fast targeted verification, commit, record. Breadth comes from repeating it, not from batching many tasks before verifying.

## Per-milestone review gate

After all of a milestone's tasks are done, an **independent reviewer** decides whether the milestone may advance. This is the gate that replaced the human checkpoint, so it must be genuinely independent.

**Run it as a fresh-context subagent.** Independence is the whole point — the implementer that wrote the code will rationalize it; a reviewer that only sees the result will not. Give the subagent:
- the milestone's eng spec, task list, and acceptance criteria,
- the milestone's test plan,
- the **diff** for the milestone (baseline-of-milestone → current),
- the **full-suite** verification results,
- the holistic architecture.

Ask it to independently confirm — and actively try to falsify:
- **Every acceptance criterion** for every task is met (not approximately — actually).
- The **full suite is green** (no new failures beyond the baseline set).
- **Architecture conformance** — no drift from the holistic architecture, reuse honored, net-new introduced cleanly and DRY.
- **No regressions** — nothing earlier broke; the milestone's changes are self-consistent.
- Tests are real — they assert the behavior, not tautologies that always pass.

**Verdict:**
- **Pass** → mark the milestone `done`, set `last_green_commit`, advance to the next milestone automatically.
- **Fix** → the reviewer returns specific, concrete defects. The implementer self-corrects (re-entering the per-task cycle for the affected tasks), then the gate **re-reviews**. Bounded by the per-milestone gate budget.
- **Escalate** → gate budget exhausted, or the reviewer finds a problem that isn't a local fix (drift, scope, design). → unrecoverable → hard-stop per the control spine.

Only a clean **Pass** advances the run. There is no "advance with known issues" path — that's exactly the compounding failure mode autonomy is most exposed to.
