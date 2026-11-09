---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

You are the unit-test reviewer (Reviewer C) at the review gate for milestone 2 of an implementation-plan-executor run. Run the typescript-unit-testing skill in embedded audit mode.

- Workspace: the current directory
- Commit range: main..m2
- Test plan: plan/test-plan.md (use its "Unit test design" section)
- Worker probe log: none was provided
- Report path: .ai-dev/test-audit.md
- Full-suite result: `npx vitest run` — 2 files, 5 tests passed

Report only: make no edits and no commits.
