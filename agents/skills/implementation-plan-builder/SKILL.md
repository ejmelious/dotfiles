---
name: implementation-plan-builder
description: Transform a product requirements document (PRD) into a complete, codebase-grounded engineering implementation plan. Use this skill whenever the user wants to break a PRD or feature spec down into milestones, architect a solution against an existing codebase, or produce engineering specs, execution plans, test/quality strategies, or production validation plans. Trigger it whenever the user mentions turning requirements into an implementation plan, doing a system impact analysis, breaking a PRD into actionable milestones, or running a multi-persona (PM / engineer / architect) review of requirements — even when they only hand over a requirements doc and a repo and ask "how would we build this?" The structured multi-loop process, with independent simplification reviews, produces materially better results than ad hoc planning, so prefer it over answering from intuition.
---

# Implementation Plan Builder

Turn a PRD + an existing codebase into a complete, defensible engineering implementation plan, sized to what the requirements and the system actually need. The plan is produced phase by phase. Phases run a multi-loop review (author → ground against reality → pressure-test). Review loops tend to add, so independent **simplification gates** act as the counterweight and catch over-building.

## Inputs

1. **A PRD / requirements doc** — provided by the user (path, pasted text, or a linked doc).
2. **A codebase** — by default the current working repository. Explore it directly (entry points, routes, domain models, shared libs, test setup). Never assume the codebase's shape — verify it.

If either input is missing or ambiguous, stop and ask before starting. Do not invent a PRD or guess at a codebase you cannot read.

## The pipeline

Run phases in order. Each phase consumes the prior phases' final artifacts plus the codebase. Do not start a phase until the prior phase's artifacts (and gate) are done and the user has had a chance to review, unless they ask to run straight through.

| Phase | Name | Final artifact(s) | Loops | Then | Reference |
|-------|------|-------------------|-------|------|-----------|
| 1 | Requirements & Architecture | Refined PRD, Holistic Architecture | Staff PM → Sr. Engineer → Architect | **G1** | `references/phase-1-requirements.md` |
| 2 | Milestone Breakdown | Milestone Plan | TPM → Tech Lead | — | `references/phase-2-milestone-breakdown.md` |
| 3 | Eng Spec, Tasks & Architecture Review *(per milestone)* | Eng Spec (design + tasks + commit plan) | Sr. Engineer → Codebase Expert → Architecture Review | **G2** per milestone | `references/phase-3-eng-spec-and-architecture-review.md` |
| 4 | Quality & Test *(per milestone)* | Test Plan | Test Architect — single pass | **G3** if 3+ milestones | `references/phase-4-quality-and-test.md` |
| 5 | Final Validation & Sign-off *(whole plan)* | Final Validation | Architect — single pass | — | `references/phase-5-validation.md` |

When entering a phase, **read that phase's reference file in full before doing anything else.**

## The loop engine

Read **`references/loop-process.md`** before running any phase. In brief:

- **Loop 1 — Author.** The phase's authoring persona produces the first draft.
- **Loop 2 — Ground.** The implementer persona stresses the draft against the codebase and delivery constraints; produces a critique + concrete revisions.
- **Loop 3 — Pressure-test.** The architect persona assesses the whole, audits Loop 2, names what's over-built and what's under-built, and gives a verdict.
- **Synthesis.** Fold accepted recommendations into the final artifact. Additions and removals both have to name the concrete need they serve or protect. Surface unresolved tensions as open decisions.

Run each loop as an independent subagent with a fresh context so later loops aren't anchored by earlier reasoning.

## Simplification gates

Read **`references/simplification-gate.md`** before the first gate. In brief: a fresh subagent that never sees the `.loops/` trail looks for over-building and proposes cuts only — no additions. A quick triage (Staff PM for scope cuts, Architect for design cuts) accepts by default and may reject only by citing a PRD requirement, a codebase constraint, or a named failure mode the cut would introduce. The orchestrator applies accepted cuts directly; `unsure` items become non-blocking open decisions. One round per gate.

- **G1** after Phase 1 — on the refined PRD + architecture. Highest leverage.
- **G2** after each Phase 3 eng spec — parallel within a dependency layer.
- **G3** before Phase 5 — whole plan, only when there are 3+ milestones.

## Output structure

Every initiative gets its own **feature folder** under `.ai-dev/implementation-plan/`, catalogued by a shared **manifest.yaml**.

