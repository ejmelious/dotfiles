---
tags: [skill-creator]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

our place-order tests feel really brittle, every time someone touches placeOrder like half of them break, but bugs still get through. can you audit src/place-order.test.ts (and pricing.test.ts) and tell me what's wrong and what you'd do instead? report only for now

Input files: package.json, vitest.config.ts, src/pricing.ts, src/order-repo.ts, src/notifier.ts, src/place-order.ts, src/place-order.test.ts, src/pricing.test.ts
