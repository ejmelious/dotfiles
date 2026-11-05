# Stage 0 — Ground & Baseline (once)

Establish solid ground before any code is touched. Most autonomous-execution failures trace back to skipping this. Read the control spine first.

## 1. Select and verify the plan
Per the SKILL's input rules: find the plan folder(s) under `.ai-dev/implementation-plan/`. If there are several, ask which `<feature-slug>` to run; if none, stop and point the user to `implementation-plan-builder`. Read `.ai-dev/implementation-plan/manifest.yaml` (the builder keeps one shared manifest, a single entry or a `features:` list) and take the entry whose `folder` matches the selected slug. **Refuse to proceed** unless that entry is present, `signed_off: true`, `status: complete`, no blocking `open_decisions` (an entry without `blocking: false` counts as blocking), and `target_repo` matches this repo. Confirm the run-summary back to the user (feature, milestones, branch, sign-off date) before going autonomous.

Then load the plan artifacts from the selected `.ai-dev/implementation-plan/<feature-slug>/` folder: refined PRD, holistic architecture, milestone plan, and per-milestone eng specs and test plans. Read the whole plan before starting, not just milestone 1 — you need the holistic architecture and the manifest's dependency-ordered milestone list to execute safely.

## 2. Ground in the codebase
Explore the actual repository — entry points, the modules the plan references, existing patterns, test layout. Read the code; don't infer it from the plan. The plan tells you the intent; the repo tells you the reality you're editing.

## 3. Reconcile plan vs. current code
For each thing the plan assumes (files, symbols, routes, contracts it says it will touch or reuse), confirm it still exists and still looks as the plan expects.
- **Minor drift** (a renamed file, a moved symbol, a slightly changed signature) → note it in the ledger and adapt as you go.
- **Major drift** (the plan's premises no longer hold — the component it builds on was removed, the contract it extends was redesigned) → there is no human to re-plan mid-run → **hard-stop and escalate** now, before writing code against a false premise.

## 4. Discover the verification toolchain
Determine the real commands for build, typecheck, lint, and test from the repo itself — `package.json` scripts, CI config, Makefile, etc. Do not assume command names. If no usable test/verification setup can be established, that's an unrecoverable wall (you can't self-validate without it) → hard-stop and escalate.

## 5. Establish the baseline
Run the full toolchain.
- Fully green → that's the baseline.
- Not green → record the **exact set of pre-existing failures** as the baseline set (per the control spine). The invariant becomes "no new failures beyond this set." Note the carried failures so they appear in the final report.

Record `baseline_commit`.

## 6. Branch and initialize the ledger
Create the dedicated working branch. Initialize `.ai-dev/implementation-plan/<feature-slug>/.execution/ledger.md` with the baseline commit, baseline failure set, branch, the milestone list **from the manifest** (in dependency order, all `pending`), and `run_status: running`. Set `last_green_commit` to the baseline.

On completion of Stage 0, proceed to Stage 1.
