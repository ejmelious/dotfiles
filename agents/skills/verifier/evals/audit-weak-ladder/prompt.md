---
tags: [verifier]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

I'm trying to get our billing service to the point where agents can ship changes without me reviewing every line. Can you map what verifiers we actually have against the ladder and tell me the two biggest gaps? Repo is the current directory. Report only, no code changes.

Input files: package.json, tsconfig.json, eslint.config.js, src/db.ts, src/ledger.ts, src/refunds.ts, src/ledger.test.ts, .github/workflows/ci.yml
