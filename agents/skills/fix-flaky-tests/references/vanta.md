# Vanta investigation and helper map

Paths below are relative to the Obsidian checkout. Read current implementations and applicable AGENTS.md instructions; this map identifies places to look rather than freezing their APIs.

## Historical evidence

Read the Jira issue and comments through the connected Atlassian tools. Extract the test path, ownership, Datadog query, and exact historical window. Inspect `git log` for the quarantine commit and earlier attempted fixes. A sync PR may contain the latest error rather than the original trigger.

Use the available `pup` skill for Datadog. The useful commands are `pup cicd tests search` and `pup cicd tests aggregate`; inspect their help. Extract test/error/job/retry fields rather than printing complete events and commit messages. Aggregate event counts include retries and sometimes duplicate instrumentation events; count distinct job/pipeline IDs separately when needed.

Use linked job logs and Playwright traces to identify the failing operation. Datadog's generic timeout or truncated equality message may omit the actionable cause. Recorded fixtures and logs can contain credentials: inspect only the needed fields, report a suspicious value's location without reproducing it, and continue work that does not require it.

For current PR checks and review feedback, use `pr-diagnostics` when available. Follow its provider and log-handling guidance. A failed Buildkite check can cause GitHub's `pr-checks-passed` to fail too; those are not necessarily two independent failures. Verify live head SHA and PR-specific build metadata before attributing a result or taking an authorized retry action. A runner filesystem/dependency-install failure before static analysis is not evidence of a flaky application test.

## Backend and fetch-regression tests

Use available `backend-testing` guidance and `docs/backend/testing-best-practices.md`. Inspect the package's runner/config: mocha-compatible packages run built `dist` files, and a direct source-file filter may select nothing.

- `just unit-test <source-test-path>` builds the necessary scope before running it.
- For repeated invocations after a verified build, use the package's actual test script and path convention. Rebuild after restoring a mutation; a restored source file alone does not restore compiled code.
- `apps/resource-fetcher/src/fetch-regression.testutil.ts` owns recorded HTTP/BSON comparisons and persistence setup. Preserve those checks when fixing scheduling.
- Shared `useDB` and `useSandbox` utilities own cleanup; read their lifecycle before diagnosing a leak or introducing another lifecycle.
- Client pacing options can be a narrower control than global fake time. The adjacent Cloudflare wrapper tests override `CloudflareClient.MIN_TIME` through the sandbox. That is appropriate for recorded requests, not a default for tests of rate limiting, backoff, or expiry. Preserve reservoir/retry behavior needed by the scenario.
- A MongoDB multi-record query has no ordering guarantee without a sort. Compare full records and multiplicity when order is incidental. If order is the contract, retain an order-sensitive assertion and inspect the production sort/tie-breaker.

## Browser tests

Read `apps/e2e/README.md` and the available `playwright-cli` guidance. Use the existing domain/resource seeders and supported current routes.

| Boundary | Existing place to inspect | What still needs asserting |
| --- | --- | --- |
| Initial login/bootstrap | `apps/e2e/src/fixtures/goToRouteAsUser.ts` | Navigation succeeded and expected content appears |
| Refresh after a mutation | `apps/e2e/src/helpers/reload-helpers.ts`, `reloadAndWaitForContentOrRecover` | Persisted values after the recovered reload |
| GraphQL mutation | `apps/e2e/src/helpers/graphql-helpers.ts`, `expectMutationSucceeds` | Refetch/render completion and correct resulting state |
| Bulk resource scoping | `apps/e2e/src/tests/integrations-platform/helpers/configure-scope.testutil.ts` | All seeded resource states and persistence |

The reload helper retries recognized bootstrap failures with a bounded attempt count. It does not retry the scope mutation. Use a content locator for recovery and assert resource state afterward so recovery cannot turn a successful no-op into a pass.

Pointer interception requires inspecting the overlay and control. Use supported interaction/recovery helpers. Keyboard selection can be valid for a keyboard-accessible control, but validate the selected value and closed popup; do not generalize one development-toast workaround into hiding errors or forcing clicks throughout the suite.

## Repeated-run receipts

Use installed runner help/config to select JSON reporters and output paths. Keep one distinct report per independent invocation when claiming independent runs. With Playwright, one report can also contain multiple `--repeat-each` executions: report those as repeated executions rather than independent report files. `--min-runs` in the receipt checker counts input reports, not test cases.

Before running, disable runner retries and inspect CI/Datadog retry overrides if applicable. Playwright JSON exposes attempt numbers. The Vitest JSON format used in these investigations does not expose all retry information, so confirm its retry configuration separately.

For example, a supported Vitest invocation may use `--reporter=json --outputFile=<unique-report-path> --retry 0 --sequence.shuffle --sequence.seed <seed>`. Playwright may use `--reporter=json` with `PLAYWRIGHT_JSON_OUTPUT_NAME=<unique-report-path>`. Check current installed options and repository wrapper behavior before applying either example. The receipt checker is separate from test execution and does not change reporter, retry, or quarantine settings.

## Handoff

Use the repository's `commit-and-pr` skill and `docs/agent-guidance/git-prs-and-reviews.md` for authorized publishing. Honor an existing request for a draft PR; do not end at local edits and leave the user searching for a PR. A Jira-prefixed title is appropriate when requested. Explain the test's corrected assumption, retained assertions, actual verification, and limitations. Publishing a fix does not authorize posting a review reply or resolving a human thread.
