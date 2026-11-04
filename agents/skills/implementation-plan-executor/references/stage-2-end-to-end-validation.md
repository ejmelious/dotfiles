# Stage 2 — End-to-End Validation (once)

Reached only when every milestone is `done`. This is the executor's final proof that the whole plan is implemented and coherent — the mirror of the planning skill's Phase 6.

## 1. Full-suite green
Run the complete toolchain one final time on the integrated result. The invariant holds: no new failures beyond the recorded baseline set. If anything is red here, it's a regression that slipped through — treat as unrecoverable and hard-stop with an escalation report rather than declaring success on red.

## 2. Traceability
Build the requirement → milestone → task → commit → test matrix across the whole plan. Every refined-PRD requirement must trace to the task(s) that implemented it, the commit(s) that landed it, and the test(s) that cover it. A requirement with no covering test or no implementing commit is a gap — surface it, don't paper over it.

## 3. Whole-system conformance
Check the integrated implementation against the holistic architecture as a whole — not milestone by milestone. Look for drift that accumulated across milestones, boundaries that eroded, or duplication that crept in between independently-built milestones.

## 4. Final report
Write the implementation report (format in the control spine): summary, the traceability matrix, architecture conformance, any carried baseline failures, what's ready to push/PR (not done automatically), and follow-ups. Set the ledger `run_status: complete`.

Then hand back to the human with the report. The branch holds the work, committed but unpushed, ready for their review.
