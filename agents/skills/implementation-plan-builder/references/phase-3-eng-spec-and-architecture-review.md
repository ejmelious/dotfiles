# Phase 3 — Engineering Spec, Tasks & Architecture Review (per milestone)

**Goal:** for each milestone, produce one buildable engineering spec — the design, the ordered tasks with acceptance criteria, and the commit plan — validated against the codebase and the holistic architecture. Then run simplification gate **G2** on it.

The spec is what the executor works from: its tasks and acceptance criteria are the executor's definition of done.

**Per-milestone execution:** run the full three-loop pass independently for every milestone:
```
phase-3-eng-specs/
├── milestone-1/
│   ├── eng-spec.md
│   └── .loops/{loop-1-author, loop-2-grounding, loop-3-architecture-review, simplification}.md
├── milestone-2/  └── ...
```

**Read `references/loop-process.md` first.**

**Input packet (per milestone):** Phase 1 artifacts (refined PRD, holistic architecture), the Phase 2 milestone plan, this milestone's definition, prior milestones' final specs, + codebase.

---

## Execution shape — parallelize at dependency boundaries

Use the dependency layers from the milestone plan. Within a layer:
- All milestones' Loop-1s fire in parallel (one orchestrator message with N Agent calls).
- Then all Loop-2s in parallel; then all Loop-3s; then all G2 gates.

Deeper layers wait for their upstream specs to be final (post-G2).

---

## Loop 2 — verification scope and token budget

Loop 2 is the heaviest loop because subagents read "verify everything Loop 1 cited" as exhaustive. Constrain it in the per-loop prompt:

**Verify only load-bearing claims.** A claim is load-bearing if its error would break the design: a fabricated function, a schema column that doesn't exist, a route with a different verb than cited, a chokepoint at the wrong layer.

**Treat non-load-bearing citations as navigation hints.** A `file:line` that just locates code doesn't need verification unless the design depends on it (e.g. "the existing transaction wraps lines 391–480" is load-bearing if a new write must land inside it).

**Order the prompt by priority.** P1 = load-bearing verifications (must do); P2 = task completeness (do if budget); P3 = nice-to-have. Pass a soft budget (~100–120k tokens of file reads) and "write your files even if you didn't reach P3."

---

## Loop 1 — Implementing Senior Engineer (Author)

**Mandate:** author the engineering spec for this milestone.

**Do:**
- Specify the components / functions to modify or add (modify by default; justify each addition), data-model and migration changes, API/contract changes, and error handling.
- Break the work into **ordered tasks** in safe landing order. Each task names what changes in the system (files / symbols) and has **acceptance criteria** that trace to the milestone's exit criteria or a refined-PRD requirement.
- Group tasks into a **commit plan**: the commits, and the PRs they're grouped into. Each PR is a contiguous run of tasks that is reviewable and green on its own; the executor turns these into a stack of PR branches. A small milestone is one PR.

**Produces — Eng Spec (first draft).**

## Loop 2 — Codebase / Domain Expert (Ground)

**Mandate:** ground the spec in the actual code — feasibility, not fit.

**Do:**
- Name exact files/symbols to touch; identify integration points, backward-compat and migration concerns; confirm conformance to existing patterns.
- Verify each task is real and correctly scoped, and that the tasks together deliver the milestone's exit criteria — surface missing work, and flag tasks that aren't needed.
- Read the code — don't theorize.

**Produces:** critique + precise codebase-anchored revisions.

## Loop 3 — Architecture Review (Pressure-test)

**Mandate:** validate the spec against the holistic architecture — confirm the piece fits the whole — and feed concrete feedback back to the author.

**Do:**
- **Fit to the whole (primary):** the milestone slots into the architecture as designed, with no drift from its boundaries and contracts.
- **Reuse:** the spec uses existing routes / components / services where it should, rather than rebuilding.
- **Net-new:** each new piece of surface area is justified and introduced at the right boundary.
- **Over-built and under-built:** components, abstractions, tasks, or edge-case handling with no concrete need behind them; and needs (requirements, codebase constraints, failure modes such as races or unsafe migrations) the spec doesn't yet handle.
- Flag blatant unsafe practices (e.g. a new route without an auth check) as Blocking findings.
- Audit Loop 2's grounding for gaps or convenient assumptions.

**Produces:** architecture-fit analysis + concrete feedback for the author + verdict (ship / revise / escalate).

*Distinction from Loop 2:* Loop 2 asks "is this buildable against the real code?" Loop 3 asks "does this piece fit the whole, and is it sized to what it actually needs?"

---

## Synthesis — `milestone-N/eng-spec.md`

The author (Loop 1 persona) incorporates Loop 2's grounding and Loop 3's feedback, applying the synthesis rules in `loop-process.md`. Name unresolved fit or reuse tensions as open decisions. Then run **G2** (`simplification-gate.md`) and apply its accepted cuts before the milestone's Phase 4.

```markdown
# Eng Spec — Milestone N: <name>
## Design overview
## Changes: components / functions (modify vs. add — each addition justified)
## Data model & migrations
## API / contract changes
## Error handling & edge cases
## Tasks (in landing order)
  - T1 <task> — what changes in the system (files / symbols) · acceptance criteria
## Commit plan
  - PR 1 <title> — tasks T1–T2 · commits: <one line each>
  - PR 2 <title> — tasks T3–T5 · commits: ...
## Not doing — considered and left out (with reason)
## Open decisions
## Verdict
## Traceability — codebase references (path + symbol) + refined-PRD / holistic-architecture references
```
