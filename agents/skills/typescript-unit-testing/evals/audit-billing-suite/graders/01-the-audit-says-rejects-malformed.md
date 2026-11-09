---
type: llm
focus: trace
weight: 1
---

The audit says 'rejects malformed webhooks' cannot fail, because its assertion sits in an un-awaited .catch() callback
