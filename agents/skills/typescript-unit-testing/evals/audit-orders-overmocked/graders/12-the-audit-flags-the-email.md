---
type: llm
focus: trace
weight: 1
---

The audit flags the email failure path: a notifyOrderPlaced failure after a successful save is untested, or makes placeOrder throw even though the order was saved
