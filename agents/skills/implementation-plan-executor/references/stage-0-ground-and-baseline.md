# Stage 0 — Ground & Baseline (once)

Establish solid ground before any code is touched. Read the control spine first. The orchestrator runs this stage, but delegates code reading to drift checkers so its own context stays small.

## 1. Select and verify the plan
Per the SKILL's input rules: find the plan folder(s) under `.ai-dev/implementation-plan/`, select the `<feature-slug>`, read its manifest entry, and **refuse to proceed** unless it is present, `signed_off: true`, `status: complete`, has no blocking `open_decisions`, and `target_repo` matches this repo.

Read the refined PRD, holistic architecture, milestone plan, and the manifest's milestone list (`depends_on`, `touches`, `size`). Don't read every eng spec in full here — the drift checkers and workers do that.

## 2. Discover the verification toolchain
Determine the real commands for install, build, typecheck, lint, and test from the repo — `package.json` scripts, CI config, Makefile. Don't assume command names. If no usable test setup can be established → unrecoverable → hard-stop and escalate.

## 3. Can the test suite run concurrently?
Parallel worktrees each run the suite. Check the test setup for shared resources: a fixed database or schema (docker-compose services, a shared `DATABASE_URL`), fixed ports, global setup that writes to a fixed path, or an external service with shared state.
- Nothing shared → `concurrent_tests: true`.
- Anything shared, or you can't tell → `concurrent_tests: false`. Workers may still implement in parallel, but full-suite runs take turns (see Stage 1).

## 4. Establish the baseline
Run the full toolchain in the main checkout.
- Fully green → that's the baseline.
- Not green → record the **exact set of pre-existing failures** as the baseline set. The invariant becomes "no new failures beyond this set."

Record `baseline_commit`.

## 5. Parallel drift checks
Fire one **read-only drift checker per milestone, in parallel** (Explore agents in Claude Code). Each gets the absolute path to its milestone's eng spec and checks that the files, symbols, routes, and contracts the spec says it will touch or reuse still exist and look as expected. It returns a short list: each drift item, `minor` or `major`, with file + symbol.

- Any **major** drift (a premise no longer holds — the component it builds on was removed, the contract it extends was redesigned) → hard-stop and escalate now, before any code is written.
- **Minor** drift → recorded in that milestone's ledger for its worker to adapt to.

Drift checks see today's code, not the code earlier milestones will write. Give each checker the eng specs of the milestones it `depends_on`: anything those specs say they create is **not** drift, even though it doesn't exist yet. Workers re-check everything at pre-flight, against the merged code.

## 6. Compute the execution layers
From the manifest's `depends_on`, group milestones into layers (layer 1 = no dependencies; layer N depends only on layers < N). Within a layer, split milestones that can't safely run side by side into separate sequential batches:
- their `touches` lists overlap (other than files that only get entries appended, like a route or export index — these merge cleanly);
- more than one adds a database migration, changes dependencies / the lockfile, or changes a code-generation input (GraphQL/OpenAPI schema, Prisma schema).

If a milestone has no `touches` (older plans), derive it from its eng spec's Changes and Traceability sections; if you can't, run it in a batch of its own.

Cap each batch at **3** parallel workers by default.

## 7. Branch and initialize the ledgers
Create the integration branch `<feature-slug>` from `baseline_commit`. Initialize `.ai-dev/implementation-plan/<feature-slug>/.execution/ledger.md` (main ledger) and one `.execution/milestone-<N>/ledger.md` per milestone, per the control spine. Set `last_green_commit` to the baseline.

On completion of Stage 0, proceed to Stage 1.
