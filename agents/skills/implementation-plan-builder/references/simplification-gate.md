# Simplification Gate

The goal is the right-sized plan — not the smallest one (see SKILL.md §Operating principles). The phase loops are good at finding what's missing and bad at removing what isn't needed: every reviewer adds, and nobody's job is to subtract. The simplification gate is the counterweight: an independent agent proposes cuts to what's over-built, a quick triage accepts or rejects them, and the accepted ones are folded into the artifact automatically. A cut that makes the plan simpler but wrong is a bad proposal.

## When it runs

| Gate | After | Reviews | Required? |
|------|-------|---------|-----------|
| **G1** | Phase 1 synthesis | `refined-prd.md` + `holistic-architecture.md` | Always |
| **G2** | Each milestone's Phase 3 synthesis | that milestone's `eng-spec.md` | Always — one per milestone, parallel within a dependency layer |
| **G3** | Phase 4 (all test plans done), before Phase 5 | the whole plan | Only when the plan has 3+ milestones |

G1 is the highest-leverage gate: complexity introduced in the architecture is inherited by every milestone. Don't start Phase 2 until G1 is applied, or Phase 4 for a milestone until its G2 is applied.

## Step 1 — Simplifier (fresh subagent)

**Inputs:** the source PRD, the current final artifacts named in the table above, the final `refined-prd.md` and `holistic-architecture.md` (for G2/G3), and the codebase.

**Do not give it the `.loops/` trail.** The loop files are full of reasoning that justifies the current design; seeing them anchors the simplifier toward keeping it. It judges the artifact on its own merits against the requirements.

**Mandate — subtractive only.** Find what's over-built: elements with no concrete need behind them (a source-PRD requirement, a codebase constraint, or a named failure mode they prevent), or that a simpler alternative serves equally well. Never propose additions — under-building is the phase loops' job. The bar: *would a senior engineer reviewing this say it's overbuilt relative to the concrete needs?*

Look for:
- New components, services, routes, or tables where extending an existing one works (verify the existing one in the code).
- Abstractions, interfaces, or indirection with a single implementation or caller.
- Configuration, extension points, feature flags, or generality no requirement asks for.
- Requirements, non-functionals, or edge-case handling the refined PRD added that the source PRD doesn't ask for and the feature works safely without.
- Milestones that can't ship value alone and should merge; tasks with no acceptance criterion tracing to a requirement.
- Tests or test levels beyond what the acceptance criteria and the repo's existing practice need.

Before proposing a cut, check it doesn't remove something that prevents a real failure — auth/permission checks, data-exposure protections, migration safety, concurrency handling, and backward compatibility usually do. Those aren't excess complexity; they're correctness.

**Output** — write `.loops/simplification.md` in the gate's phase folder (G1: `phase-1-requirements/`; G2: `phase-3-eng-specs/milestone-N/`; G3: `phase-5-validation/`), ranked by impact:

```markdown
# Simplification — <gate> — <scope>

## Proposals
### S-1 [design|scope] <short title>
- **Target:** <file> § <section>
- **Remove / replace:** <what>
- **Simpler alternative:** <what instead — or "nothing">
- **Still satisfies:** <source PRD section / requirement id>
- **Lost:** <what we give up, honestly>
- **Edit:** <exact replacement text, or a precise instruction the orchestrator can apply mechanically>
```

Tag each proposal `scope` (cuts or narrows a requirement or a milestone) or `design` (changes structure, components, tasks, or tests). If it finds nothing worth cutting, it says so — an empty gate is a valid result.

## Step 2 — Triage (quick, fresh subagent per tag)

Route by tag: **`scope` → Staff PM**, **`design` → Architect**. If both tags are present, run both triages in parallel, each on its own proposals only. Each triage gets the simplifier's proposals, the target artifacts, the source PRD, and the codebase — not the `.loops/` trail.

**This is a quick review, not a new loop.** No re-analysis, no counter-proposals.

**The default is accept.** A triage may reject a proposal only by citing one of:
- a source-PRD requirement the cut would break (section / requirement id), or
- a codebase constraint that makes the simpler alternative unworkable (file + symbol, actually read), or
- a named failure mode the cut would introduce (e.g. "drops the idempotency key, so a retried job double-charges" — concrete, not "less robust").

"Best practice", "future flexibility", or "it's cleaner" are not grounds to reject. If the triage genuinely can't tell, mark it `unsure`.

Triage appends to the same `.loops/simplification.md`:

```markdown
## Triage — <Staff PM | Architect>
| ID | Decision | Citation / reason (one line) |
|----|----------|------------------------------|
| S-1 | accept | — |
| S-2 | reject | PRD §3.2 requires per-tenant export; shared job can't scope by tenant |
| S-3 | unsure | depends on whether audit log is required for SOC 2 evidence |
```

## Step 3 — Apply (orchestrator)

- **Accepted:** the orchestrator applies each proposal's `Edit` to the final artifact(s) directly. If a cut touches several files (G3 especially), apply it to all of them consistently; if it removes or merges a milestone, update `manifest.yaml` and `00-index.md`.
- **Rejected:** stays in `.loops/simplification.md` with its citation. No other action.
- **Unsure:** not applied. Add it to `manifest.yaml` `open_decisions` with `blocking: false` and to `00-index.md`, so a human can make the call without stalling execution.

**One round only.** Don't re-run the simplifier on the simplified artifact, and don't send accepted cuts back through the phase loops.

## Cost

Both steps are cheap relative to a phase loop. Give the simplifier a soft budget (~60k tokens of file reads — it only needs to verify that existing code can absorb a proposed reuse) and keep triage prompts to the proposals plus the cited files.