```
.ai-dev/implementation-plan/
├── manifest.yaml                       # feature catalog — created at session start, updated end of each phase
└── <feature-slug>/
    ├── 00-index.md                     # running index: phase status, artifact links, open decisions
    ├── phase-1-requirements/
    │   ├── refined-prd.md
    │   ├── holistic-architecture.md
    │   └── .loops/{loop-1-staff-pm, loop-2-sr-engineer, loop-3-architect, simplification}.md
    ├── phase-2-milestone-breakdown/
    │   ├── milestone-plan.md
    │   └── .loops/{loop-1-tpm, loop-2-tech-lead}.md
    ├── phase-3-eng-specs/
    │   ├── milestone-1/  eng-spec.md  + .loops/{loop-1-author, loop-2-grounding, loop-3-architecture-review, simplification}.md
    │   └── milestone-2/  ...
    ├── phase-4-quality/
    │   ├── milestone-1/  test-plan.md
    │   └── milestone-2/  ...
    └── phase-5-validation/
        ├── final-validation.md
        └── .loops/simplification.md    # G3, when run
```

Keep final artifacts clean and executive-readable. Keep `.loops/` raw and complete. Update `00-index.md` and `manifest.yaml` at the end of every phase.

## Session start — feature folder + manifest (mandatory)

Before Phase 1's loops fire, the orchestrator:

1. **Confirms the feature name** if it's not explicit. Derive it from the PRD title if unambiguous; otherwise ask one short question.
2. **Derives the kebab-case slug** — e.g. "Project Client Support in HIP" → `project-client-support`. If that folder already exists, ask before overwriting.
3. **Creates `.ai-dev/implementation-plan/<feature-slug>/`** and a skeleton `.ai-dev/implementation-plan/manifest.yaml`.

### Manifest schema

```yaml
feature_name: <human-readable name from PRD>
source_prd: <absolute path or URL>
target_repo: <repo name>
folder: <feature-slug>
status: in_progress                  # in_progress | complete
signed_off: false                    # set to true after Phase 5
signed_off_date: null                # ISO date when Phase 5 signs off
milestones: []                       # filled by Phase 2; dependency-ordered
open_decisions: []                   # each entry: {summary, blocking: true|false}
                                     # blocking: true = the executor must not run until a human settles it
out_of_scope_findings: []            # optional — security/hygiene issues surfaced but not in scope
```

After Phase 2, each milestone carries: `id`, `name`, `size`, `depends_on: [<ids>]`, `status: not_started`, plus artifact pointers as they land.

### When the manifest gets touched

- **Session start:** skeleton.
- **End of Phase 2:** `milestones` with dependency order, sizes, metadata.
- **End of Phase 3:** `artifacts.eng_spec` per milestone.
- **End of Phase 4:** `artifacts.test_plan` per milestone.
- **After any gate:** `unsure` items go to `open_decisions` with `blocking: false`; milestones removed or merged by a gate are updated.
- **End of Phase 5:** `status: complete`, `signed_off: true`, `signed_off_date`; anything Phase 5 surfaced goes to `open_decisions` or `out_of_scope_findings`.

### Multi-feature handling

If `manifest.yaml` already exists with a **different** feature, wrap the existing entry in a top-level `features:` list and append the new feature as a sibling. Both shapes are valid; convert lazily, only when a second feature appears.

The orchestrator writes the manifest directly — it's an index, not a document.

## Operating principles

These hold across every phase and override convenience:

- **Right-sized: the correct plan, not the smallest or the most thorough.** Plan everything the requirements and the real system demand, and nothing they don't. Under-building is as much a defect as over-building. Under-building means skipping a migration path, concurrency handling, or a permission check the data needs. Over-building means abstractions with one caller, configuration nobody asked for, or generality for hypothetical futures. Every element must answer "what concrete need does this serve?" Valid needs are a PRD requirement, a constraint in the codebase, or a named failure mode it prevents (data loss, a race, an unsafe rollout, load at real volume). "We might need it later", "best practice" and "it's cleaner" are not needs on their own; considered-and-rejected items go under "Not doing". Neither is "it's simpler" a reason to drop something that has a need.
- **Surgical-first.** Default to reusing and extending what exists. Justify every new component, route, service, or surface area against extending the closest existing one.
- **Traceability over fluency.** Every claim, dependency, and design assertion traces to the PRD, a codebase reference (file/path/symbol), or a prior artifact. Untraceable items are flagged as assumptions or open questions.
- **No fabrication.** Don't invent file names, APIs, or codebase facts. If you couldn't read part of the codebase, say so.
- **Surface tensions, don't bury them.** When loops disagree on something material, the final artifact names the disagreement and the options.
- **Executive voice.** Concise and direct. No hedging, no filler.

Cost guidance (slim prompts, parallelizing across milestones, token budgets) is in `references/loop-process.md` §Cost-aware execution.
