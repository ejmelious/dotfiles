---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

You are the milestone worker for milestone 2 of an implementation-plan-executor run, on task 2.1. The code in src/shipping.ts is already implemented. Write its unit tests by running the typescript-unit-testing skill in embedded write mode.

- Workspace: the current directory
- Unit test design: plan/test-plan.md, task 2.1
- Probe log: .ai-dev/probes.jsonl

Do not commit. Return one line per test as the embedded mode specifies.

Input files: package.json, vitest.config.ts, src/shipping.ts, plan/test-plan.md
