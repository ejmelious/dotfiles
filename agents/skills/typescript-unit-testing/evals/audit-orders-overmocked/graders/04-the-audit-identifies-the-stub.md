---
type: llm
focus: trace
weight: 1
---

The audit identifies the stub leak: mockResolvedValue(null) in the last test overrides the beforeAll default with no mockReset, so a different test order breaks other tests
