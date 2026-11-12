# Test Plan — Milestone 2: Shipping fees

## Unit test design

### Task 2.1 — shippingCents (src/shipping.ts)

| Test (behaviour) | Criterion | Cases | Doubles | Oracle | Bugs to catch |
|---|---|---|---|---|---|
| domestic orders of $50.00 or more ship free | AC-2.1a | 49_99 → 5_99; 50_00 → 0; 50_01 → 0 | none (pure) | spec | `src/shipping.ts: ">= 50_00" → "> 50_00"` |
| international orders pay the flat rate | AC-2.1b | "CA" with 10_00 and 100_00 → 15_00 | none | spec | `src/shipping.ts: "country !== \"US\"" → "country === \"XX\""` |
| rejects a negative or fractional subtotal | AC-2.1c | -1, 10.5 → InvalidSubtotal | none | spec | `src/shipping.ts: "|| subtotalCents < 0" → ""` |

No unit test: the constants themselves (declarations).
