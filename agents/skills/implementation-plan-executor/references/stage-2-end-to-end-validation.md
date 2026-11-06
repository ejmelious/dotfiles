# Stage 2 — End-to-End Validation (once)

Reached only when every milestone is `done` and merged into the integration branch. This is the executor's final proof that the whole plan is implemented and coherent — the mirror of the planning skill's Phase 5.

## 1. Full-suite green
Run the complete toolchain on the integration branch. The invariant holds: no new failures beyond the baseline set. If anything is red, it's a regression that slipped through → unrecoverable → hard-stop with an escalation report.

## 2. Traceability and whole-system conformance (fresh subagent)
Hand this to one fresh reviewer so the orchestrator doesn't load every diff. Give it the refined PRD, holistic architecture, the Phase 5 final validation, every milestone's eng spec and milestone ledger, and the full diff `baseline_commit..integration head`. It produces:
- **Traceability, planned vs actual:** start from Phase 5's coverage check (requirement → milestone → test) and fill in the task, commit, and passing test that actually delivered each row. A planned row with no implementing commit or no passing test is a gap; so is built behavior no requirement traces to.
- **Conformance:** the integrated result against the holistic architecture as a whole — each cross-milestone seam Phase 5 listed holds in the integrated code; no drift accumulated across milestones, no boundaries eroded, no duplication between milestones that were built in parallel without seeing each other.

A gap or drift that means the PRD isn't delivered → hard-stop with an escalation report rather than declaring success.

## 3. Prepare the PR stack (local branches only)
Turn the eng specs' commit plans into branches the human can push as stacked PRs. The stack is **linear, in the order milestones merged** into the integration branch: that's the only order in which every PR's base contains everything beneath it, so milestones built in parallel land one after the other.

1. List the planned PRs in landing order — milestones by merge order, and within a milestone the commit plan's order. Name them `<feature-slug>-pr<K>`. A commit plan that doesn't group into PRs (older plans) makes the milestone one PR.
2. Build each branch on the previous one (the first on `baseline_commit`) by cherry-picking that PR's commits from its milestone branch, using the ranges in the milestone ledger and skipping merge commits.
3. **Verify.** At each milestone's last PR, the tree must equal that milestone's merge commit on the integration branch (`git diff --quiet <pr-branch> <merge-commit>`). For a PR that ends mid-milestone, run the full toolchain; it should be green on its own. If it's red, fold it into the milestone's next PR and note why.
4. **Fallback.** If a cherry-pick conflicts or a tree doesn't match (usually merge rework moved code between milestones), discard the cherry-picked branches and build the stack as **one PR per milestone**, each branch at that milestone's merge commit on the integration branch. That's always exact, because each is a step of the already-verified integration history. Say in the report that the fallback was used and why.

Record the stack in the main ledger.

## 4. Final report
Write the implementation report (format in the control spine), including:
- the TypeScript review section, aggregated from each milestone's `typescript-review.md`;
- the PR stack;
- every non-blocking open decision the workers settled, with the choice and why;
- the carried-forward risks: test plans' coverage gaps and accepted risks, Phase 5's outstanding concerns and safety flags, and `out_of_scope_findings`, which were left untouched.

Set the main ledger `run_status: complete`.

Then hand back to the human with the report. The PR stack holds the work, committed but unpushed, ready for their review.
