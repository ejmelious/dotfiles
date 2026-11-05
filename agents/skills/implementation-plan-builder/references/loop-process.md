# The Three-Loop Engine

Most phases run this exact process. Only the personas and the artifact differ — the mechanics below are constant. Read this in full before running any phase, then read the phase's own reference file for its personas and output template.

**Shorter phases.** Phase 2 runs two loops (Author → Ground; Ground gives the verdict). Phases 4 and 5 run a single review pass. For those, the phase file is authoritative on loop count, but the **traceability and integrity rules below still apply**.

## Why three loops

A single pass produces plausible-but-unstressed output. The loops force the work through independent lenses, each adversarial to the last: someone proposes, someone grounds it in reality, someone pressure-tests the whole. The value is in the *independence* — Loop 3 must be able to disagree with Loop 2, and Loop 2 with Loop 1, without contextual pressure to converge.

## The loops

- **Loop 1 — Author.** The persona best suited to *originate* this phase's artifact. Produces the first complete draft from the phase inputs (PRD, prior-phase artifacts, codebase).
- **Loop 2 — Ground.** The persona who has to *live with the consequences* — usually an implementer. Stresses the draft against reality: the actual codebase, delivery constraints, edge cases. Produces a critique and concrete, specific revisions (not vague concerns).
- **Loop 3 — Pressure-test.** The senior reviewer / architect persona. Assesses the artifact holistically *and* audits Loop 2's grounding for gaps or anchoring. Judges design quality — surgical where possible, net-new only where justified — and names both what's **over-built** (no concrete need behind it) and what's **under-built** (a need with nothing in the plan serving it). Produces a critique plus an explicit verdict (ship / revise / escalate).

## Procedure

1. **Assemble the input packet.** The PRD, all final artifacts from prior phases, and the relevant slice of the codebase. Loops 2 and 3 additionally receive the prior loops' outputs.
2. **Loop 1 (Author).** Produce the draft following the phase's output template. Save reasoning to `.loops/loop-1-<persona>.md`.
3. **Loop 2 (Ground)**, fresh context. Input packet + Loop 1's draft. Produces (a) a critique by severity, (b) specific revisions tied to codebase references, (c) anything Loop 1 missed. Save to `.loops/loop-2-<persona>.md`.
4. **Loop 3 (Pressure-test)**, fresh context. Input packet + Loops 1 and 2. Produces (a) a holistic assessment, (b) an audit of Loop 2, (c) a reuse-vs-net-new judgment including what's over-built or under-built, (d) a verdict. Save to `.loops/loop-3-<persona>.md`.
5. **Synthesize.** Produce the clean final artifact(s) by folding in accepted recommendations. Update `00-index.md`.

### Synthesis rules

The goal is the right-sized plan (see SKILL.md §Operating principles), so additions and removals are judged by the same test: what concrete need is served or protected?
- **An addition needs a concrete need behind it.** A recommendation that adds surface area — a component, abstraction, requirement, non-functional, task, or test level — is accepted only if it serves a source-PRD requirement, a codebase constraint, or prevents a named failure mode. Otherwise drop it, or list it under the artifact's "Not doing" section.
- **A removal must show nothing needed is lost:** the requirements are still met and no named failure mode opens up.
- **Disagreements are surfaced, not settled silently.** Where loops disagree on something material, name the disagreement and the options, and record it as an open decision.

After synthesis, Phases 1 and 3 run the **simplification gate** (`simplification-gate.md`) before the next phase starts.

## Running loops independently

**Preferred: subagents.** Run each loop as a separate subagent (the Agent tool in Claude Code) with a fresh context. Pass it the input packet and prior-loop outputs as data. A fresh context can't be anchored by reasoning it never saw being produced.

**Fallback: disciplined sequential passes.** If subagents aren't available, run the loops in sequence but at the start of each: (1) restate the persona and mandate, (2) treat the prior loop's output as a *document to critique*, not settled truth, and (3) re-derive conclusions from the input packet. State this re-anchoring at the top of the loop's output.

Either way, each loop's output is written to its own `.loops/` file before the next loop begins.

## Conflict handling

- **Loop 2 vs Loop 1:** Loop 2 wins on implementation reality (what the codebase supports, what's feasible). Loop 1 wins on intent (what the requirement asks for). Genuine intent-vs-feasibility clashes are escalated.
- **Loop 3 vs Loops 1–2:** Loop 3 wins on holistic design, but must *justify* an override with reasoning. To discard Loop 2's grounding it must explain why the grounding was wrong.
- **Unresolvable:** becomes a named open decision in the final artifact and `00-index.md`, with options and a recommendation.

## Traceability and integrity (non-negotiable)

- Every claim, dependency, and design assertion must trace to the PRD, an explicit codebase reference (file path + symbol), or a prior-phase artifact.
- Untraceable items are labeled `[ASSUMPTION]` or `[OPEN QUESTION]` — never stated as fact.
- Codebase references must be real and verified by reading the code. If part of the codebase couldn't be read, say so.
- `.loops/` files are preserved raw — they are the audit trail.

## Loop output template

```markdown
# Loop N — <Persona> — <Phase>
**Re-anchoring** (fallback mode only): <persona, mandate, what I'm treating as critique-able>

## Assessment
## Findings (by severity)
- **Blocking:** ...
- **Significant:** ...
- **Minor:** ...
## Concrete recommendations
<specific, tied to PRD/codebase/prior-artifact references; say for each whether it adds or removes>
## Audit of prior loop (Loops 2 and 3 only)
## Verdict (final loop only)
Ship / Revise / Escalate — one-line justification.
```

---

## Cost-aware execution

These apply to the orchestrator.

**Slim per-loop prompts.** A subagent reads its phase reference and this file directly. The orchestrator's prompt carries only per-invocation specifics (~1–2k tokens):

> "Run Loop N of Phase X for [scope]. Read `loop-process.md` and `phase-X-*.md` first. Inputs on disk: [list]. Prior loops' outputs on disk: [list]. What to pressure-test specifically: [list]. Save outputs to [paths]. Return [short summary shape]."

**Parallelize across milestones.** Loops within one milestone are sequential, but separate milestones' Phase 3 and 4 work is independent once their inputs are final. Fire all N Loop-1s in one message, then all N Loop-2s, then all N Loop-3s (and all N G2 gates). Where a milestone consumes an earlier milestone's final spec, stage the parallelism around that dependency.

**Soft token budget.** Loop 2 tends to over-read. Pass a budget hint — "stay under ~120k tokens of file reads; prioritize verifying load-bearing claims; write your files with what you have rather than skip writing." Partial output is usable; missing output isn't.
