---
name: fix-flaky-tests
description: "Investigate and fix intermittent or quarantined tests using historical failures, existing helpers, counterexamples, and repeated-run evidence. Use for flaky-test tickets and re-enabling disabled tests. For a red CI check without evidence of a flaky test, diagnose CI first."
---

# Fix Flaky Tests

Deliver a fix tied to observed failures and evidence that the repaired test still detects incorrect behavior. Preserve the user's investigation, implementation, and publishing scope.

In a Vanta checkout, read [Vanta investigation and helper map](references/vanta.md). Read [proof patterns](references/proof-patterns.md) when choosing a counterexample or interpreting an apparent stabilization.

## Establish what failed

- Resolve the affected test, current revision, quarantine history, and earlier repair attempts. A skipped baseline does not execute the failing behavior; use the repository's supported way to enable it temporarily.
- Inspect the ticket's historical window and representative failures, including error locations and linked job/trace evidence. A quarantine category or timeout is a lead. Distinguish failed events, retries, distinct jobs, and distinct pipelines when reporting counts.
- Follow the behavior through production code and the existing fixture, mock, cleanup, client, navigation, and assertion helpers. Check adjacent tests before introducing a helper or replacing their framework.
- Separate an obsolete expectation, an ordering/timing assumption, leaked state, an application bug, and runner/setup failure. One passing isolated run does not refute historical flakiness. Say when the original symptom has not reproduced locally.

## Repair the assumption at its owning boundary

Use the smallest change that preserves the intended behavior. Examples include asserting an unordered collection with multiplicity, waiting for refetched UI state, recovering navigation before checking persistence, and narrowing clock/rate controls so database timers remain real.

Establish that ordering or timing is incidental before removing that assertion. If application behavior is wrong, fix it within the authorized scope or report the product issue; do not encode incorrect behavior as the new expectation. Avoid blanket error suppression, forced clicks, or a larger timeout as a substitute for diagnosing the failure.

Keep persistence and mutation checks meaningful: observe successful completion, assert the complete expected state, and check persisted state through an independent read or refresh when persistence is the contract. An empty list can be a loading state; a successful response can be a no-op. Recovery may reload navigation; it must not re-seed data or replay the mutation being verified.

## Collect three kinds of evidence

| Claim | Useful evidence |
| --- | --- |
| The historical failure mechanism is understood | Reproduce the old failure or its suspected mechanism with a controlled perturbation. Label an inferred mechanism or partial reproduction explicitly. |
| Valid behavior is stable | Exercise the irrelevant variation, such as opposite result order or a transient bootstrap error, then run an appropriately scoped set repeatedly with test retries disabled. |
| The test still protects the contract | Inject a plausible defect, such as a missing/duplicate record, changed field, successful no-op, or scope reset. Require failure at the intended assertion. |

Choose a small number of probes that discriminate between fixes. Do not add permanent tests of the assertion library or mirror the helper implementation just to generate a receipt. Use existing mutation tooling when available; otherwise keep a reversible probe isolated from other work. Record the mutation, command, outcome, and failure location. A syntax/build error or timeout in the probe is not a detected behavioral defect.

Restore every probe and rebuild affected generated outputs before ordinary verification. Do not run validation that can read a temporary mutation concurrently with it.

## Verify and describe the limits

- Run the repaired case, relevant adjacent consumers, and the repository's scoped checks. Re-enable the target and verify its active test count. Avoid repository-wide validation when the affected boundary is known.
- Check the installed runner's help/config before choosing repeat or shuffle flags. Some Vitest versions expose `repeats` as a test option without a CLI `--repeats` flag. Independent invocations are a portable alternative. Choose repetition count and concurrency for the observed failure; ten is an example, not a universal gate.
- Keep per-run JSON reports, exact commands, revision or code fingerprint, retry configuration, seeds/concurrency, results, and environment changes. Preserve failed attempts. A zero exit code alone does not prove that the target ran.
- For Vitest or Playwright JSON reports, use `scripts/verify-runs.mjs` below to reject absent/skipped targets, reported failures, duplicate report files, and reported retries. It checks receipts; it cannot establish artifact provenance, source revision, or absence of retries that a reporter omits.
- Keep verification levels distinct: helper checks against synthetic HTML do not establish that the full application E2E passed. Report the checks actually executed and the remaining limits.

```sh
node <skill-dir>/scripts/verify-runs.mjs --framework vitest \
  --target 'Suite returns the expected records' --min-runs 10 <per-run-report-files...>
```

Investigate setup errors separately using the repository's supported diagnostics. Reuse an existing stack when appropriate; record and restore any temporary runtime settings. Follow the local repair/retry limit rather than repeatedly rebuilding the repository or churning CI to obtain green results.

Finish the requested handoff. If an existing instruction already asks for a commit or PR, complete that work and identify its URL/status; otherwise do not assume publishing permission. Use the repository's publishing workflow when applicable. This skill does not grant permission to comment, resolve reviews, mutate tickets/quarantine state, or retry remote jobs.
