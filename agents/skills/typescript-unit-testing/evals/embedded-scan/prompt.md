---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

You are the Senior Engineer in Phase 1 of an implementation-plan-builder run. The PRD changes how payment webhooks are handled (handlePaymentWebhook and parsePaymentEvent in src/billing.ts); the milestones will rely on the existing tests as a safety net. Run the typescript-unit-testing skill in embedded scan mode over that blast radius and write its list to .ai-dev/unit-test-scan.md.

Input files: package.json, vitest.config.ts, src/billing.ts, src/billing.test.ts
