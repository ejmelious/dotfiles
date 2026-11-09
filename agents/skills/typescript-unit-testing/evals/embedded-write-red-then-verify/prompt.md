---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

You are the milestone worker for milestone 2 of an implementation-plan-executor run, on task 2.1 (new code: src/shipping.ts does not exist yet). Follow the per-task cycle for unit tests:
1. Run the typescript-unit-testing skill in embedded write mode, `red` phase, against plan/test-plan.md task 2.1.
2. Implement src/shipping.ts exactly as plan/eng-spec.md specifies.
3. Run the same skill in embedded write mode, `verify` phase. Probe log: .ai-dev/probes.jsonl

Do not commit. Return one line per test as the embedded mode specifies.

Input files: package.json, vitest.config.ts, src/index.ts, plan/eng-spec.md, plan/test-plan.md
