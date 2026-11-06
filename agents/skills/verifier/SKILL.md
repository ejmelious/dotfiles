---
name: verifier
description: Design, audit, and build agent verifiers — automated checks an agent runs itself to prove its work is correct, from types, lint and architecture rules through unit and property tests, golden datasets, contract tests, browser/e2e checks, shadow runs, load/SLO checks, mutation testing and LLM judges to canaries and rollout gates. Three jobs. (1) Turn a bug, alert, incident, postmortem or escaped defect into the verifier that would have prevented or detected it — "which verifier would have caught this?". (2) Audit a repo or service against the verifier ladder and name its biggest gaps. (3) Build a specific verifier to a quality bar — proven to fail on the bad case, agent-runnable, with errors that teach the fix. Use this whenever the user mentions verifiers or the verifier ladder, asks how to catch something next time, wants postmortem prevention actions or a regression guard for an incident or alert, wants agents to check their own work, or wants a hook, lint rule or CI gate that blocks a known bad pattern — even if they never say "verifier". Also runs embedded inside implementation-plan-builder and implementation-plan-executor (see "Embedded mode"). Not for debugging or mitigating a live incident, and not for writing a feature's ordinary tests mid-implementation.
---

# Verifier

A **verifier** is an automated check an agent can run and read that turns "looks right" into pass or fail. Agent work moves only as fast as its output can be verified; where no verifier exists, a human is the feedback loop. This skill decides which verifier a situation needs, holds it to a bar, and builds it.

## The bar

A check counts as a verifier only when it meets all of these. Each exists because an agent will exploit or ignore a check that doesn't.

1. **The agent can run it and read the result.** One command. Fast rungs finish locally in seconds to minutes, so they can run on every edit through hooks. Slow rungs (load, shadow, canary) run in CI, nightly, or during rollout and report somewhere the agent can read.
2. **Must-hold rules are gates, not advice.** Instructions in AGENTS.md or a prompt are advice. A rule that must always hold belongs in a hook or CI check.
3. **Its failure teaches the fix.** The message says what's wrong *and what to do instead* ("use `ordersApi.get()` — direct datastore access outside the orders domain is not allowed"), so the agent can correct itself without a person.
4. **It has been seen to fail.** It goes red on the known-bad case — the escaped bug, a reverted fix, an injected fault — and green on correct code. A verifier never seen red proves nothing.
5. **It can't quietly be weakened.** Deleting, skipping, or loosening it is visible in review (protected path, CODEOWNERS, or a gate that flags it). Agents may not weaken a verifier to get to green.
6. **It uses real shapes, never raw customer data.** Golden data comes from real data shapes and past failures, rebuilt synthetically or sanitized.
7. **LLM judges are calibrated and never alone.** Check a judge against human labels; on a high-risk path it supports a deterministic gate, never replaces one.
8. **Someone owns it.** A named owner (team) and a stated place it runs.

## The ladder

`references/ladder.md` lists the rungs: what each catches, typical tools, and where it runs. Read it before choosing a rung.

Choose the **cheapest rung that catches the failure deterministically, as early as it can run**. A lint rule beats a unit test for a banned pattern; a unit or property test beats an e2e check for logic; anything pre-merge beats detection in production. But don't force a failure onto a rung that can't see it: some only appear at real scale, on real data shapes, or in one region, and the honest answer there is a shadow run, a load check, or a rollout gate.

## Modes

Pick the mode from the request. When unclear, ask one question.

| Mode | Use when | Read | Writes |
|------|----------|------|--------|
| **Escape → verifier** | a bug, alert, incident, postmortem, escaped defect, or the PR that fixed one | `references/escape-analysis.md` | `.ai-dev/verifiers/<slug>.md` — prevent + detect proposal |
| **Audit** | "what verifiers do we have?", map a repo/squad/service to the ladder, find gaps | `references/audit.md` | `.ai-dev/verifiers/ladder-audit.md` |
| **Build** | build a named verifier, or one from a proposal or audit gap | `references/building.md` | the verifier in the repo, plus proof it catches |

Escape and Audit are report-only and end by offering to build. Build changes the repo.

`.ai-dev/` is git-ignored: reports there are never committed. Use the repo's existing `.ai-dev/` if there is one, otherwise create it at the repo root.

## Inputs, systems and data

- **Where evidence comes from:** pasted text, a Jira key, an incident.io incident, a Datadog monitor or alert, a Slack thread, a postmortem doc, a PR or commit. Use connected tools **read-only** when they're available; otherwise ask the user to paste what's needed. Never post, comment, update, or resolve anything in those systems.
- **Customer data:** incident evidence often contains it. Never copy customer identifiers, payloads, tenant names, or record contents into reports, fixtures, or commits — describe the *shape* that failed and rebuild it synthetically. If the evidence you need is customer data you aren't sure you may process, stop and say so.
- **Build mode changes code:** run the repo's own checks, stage files by explicit path, and commit or push only after the user confirms. Changes to CI config, hooks, or CODEOWNERS are called out before they're made.

## Embedded mode (called by another skill)

When another skill (`implementation-plan-builder`, `implementation-plan-executor`) calls this one, it passes a scope and an output path. Ask no questions, write only to the given path, and return a short summary. Make no code changes except in **build**.

| Call | Caller | Input | Returns |
|------|--------|-------|---------|
| **audit** | builder Phase 1, executor Stage 0 | repo + the paths/components in scope | the audit's inventory table (rung, command, where it runs, runtime, meets bar?) and gaps that matter to that scope |
| **map** | builder Phase 4 | acceptance/exit criteria + failure modes, the audit | per criterion: cheapest rung, existing verifier or `missing`; each missing one classed `build-now` (becomes tasks), `post-merge` (shadow/load/canary/rollout evidence for the PR), or `out-of-scope` with reason |
| **build** | executor, for a planned verifier task | the verifier's spec + workspace | the verifier, plus proof-of-catch: the red run on the bad case and the green run on correct code |
| **escape-note** | executor gate | a defect a reviewer found that the verifiers missed | a one-paragraph proposal (rung, invariant, where it runs) — never built in the run |

Every verifier proposed in map or escape-note names the concrete failure mode it catches. One that can't is cut.
