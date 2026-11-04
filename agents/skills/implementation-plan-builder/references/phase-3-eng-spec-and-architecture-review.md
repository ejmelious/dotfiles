# Phase 3 — Engineering Spec & Architecture Review (per milestone)

> **STATUS: VALIDATED.** Loop 3 (Architecture Review) per your direction; Loops 1–2 confirmed.

**Goal:** for each milestone, produce a detailed, buildable engineering spec **and** validate it against the holistic system architecture before it's finalized. Architecture review is no longer a standalone up-front phase — it happens here, concretely, against each milestone's actual eng spec.

**Per-milestone execution (full loop per milestone):** run the full three-loop pass independently for every milestone. Each milestone gets its own folder and preserved loop trail:
```
phase-3-eng-specs/
├── milestone-1/
│   ├── eng-spec.md
│   └── .loops/{loop-1-author, loop-2-grounding, loop-3-architecture-review}.md
├── milestone-2/  └── ...
```

**Read `references/loop-process.md` first.**

**Input packet (per milestone):** Phase 1 artifacts (refined PRD, system impact analysis, **holistic architecture**), the Phase 2 milestone plan, the specific milestone's definition, prior milestones' finalized specs, + codebase.

---

## Execution shape — parallelize at dependency boundaries

Phase 3 is the heaviest phase in the pipeline (per-milestone × 3 loops). Milestones in the same dependency layer can run their loops in parallel, but milestones in deeper layers must wait for their upstream specs.

**Identify the dependency graph first.** Walk the Phase 2 milestone plan: which milestones consume only Phase 1 inputs? Which consume earlier milestone specs? Group into layers.

**Run each layer in parallel.** Within a layer:
- All milestones' Loop-1s fire in parallel (single orchestrator message with N Agent calls).
- After all Loop-1s return, all milestones' Loop-2s fire in parallel.
- After all Loop-2s return, all milestones' Loop-3s fire in parallel.

**Typical 4-milestone shape** (MS-A is the dependency root; MS-B and MS-C build only on MS-A; MS-D consumes MS-A, MS-B, and MS-C):
- Layer 1: MS-A alone (3 loops sequential)
- Layer 2: MS-B + MS-C in parallel (3 layers of parallel pairs)
- Layer 3: MS-D alone (3 loops sequential)

Wall-clock: ~3 layers of work instead of ~12 sequential loops. Token spend stays the same; orchestrator context stays tighter because the synthesis pass after each layer consolidates fresh subagent returns.

---

## Loop 2 — verification scope and token budget

Loop 2 (Codebase Expert) is consistently the heaviest loop in Phase 3 because subagents read the "verify everything Loop 1 cited" mandate as exhaustive verification. The orchestrator should constrain this in the per-loop prompt.

**Verify only LOAD-BEARING claims.** A claim is load-bearing if its error would break the spec's design: a fabricated function name, a schema column that doesn't exist, a route that uses a different verb than cited, a chokepoint at the wrong layer. Verify these carefully — they are the bugs Loop 2 exists to catch.

**Treat non-load-bearing citations as navigation hints, not assertions.** File:line citations that just locate code (e.g., "POST handler at line 172") do not need verification unless they load-bear the design (e.g., "the existing transaction wraps lines 391-480" — that *is* load-bearing because the audit-write must land inside it).

**Soft token budget.** Pass an explicit budget guidance in the prompt — e.g., "stay under ~100-120k tokens of file reads. Prioritize the load-bearing verification list. Write your files even if you didn't get to every Priority-3 item." Partial output is usable; missing output isn't.

**Order the prompt by priority.** Give Loop 2 a numbered priority list: P1 = load-bearing verifications (must do); P2 = high-value verifications (do if budget); P3 = nice-to-have (skip if budget tight). The subagent will write its files with what it got to.

These constraints save ~40-60k tokens per Loop 2 invocation without sacrificing the bug-catching that justifies the loop's existence.

---

## Loop 1 — Implementing Senior Engineer (Author)

**Mandate:** author the detailed engineering spec for this milestone.

**Do:** specify components/classes/functions to add or change; data-model and migration changes; API/contract changes; interfaces and error handling; the ordered sequence of changes to land it safely.

**Produces — Eng Spec (first draft).**

## Loop 2 — Codebase / Domain Expert (Ground)

**Mandate:** ground the spec in the actual code for this area — feasibility, not fit.

**Do:** name exact files/symbols to touch; identify integration points, backward-compat and migration concerns; confirm conformance to existing patterns; verify the spec is buildable as written. Read the code — don't theorize.

**Produces:** critique + precise codebase-anchored revisions.

## Loop 3 — Architecture Review (Pressure-test)

**Mandate:** validate this milestone's eng spec against the overarching system architecture (the Phase 1 holistic architecture) — confirm the piece fits the whole — then feed analysis and feedback back to the Sr. engineer to incorporate into the eng spec.

**Do:**
- **Fit to the whole (primary):** confirm the milestone's scope and approach fit the overarching architecture — that this piece slots into the system as designed, with no drift from its validated boundaries and contracts.
- Validate **reuse**: does the spec take proper advantage of existing routes / components / services where it should, rather than rebuilding?
- Validate **net-new**: where the spec introduces new surface area, confirm it's justified (existing genuinely wouldn't do) and introduced *properly* — right boundary, right contract, DRY.
- **Safety sanity check (lightweight):** flag any blatant unsafe practices in the implementation plan (e.g. data exposure, missing auth boundary, secrets in the clear) — a sanity pass, not a deep audit.
- Audit Loop 2's grounding for gaps or convenient assumptions.
- Produce specific, actionable feedback directed to the Sr. engineer for incorporation.

**Produces:** architecture-fit analysis + reuse-vs-net-new verdict + safety flags + concrete feedback for the author. Verdict: ship / revise / escalate.

*Distinction from Loop 2:* Loop 2 asks "is this buildable against the real code?" Loop 3 asks "does this piece fit the whole architecture, and is the reuse-vs-net-new call right?" Feasibility vs. fit.

---

## Synthesis — `milestone-N/eng-spec.md`

The Sr. engineer (Loop 1 persona) **incorporates the architecture review's feedback** — and Loop 2's grounding — back into the spec. The final spec is the post-review, post-incorporation version. Preserve all three loops' raw output in `.loops/`. Name any unresolved fit or reuse tension as an open decision rather than resolving it silently.

```markdown
# Eng Spec — Milestone N: <name>
## Design overview
## Changes: components / classes / functions (add vs. modify)
## Data model & migrations
## API / contract changes
## Sequence of changes (safe landing order)
## Error handling & edge cases
## Architecture fit & reuse-vs-net-new (post-review)
## DRY notes
## Safety flags (lightweight — blatant unsafe practices, if any)
## Open decisions
## Verdict
## Traceability — codebase references (path + symbol) + holistic-architecture references
```
