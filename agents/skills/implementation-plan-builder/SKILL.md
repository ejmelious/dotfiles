---
name: implementation-plan-builder
description: Transform a product requirements document (PRD) into a complete, codebase-grounded engineering implementation plan. Use this skill whenever the user wants to break a PRD or feature spec down into milestones, architect a solution against an existing codebase, or produce engineering specs, execution plans, test/quality strategies, or production validation plans. Trigger it whenever the user mentions turning requirements into an implementation plan, doing a system impact analysis, breaking a PRD into actionable milestones, or running a multi-persona (PM / engineer / architect) review of requirements — even when they only hand over a requirements doc and a repo and ask "how would we build this?" The structured three-loop process produces materially better results than ad hoc planning, so prefer it over answering from intuition.
---

# Implementation Plan Builder

Turn a PRD + an existing codebase into a complete, defensible engineering implementation plan. The plan is produced phase by phase. Most phases run a **three-loop review process** (author → ground against reality → pressure-test holistically); the loop mechanics are constant and the personas change per phase. **Phases 5 and 6 are deliberately truncated to a single review pass** — see their reference files.

## Inputs

1. **A PRD / requirements doc** — provided by the user (path, pasted text, or a linked doc).
2. **A codebase** — by default the current working repository. Explore it directly (read key entry points, route definitions, domain models, shared libs, test setup) during the implementation-facing loops. Never assume the codebase's shape — verify it.

If either input is missing or ambiguous, stop and ask before starting. Do not invent a PRD or guess at a codebase you cannot read.

## The pipeline

Run phases in order. Each phase consumes the prior phases' final artifacts plus the codebase, and emits its own. Do not start a phase until the prior phase's artifacts exist and the user has had a chance to review (unless they explicitly ask to run straight through).

| Phase | Name | Final artifact(s) | Loop personas (Author → Ground → Pressure-test) | Reference |
|-------|------|-------------------|--------------------------------------------------|-----------|
| 1 | Requirements Consumption & Breakdown | Refined PRD, System Impact Analysis, Holistic Architecture Plan | Staff PM → Sr. Engineer → Architect *(specified)* | `references/phase-1-requirements.md` |
| 2 | Milestone Breakdown | Ordered Milestone Plan | TPM → Tech Lead → EM *(validated)* | `references/phase-2-milestone-breakdown.md` |
| 3 | Engineering Spec & Architecture Review *(per milestone — full loop each)* | Eng Spec per milestone | Implementing Sr. Eng → Codebase/Domain Expert → **Architecture Review** *(validated)* | `references/phase-3-eng-spec-and-architecture-review.md` |
| 4 | Technical Execution Plan *(per milestone — full loop each)* | End-to-end technical execution plan w/ task definitions, per milestone | Tech Lead → Sr. Engineer (Codebase Expert) → **Architect** *(validated)* | `references/phase-4-execution-plan.md` |
| 5 | Quality & Test *(per milestone — single review)* | Test Plan per milestone (strategy, coverage, unit + e2e) | Test Architect — single quality review *(validated)* | `references/phase-5-quality-and-test.md` |
| 6 | Final End-to-End Validation & Sign-off *(whole plan — single pass)* | Final Validation & Sign-off | Architect — single end-to-end validation *(validated)* | `references/phase-6-validation.md` |

**Architecture review is not a standalone phase.** The holistic architecture is produced once in Phase 1 (the Architect loop). Each milestone's eng spec is then validated against it in Phase 3's third loop, with feedback folded back into the spec. When entering a phase, **read that phase's reference file in full before doing anything else.**

## The three-loop engine

This is the heart of the skill and is identical in every phase. Read **`references/loop-process.md`** before running any phase's loops. In brief:

- **Loop 1 — Author.** Adopt the phase's authoring persona and produce the first draft of the phase artifact.
- **Loop 2 — Ground.** Adopt the implementer persona. Stress the draft against reality — primarily the codebase and delivery constraints. Produce a critique + concrete revisions.
- **Loop 3 — Pressure-test.** Adopt the architect/senior-reviewer persona. Assess the whole holistically: is it well-architected, DRY, surgical where it can be and net-new only where it must be? Pressure-test both the artifact *and* Loop 2's grounding. Produce a critique + verdict.
- **Synthesis.** Fold accepted recommendations into the clean final artifact. Surface unresolved tensions for human decision rather than silently resolving them.

**Independence matters.** Prefer running each loop as an independent subagent with a fresh context so later loops aren't anchored by earlier reasoning. If subagents aren't available, run them as sequential passes but explicitly re-anchor on the persona and re-derive conclusions from the inputs, not from the prior loop's framing.

## Output structure

Every initiative gets its own **feature folder** under `.ai-dev/implementation-plan/`. A **manifest.yaml** at the root catalogs the feature(s) and points back into the folder structure. The skill creates both at session start (see next section).

```
.ai-dev/implementation-plan/
├── manifest.yaml                       # feature catalog — created at session start, updated end of each phase
└── <feature-slug>/                     # kebab-case slug derived from the feature name
    ├── 00-index.md                     # running index: phase status, artifact links, open decisions
    ├── phase-1-requirements/
    │   ├── refined-prd.md
    │   ├── system-impact-analysis.md
    │   ├── holistic-architecture.md
    │   └── .loops/                     # preserved raw loop outputs (traceability)
    │       ├── loop-1-staff-pm.md
    │       ├── loop-2-sr-engineer.md
    │       └── loop-3-architect.md
    ├── phase-2-milestone-breakdown/
    │   └── milestone-plan.md  + .loops/
    ├── phase-3-eng-specs/              # one sub-folder per milestone, full loop each
    │   ├── milestone-1/  eng-spec.md  + .loops/{loop-1-author, loop-2-grounding, loop-3-architecture-review}.md
    │   └── milestone-2/  ...
    ├── phase-4-execution/              # one sub-folder per milestone, full loop each
    │   ├── milestone-1/  execution-plan.md  + .loops/{loop-1-tech-lead, loop-2-sr-engineer, loop-3-architect}.md
    │   └── milestone-2/  ...
    ├── phase-5-quality/                # one sub-folder per milestone, single review each
    │   ├── milestone-1/  test-plan.md
    │   └── milestone-2/  ...
    └── phase-6-validation/
        └── final-validation.md         # one whole-plan validation & sign-off
```

