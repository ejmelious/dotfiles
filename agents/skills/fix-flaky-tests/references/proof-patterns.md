# Proof patterns from completed investigations

Use these to select discriminating checks. They are examples, not a requirement to reproduce every case for every fix.

| Failure class | Stabilizing check | Protection check |
| --- | --- | --- |
| Unordered collection treated as ordered | Opposite valid enumeration order is accepted | Missing, duplicate, or changed records fail |
| Response arrives before rendered state settles | Wait through the owning refetch/render completion | A successful response without a state change fails |
| Transient bootstrap failure during persistence refresh | Recover navigation through the existing bounded helper | Persistent bootstrap failure and reset persisted state fail |
| Global fake time interferes with unrelated I/O | Narrow the control to the owned clock or recorded-client pacing; exercise real integration I/O | Changed or missing transformed output still fails the original comparison |
| UI/contract evolved since the test was written | Follow the current supported flow and await its real completion | Incorrect resulting or persisted state fails |

## Interpret a probe correctly

1. A harmless perturbation causing the old assertion to fail and the repaired one to pass supports removal of that incidental assumption. It does not prove the complete historical CI failure has reproduced.
2. A defect injected into production transformation logic should fail a meaningful result assertion. A missing import, build failure, unrelated timeout, or crashed browser is inconclusive.
3. When changing a recovery/waiting helper, cover both the recoverable condition and a persistent failure. Preserve the state assertion outside navigation recovery.
4. Repetitions measure observed stability in that environment. They do not prove that the oracle detects bugs, that compiled outputs match restored sources, or that another environment is healthy.

Prefer probes of the real computation, recorded response, or browser state. A mock that returns its own expected answer cannot establish that the application contract is protected. A focused browser probe using the real reload helper and synthetic HTML is useful for bootstrap handling, but it is not a replacement for a full AWS integration run.

## Grounding cases

- [CI-6762 / GCP lifecycle](https://github.com/VantaInc/obsidian/pull/227864): the expected `Connected (0)` UI no longer represented the disconnected state. The fix followed the Accounts flow, reused deletion completion, and checked Connect/absence of Accounts after reload. Restoring the historical expectation reproduced its timeout.
- [CI-6761 / AWS resource scope](https://github.com/VantaInc/obsidian/pull/228068): historical job logs showed a development toast intercepting a filter option; navigation also lagged the current UI. The fix retained real state/persistence checks, used the shared mutation assertion, and waited for refetch. A successful no-op mutation still failed. Review identified a plain reload that bypassed shared bootstrap recovery; focused browser checks verified both recovery surfaces and retained failures, without claiming a fresh full AWS run.
- [CI-6670 / GCP vulnerabilities](https://github.com/VantaInc/obsidian/pull/228101): unordered MongoDB results were compared as an ordered array. An order-only perturbation failed before and passed after the change; missing, duplicated, and modified vulnerabilities still failed afterward. No production sort was needed because ordering was not part of the contract.
- [CI-6794 / Cloudflare regression](https://github.com/VantaInc/obsidian/pull/228131): a previous accelerated-clock repair was quarantined again after CI timeouts. Local runs reproduced a native MongoDB timer warning, not the full historical timeout. The fix reused an adjacent client-pacing override, retained real database timers and the original BSON comparison, and rejected missing or incorrectly enabled rules. Reported duration improvement was supporting evidence rather than proof of the sole CI cause.

## Candidate repository verifiers

These are proposals, not installed enforcement. Add a repository gate only with authorization, an owner, a bounded scope, and demonstrated failing/passing examples.

- **Repeated-report receipt check:** use the bundled script to reject no-match, skipped, failed or reported-retry targets. Keep source revision, exact command and retry configuration alongside the reports; the script cannot establish their provenance.
- **Persistence recovery guard:** a narrowly scoped AST rule could flag raw `page.reload()` inside the repository's known post-mutation persistence scenarios and recommend the shared reload helper. Raw reloads are valid in tests that intentionally exercise bootstrap failure, so a repository-wide ban would be too broad.
- **Clock integration guard:** warn when a DB/HTTP regression suite uses accelerated global time and an existing narrower client/clock control supports its scenario. Rate-limit/backoff tests may legitimately require fake time; do not turn this into a blanket fake-timer ban.
- **Collection assertion guard:** retain the existing backend review rule against order-sensitive assertions on unsorted MongoDB results. Static analysis cannot always infer the ordering contract, so use an order-permutation and wrong-data probe when the contract is uncertain.

Prefer extending existing lint/review rules and helpers over adding another policy layer. Behavioral evidence remains necessary for cases that a syntax rule cannot distinguish reliably.
