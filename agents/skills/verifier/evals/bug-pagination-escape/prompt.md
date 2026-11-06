---
tags: [verifier]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

we just shipped the fix for BUG-412 (details + the fix diff are in the repo root). before I close it out — which verifier would have caught this, and how do we make sure this kind of thing gets caught next time? don't change any code yet, just tell me what we should build

Input files: BUG-412.md, fix.diff, package.json, src/fetchAll.ts, src/fetchAll.test.ts, src/fetchers/client.ts, src/fetchers/devices.ts, src/fetchers/users.ts
