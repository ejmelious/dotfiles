---
type: llm
focus: trace
weight: 1
---

The review rates `orderIds.forEach(async ...)` in refundAll as Critical or High because refundAll resolves before refunds finish and rejections are lost
