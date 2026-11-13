---
type: llm
focus: trace
weight: 1
---

The audit identifies that place-order.test.ts mocks the repo's own pure and persistence code (./pricing, ./order-repo) and explains why that makes the tests brittle and lets bugs through
