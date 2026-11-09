# Eng Spec — Milestone 2: Shipping fees

## Task 2.1 — shippingQuote(order, deps) in src/shipping.ts (new file)

Computes the shipping fee for an order and records the quote.

- Domestic (country "US"): orders with a subtotal of $50.00 or more ship free; otherwise $5.99.
- International: the fee is the carrier rate for the destination country, fetched from the carrier's
  HTTP API through the `CarrierRates` interface (`getRateCents(country): Promise<number>`), plus a
  $2.00 handling fee.
- Each quote is written to the quotes table through the app's own `QuoteRepository`
  (`save(quote): Promise<void>`); quotes are read back by the checkout page.
- A negative or fractional subtotal throws `InvalidSubtotal`.
- If the carrier API fails, the error propagates and no quote is saved.

### Acceptance criteria
- AC-2.1a Domestic orders at or above $50.00 ship free; below pay $5.99.
- AC-2.1b International fee = carrier rate + 200 cents.
- AC-2.1c Invalid subtotals throw InvalidSubtotal and save nothing.
- AC-2.1d A carrier failure propagates and saves nothing.
- AC-2.1e Every successful quote is saved with orderId, country and feeCents.

### Verifier map (from the verifier skill)
All of AC-2.1a–e → unit tests (rung 3). The CarrierRates HTTP adapter itself → contract test (out of scope here).
