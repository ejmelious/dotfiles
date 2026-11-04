# The Three-Loop Engine

Most phases run this exact process. Only the three personas and the artifact differ — the mechanics below are constant. Read this in full before running any phase, then read the phase's own reference file for its personas and output template.

**Truncated phases.** Some phases deliberately run a *single review pass* instead of three loops — the phase's reference file says so explicitly (currently Phases 5 and 6). For those, the three-loop mechanics below don't apply, but the **traceability and integrity rules still do**. When in doubt, the phase file is authoritative on how many loops to run.

## Why three loops

A single pass produces plausible-but-unstressed output. The three loops force the work through three independent lenses, each adversarial to the last: someone proposes, someone grounds it in reality, someone pressure-tests the whole. The value is in the *independence* — Loop 3 must be able to disagree with Loop 2, and Loop 2 with Loop 1, without social or contextual pressure to converge prematurely.

## The loops

Each phase maps its personas onto these three roles. The pattern:

- **Loop 1 — Author.** The persona best suited to *originate* this phase's artifact. Produces the first complete draft. Works from the phase inputs (PRD, prior-phase artifacts, codebase).
- **Loop 2 — Ground.** The persona who has to *live with the consequences* — usually an implementer. Stresses the draft against reality: the actual codebase, delivery constraints, edge cases, operational load. Produces a written critique and a set of concrete, specific revisions (not vague concerns).
- **Loop 3 — Pressure-test.** The senior reviewer / architect persona. Assesses the artifact holistically *and* audits Loop 2's grounding for gaps or anchoring. Judges design quality: well-architected, DRY, surgical where possible and net-new only where justified. Produces a critique plus an explicit verdict (ship / revise / escalate).

## Procedure

For each phase:

