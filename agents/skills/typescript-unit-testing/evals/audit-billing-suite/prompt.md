---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

can you go through the tests in src/billing.test.ts and tell me which ones are actually pulling their weight? I suspect a bunch of them are fluff, and I'd also like to know what important stuff isn't tested. Don't change any code yet, just tell me what you'd keep, fix or kill.

Input files: package.json, vitest.config.ts, src/billing.ts, src/billing.test.ts