Keep final artifacts clean and executive-readable. Keep the `.loops/` critiques raw and complete. Update `<feature-slug>/00-index.md` AND `manifest.yaml` at the end of every phase.

## Session start — feature folder + manifest (mandatory)

Before Phase 1's loops fire, the orchestrator does three things:

1. **Confirm the feature name with the user** if it's not explicit. Derive it from the PRD title if unambiguous; otherwise ask one short question.
2. **Derive the kebab-case slug** (lowercase, hyphens, no punctuation) — e.g. "Project Client Support in HIP" → `project-client-support`. If a folder of that slug already exists under `.ai-dev/implementation-plan/`, ask the user before overwriting.
3. **Create `.ai-dev/implementation-plan/<feature-slug>/`** and write a skeleton `manifest.yaml` at `.ai-dev/implementation-plan/manifest.yaml`.

### Manifest schema

The manifest is YAML. Required fields:

```yaml
feature_name: <human-readable name from PRD>
source_prd: <absolute path or URL>
target_repo: <repo name>
folder: <feature-slug>              # same slug used for the folder
status: in_progress                  # in_progress | complete
signed_off: false                    # set to true after Phase 6
signed_off_date: null                # ISO date when Phase 6 signs off
milestones: []                       # filled by Phase 2; dependency-ordered
open_decisions: []                   # filled across phases; each entry: {summary, blocking: true|false}
                                     # blocking: true = the executor must not run until a human settles it
out_of_scope_findings: []            # optional — security/hygiene issues surfaced but not in scope
```

After Phase 2, each milestone in `milestones` carries: `id`, `name`, `size`, `depends_on: [<other ids>]`, `status: not_started`, plus pointers to its eng spec / execution plan / test plan as those land.

After Phase 6, set `status: complete`, `signed_off: true`, `signed_off_date: <ISO>`.

### When the manifest gets touched

- **Session start:** create with skeleton (Phase 1 about to begin).
- **End of Phase 2:** fill `milestones` with dependency order, sizes, and basic metadata.
- **End of Phase 3:** add `artifacts.eng_spec` per milestone.
- **End of Phase 4:** add `artifacts.execution_plan` + `pr_strategy` per milestone.
- **End of Phase 5:** add `artifacts.test_plan` per milestone.
- **End of Phase 6:** flip `status`, `signed_off`, `signed_off_date`; add anything Phase 6 surfaced to `open_decisions` or `out_of_scope_findings`.

### Multi-feature handling

If `manifest.yaml` already exists at session start with a **different** feature, wrap the existing single-feature shape in a top-level `features:` list and append the new feature as a sibling entry. The folder structure stays the same: each feature gets its own `<feature-slug>/` directory. Both manifest shapes (singleton and multi-feature list) are valid; convert from singleton to list lazily, only when a second feature appears.

### Orchestrator writes the manifest directly

The manifest is a structured artifact derived from work the loops already produced. The orchestrator writes and updates it directly — no subagent needed. Keep it concise; it's an index, not a document.

## Operating principles

These hold across every phase and override convenience:

- **Traceability over fluency.** Every status, claim, date, dependency, and design assertion must trace to the PRD, an explicit codebase reference (file/path/symbol), or a prior artifact. If something can't be traced, flag it as an assumption or open question — never present it as fact.
- **No fabrication.** Do not invent file names, APIs, components, or codebase facts. When you reference the codebase, you must have actually read it. If you couldn't read part of it, say so.
- **DRY and surgical-first.** Default to reusing and extending what exists. Justify every new component, route, service, or surface area against the alternative of extending an existing one.
- **Surface tensions, don't bury them.** When loops disagree on something material, the final artifact names the disagreement and the options — it does not paper over it.
- **Executive voice.** Concise, direct, every word earning its place. No hedging, no filler.

## Cost-aware execution

The three-loop pattern is token-expensive. See `references/loop-process.md` §Cost-aware execution for the full guidance. In brief:

- **Slim per-loop prompts.** Subagents read the skill references directly. The orchestrator's per-loop prompt is for invocation specifics only (which milestone, input files, what to pressure-test for this run) — not for re-stating the rules.
- **Parallelize across milestones** in per-milestone phases (3, 4, 5) where loops are independent. All N Loop-1s fire in parallel; then all N Loop-2s; then all N Loop-3s. Wall-clock drops by ~Nx.
- **Soft token budget per subagent.** Pass a budget heuristic (e.g., "stay under ~120k tokens of file reads") and instruct the subagent to write its files even if incomplete. Loop 2 in particular benefits.
- **Size-adaptive loop count where the phase allows it.** Phase 4 supports a 2-loop fast-path for size-S milestones. Phases 1–3 always run full 3-loop because the architectural surface is novel each time.

## Where to go next

- Running any phase → read `references/loop-process.md`, then the phase's own reference file.
- Phase 1 specifically → `references/phase-1-requirements.md` (fully specified).
- Architecture review → lives inside Phase 3 (`references/phase-3-eng-spec-and-architecture-review.md`), validating each milestone's eng spec against the Phase 1 holistic architecture.
- Phases 2–6 → each phase's personas and loop count are finalized; the reference file is authoritative.