1. **Assemble the input packet.** The PRD, all final artifacts from prior phases, and the relevant slice of the codebase. The same packet is available to all three loops. (Loops 2 and 3 additionally receive the prior loop's output.)

2. **Run Loop 1 (Author).** Adopt the persona. Produce the draft artifact following the phase's output template. Save the draft and the persona's reasoning to `.loops/loop-1-<persona>.md`.

3. **Run Loop 2 (Ground).** Adopt the persona with a fresh context. Give it the input packet + Loop 1's draft. It produces: (a) a critique organized by severity, (b) specific proposed revisions tied to codebase references, (c) anything Loop 1 missed. Save to `.loops/loop-2-<persona>.md`.

4. **Run Loop 3 (Pressure-test).** Adopt the persona with a fresh context. Give it the input packet + Loops 1 and 2's outputs. It produces: (a) a holistic assessment, (b) an audit of whether Loop 2 grounded correctly or over/under-reached, (c) a DRY / surgical-vs-net-new judgment, (d) an explicit verdict. Save to `.loops/loop-3-<persona>.md`.

5. **Synthesize.** Produce the clean final artifact(s) by folding in accepted recommendations from Loops 2 and 3. Where the loops disagree on something material, do not silently pick a side — name the disagreement, lay out the options and tradeoffs, and mark it as an open decision for the human. Update `00-index.md`.

## Running loops independently

Independence is the point — protect it.

**Preferred: subagents.** Run each loop as a separate subagent (e.g. the Task tool in Claude Code) with its own fresh context. Pass it the input packet and prior-loop outputs as data, with a clear instruction to adopt the persona and reason from the inputs. A fresh context can't be anchored by reasoning it never saw being produced.

**Fallback: disciplined sequential passes.** If subagents aren't available, run the loops in sequence in one context, but at the start of each loop explicitly: (1) restate the persona and its mandate, (2) treat the prior loop's output as a *document to critique*, not as settled truth, and (3) re-derive conclusions from the input packet rather than inheriting them. State this re-anchoring at the top of each loop's output.

Either way, each loop's output is written to its own `.loops/` file before the next loop begins.

## Conflict handling

- **Loop 2 vs Loop 1:** Loop 2 wins on matters of implementation reality (what the codebase actually supports, what's operationally feasible). Loop 1 wins on matters of intent (what the requirement is actually asking for). Genuine clashes between intent and feasibility are escalated, not resolved by fiat.
- **Loop 3 vs Loops 1–2:** Loop 3 wins on holistic design and architectural soundness, but must *justify* an override with reasoning, not authority. If Loop 3 wants to discard Loop 2's grounding, it has to explain why the grounding was wrong.
- **Unresolvable:** anything the loops can't reconcile becomes a named open decision in the final artifact and in `00-index.md`, with options and a recommendation — for the human to settle.

## Traceability and integrity (non-negotiable)

- Every claim, status, date, dependency, and design assertion in any loop output or final artifact must trace to the PRD, an explicit codebase reference (file path + symbol/line where possible), or a prior-phase artifact.
- Untraceable items are labeled `[ASSUMPTION]` or `[OPEN QUESTION]` — never stated as fact.
- Codebase references must be real and verified by actually reading the code. Do not invent paths, APIs, or components. If part of the codebase couldn't be read, say so explicitly rather than guessing.
- The `.loops/` files are preserved raw — they are the audit trail showing how the final artifact was reached.

## Loop output template

Each `.loops/loop-N-<persona>.md` uses:

```markdown
# Loop N — <Persona> — <Phase>
**Re-anchoring** (fallback mode only): <persona, mandate, what I'm treating as critique-able>

## Assessment
<the persona's substantive analysis>

## Findings (by severity)
- **Blocking:** ...
- **Significant:** ...
- **Minor:** ...

## Concrete recommendations
<specific, actionable — tied to PRD/codebase/prior-artifact references>

## Audit of prior loop (Loops 2 and 3 only)
<where the prior loop was right, wrong, over-reached, or missed something>

## Verdict (Loop 3 only)
Ship / Revise / Escalate — with one-line justification.
```

---

## Cost-aware execution

The three-loop pattern is token-expensive. These guidelines reduce cost without sacrificing quality. They apply to the orchestrator, not the loops themselves.

### Slim per-loop prompts (orchestrator)

A subagent reads its phase reference and `loop-process.md` directly. The orchestrator's per-loop prompt should NOT re-state material those files already cover (re-anchoring instructions, hard rules, output template, conflict-handling, traceability rules). The prompt is for **per-invocation specifics**: which milestone, which input files on disk, what to pressure-test specifically for this run, what to return.

A good orchestrator prompt for a loop is ~1–2k tokens, not 4–5k. The pattern:

> "Run Loop N of Phase X for [scope]. Read `loop-process.md` and `phase-X-*.md` first. Inputs on disk: [list]. Prior loops' outputs on disk: [list]. What to pressure-test specifically: [variable list]. Save outputs to [paths]. Return [short summary shape]."

### Parallelize where loops are independent

Loops *within* a single milestone are sequential (Loop 2 needs Loop 1's draft; Loop 3 needs both). But **separate milestones' Phase 3/4/5 loops are independent of each other** once their inputs (Phase 1, Phase 2, prior phase per-milestone artifacts) are final.

When processing N milestones at the same phase, the orchestrator can:
- Run all N Loop-1s in parallel (single message with N Agent tool calls)
- After Loop-1s return, run all N Loop-2s in parallel
- After Loop-2s return, run all N Loop-3s in parallel

Wall-clock drops by ~Nx for that phase. Token spend stays the same (work is the same), but the orchestrator's own context stays shorter because the per-milestone subagent returns are processed in one synthesis pass instead of N.

**Where parallelism doesn't apply:** when later milestones consume earlier milestones' final artifacts (e.g., MS-3 reading MS-1's spec), the upstream must finish first. Stage the parallelism around the dependency boundaries — usually it's possible to parallelize 2–4 milestones at a time.

### Soft token budget per subagent

Loop 2 (codebase grounding) consistently spends the most tokens because its mandate is "read the code." A subagent left unconstrained tends to over-read.

The orchestrator should pass a soft budget heuristic in the prompt:

> "Token budget guidance: stay under ~120k tokens of file reads. Prioritize verifying load-bearing claims from prior loops over exhaustive codebase exploration. If the budget would push you over, write the files with what you have rather than skip writing."

Subagents respect these hints. A "write the files even if incomplete" instruction is critical — partial outputs are usable; missing outputs aren't.

### Agent type selection

The default `general-purpose` subagent has all tools (Read, Grep, Glob, Edit, Write, Bash, etc.) and is the right choice when the loop must edit existing artifact files (which Loops 2 and 3 do — they update the in-progress draft directly).

For a **read-only verification pass** that returns findings as text for the orchestrator to apply, the `Explore` agent is cheaper (~30–40% fewer tokens) because it's tuned for codebase search. Use it when:
- The orchestrator is willing to apply the subagent's suggested spec edits manually (costs main-loop tokens to do so)
- The subagent's main job is "verify these N specific claims and report back"
- The loop is producing only critique/findings, not the next-draft artifact

Don't use Explore when the loop's natural shape is "read, then edit the spec file" — the round-trip through the orchestrator usually costs more than it saves.

### Size-adaptive loop count

Some phases support a fast-path for small scopes. See each phase reference for whether it offers a 2-loop fast-path and the criteria. Phase 4 is the main one today (size-S milestones can use a 2-loop pattern combining grounding + architectural review).
