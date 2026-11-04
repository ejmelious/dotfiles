---
type: llm
focus: trace
weight: 1
---

The review identifies that isPromoItem returns true for every item (every CartItem has sku) so non-promo totals use an undefined promoPriceCents, and rates it Critical or High
