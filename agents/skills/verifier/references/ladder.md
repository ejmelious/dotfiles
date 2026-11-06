# The Verifier Ladder

The ladder runs from fast and cheap at the top to slow and thorough at the bottom. Fast rungs run on every edit; slow rungs run in CI, nightly, or during rollout. A healthy repo has a known command (or dashboard) for each rung it needs, and knows which it doesn't.

| # | Rung | Catches | Example | Common tools | Runs |
|---|------|---------|---------|--------------|------|
| 1 | **Types, lint, architecture rules** | type errors, banned patterns, new coupling across a boundary | a lint rule that blocks direct datastore access from outside a domain's API, naming the API to use | `tsc`, custom ESLint rules, dependency-cruiser, Semgrep | local, hook, CI |
| 2 | **Unit and property tests** | logic errors, missed edge cases | a property that stale, erroneous, or incomplete input never produces a pass | Vitest, Jest, pytest, fast-check, Hypothesis | local, hook, CI |
| 3 | **Golden datasets and snapshots** | unintended changes in output | approved fixtures and expected results per scenario; old vs new implementation output | fixture diffs, snapshot tests | local, CI |
| 4 | **Contract tests** | drift between services, or with a third-party API | consumer contracts for an internal API; recorded payloads from a vendor | Pact, recorded fixtures + schema validation | local, CI |
| 5 | **End-to-end and browser checks** | features that pass unit tests but fail for users | an agent drives the page in a preview environment and attaches screenshots | Playwright, Cypress, browser via MCP | CI, preview env |
| 6 | **Differential (shadow) runs** | behavior changes on real data | old and new paths run side by side on sampled tenants, results compared before cutover | Scientist-style dual runs | staging, prod (read-only) |
| 7 | **Load and SLO checks** | latency and throughput regressions | load at large-customer scale before a limit is raised | k6, Gatling, SLO monitors | CI (scheduled), pre-release |
| 8 | **Mutation testing** | tests that pass but assert nothing | a weekly run on the core evaluation package | Stryker, mutmut | nightly / weekly |
| 9 | **LLM judges and agent evals** | spec conformance, AI feature quality | evals built from 20–50 real tasks; a reviewer subagent judging a diff against its spec | rubric graders, eval harnesses, reviewer subagents | local, CI |
| 10 | **Canaries and synthetic monitoring** | breakage in a live environment, as an early warning | scheduled requests exercising key endpoints, alerting on failure | Datadog Synthetics, scheduled Playwright | continuous, prod |
| 11 | **Production rollout** | errors that only appear at production data shape or scale | staged rollout by region with metric comparison; one region's traffic pattern exposes what others don't | rollout tooling, feature flags, Datadog | during rollout |

## Choosing a rung

- **Push left, but honestly.** Ask of each rung from the top: *could this rung have seen the failure, given the inputs it has?* Stop at the first yes. A lint rule can see a banned import; it can't see a 3× traffic increase.
- **Catch the class, keep the instance.** Prefer a rule or property that catches the whole class of bug (every caller of the paginator, every input that's empty) over a test of the single input that failed — and still add the failing input as a regression case.
- **Prevent and detect are different questions.** Prevention rungs (1–9) stop the change before it ships. Detection rungs (6, 7, 10, 11, plus alerting) shorten the time from "shipped" to "known". An incident usually needs an answer to both.
- **Deterministic first.** Use an LLM judge only where no deterministic check can express the property (spec conformance, output quality), and pair it with a deterministic gate on high-risk paths.
- **Cost is part of the answer.** A rung that takes an hour can't run on every edit. Say where each verifier runs and how long it takes, so it's clear whether the agent gets the signal in its loop or after merge.
