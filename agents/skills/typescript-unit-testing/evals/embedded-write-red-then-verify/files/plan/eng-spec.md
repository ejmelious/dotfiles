# Eng Spec — Milestone 2: Shipping fees

## Task 2.1 — shippingCents(subtotalCents, country) in src/shipping.ts (new file)

- Export `class InvalidSubtotal extends Error {}`.
- A subtotal that is negative or not an integer throws `InvalidSubtotal`.
- Country other than "US": flat 1500 cents.
- "US": subtotal of 5000 cents or more ships free; otherwise 599 cents.

Acceptance criteria AC-2.1a–c are in plan/test-plan.md.
