# Escape → Verifier

Input: something got past the verifiers — a bug report, an alert, an incident, a postmortem, a defect a reviewer caught, or the PR that fixed one. Output: the verifier(s) that would have **prevented** it before merge and, when it reached production, **detected** it sooner. Report-only; ends by offering to build.

## 1. Gather the evidence (read-only)

Build a short timeline from whatever exists: **introduced** (commit/PR) → **merged** → **deployed** → **detected** (how, by whom, alert or customer) → **mitigated** → **fixed** (commit/PR).

- Find the fix first if there is one — `git log --grep`, the PR linked from the ticket or incident. The fix diff tells you exactly what was wrong.
- For an alert: what fired, its threshold, and what was actually broken underneath. An alert that fired is detection *working*; the question is mostly prevention, plus whether it fired early enough.
- Note what you couldn't find. Don't fill gaps with guesses.

Customer data stays out (see SKILL.md): describe the shape of the input that broke things, not its contents.

## 2. Name the failure mode as a class

Write one sentence for the **class** of failure and one for the **invariant** it broke — the thing that must always be true.

> Class: a paginating fetcher treats an empty page as the end of data, even when the API returned a continuation token.
> Invariant: a fetch ends only when the API says there are no more pages.

The class is what the verifier should catch. The instance (this fetcher, this tenant) becomes a regression case.

**Check the fix too.** A fix often changes the failure rather than removing it — a loop that stopped too early may now never stop, a retry may now hammer the API. Read the fix diff for new failure modes it introduces and include any you find; the verifier should cover them as well.

## 3. Why didn't an existing verifier catch it?

Find the verifiers covering this area (a lightweight version of `audit.md`: the relevant tests, lint rules, contracts, monitors). For each rung that could have seen the failure, classify why it didn't:

| Reason | What it means | Fix |
|--------|---------------|-----|
| **Missing** | nothing at that rung covers this area | build a new verifier |
| **Coverage gap** | the verifier exists, but no case exercises this input | add the case — usually a fixture or a property generator |
| **Too late** | it exists but runs after the point it was needed (nightly, not on PR; CI only, not in the agent's loop) | move it earlier, or add a fast subset |
| **Ignored** | it fired but was flaky, muted, or disabled | fix the flake or re-enable — a flaky verifier trains everyone to ignore it |
| **Weakened** | a change loosened it (skipped test, relaxed threshold, deleted case) | restore it, and protect it |
| **Unclear failure** | it fired but the message didn't say what to do, so it was worked around | rewrite the message to teach the fix |

The reason often matters more than the rung: "add a test" is the wrong action for an ignored or weakened verifier.

## 4. Choose the verifiers

Walk the ladder (`ladder.md`) from the top and stop at the first rung that could have seen the failure deterministically.

- **Prevent:** the cheapest pre-merge rung. Prefer catching the class (a lint rule over every call site, a property over all inputs) and include the escape itself as a regression case.
- **Detect:** for anything that reached production — which canary, SLO, monitor, shadow comparison, or rollout gate would have shown it sooner, and how much sooner. If detection was already fast, say so and skip it.
- If no rung could reasonably have caught it before production — genuinely novel data, an external change — say that plainly and put the weight on detection. Don't invent a pre-merge verifier that couldn't have worked.

For each verifier, specify:
- **rung** and **what it asserts** (the invariant);
- **the failing case** — the escape, rebuilt synthetically;
- **command** and **where it runs** (hook / PR CI / nightly / rollout), and roughly how long;
- **the failure message**, written out, so it teaches the fix;
- **proof-of-catch plan** — how to show it fails: run it against the commit before the fix (in a worktree), or with the fix reverted locally. It must fail *for the right reason*, then pass on the fixed code;
- **owner**, and the **cost** of keeping it (runtime, flake risk, fixture upkeep).

## 5. Write the proposal

Write `.ai-dev/verifiers/<slug>.md` (slug from the ticket/incident key or a short description):

```markdown
# Verifier proposal — <bug / alert / incident title>
## Source — links/keys, and what couldn't be found
## Timeline — introduced → merged → deployed → detected → mitigated → fixed (with gaps)
## Failure mode — class + invariant
## Why existing verifiers missed it — rung, reason (missing / coverage gap / too late / ignored / weakened / unclear failure)
## Prevent — verifier: rung, assertion, failing case, command, where it runs, failure message, proof-of-catch plan, owner, cost
## Detect — verifier (or "detection was adequate: <why>")
## Not proposed — rungs considered and rejected, with reason
## Recommended next step — build which, in what order
```

Then tell the user the headline — which verifier, at which rung, why the existing ones missed it — and offer to build it (`building.md`).
