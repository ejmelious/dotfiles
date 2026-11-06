# Stage 2 — End-to-End Validation (once)

Reached only when every milestone is `done` and merged into the integration branch. This is the executor's final proof that the whole plan is implemented and coherent — the mirror of the planning skill's Phase 5.

## 1. Full-suite green
Run the complete toolchain on the integration branch. The invariant holds: no new failures beyond the baseline set. If anything is red, it's a regression that slipped through → unrecoverable → hard-stop with an escalation report.

## 2. Traceability and whole-system conformance (fresh subagent)
Hand this to one fresh reviewer so the orchestrator doesn't load every diff. Give it the refined PRD, holistic architecture, every milestone's eng spec and milestone ledger, and the full diff `baseline_commit..integration head`. It produces:
- **Traceability:** the requirement → milestone → task → commit → test matrix. A requirement with no implementing commit or no covering test is a gap — surface it.
- **Conformance:** the integrated result against the holistic architecture as a whole — drift that accumulated across milestones, boundaries that eroded, duplication between milestones that were built in parallel without seeing each other.

A gap or drift that means the PRD isn't delivered → hard-stop with an escalation report rather than declaring success.

## 3. Final report
Write the implementation report (format in the control spine), including the TypeScript review section aggregated from each milestone's `typescript-review.md`. Set the main ledger `run_status: complete`.

Then hand back to the human with the report. The integration branch holds the work, committed but unpushed, ready for their review.
