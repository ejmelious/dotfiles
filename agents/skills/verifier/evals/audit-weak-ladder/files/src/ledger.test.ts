import { describe, expect, it } from "vitest";
import { invoiceTotalCents } from "./ledger";

describe("invoiceTotalCents", () => {
  it("sums line items", () => {
    expect(invoiceTotalCents([{ amountCents: 500, quantity: 2 }])).toBe(1000);
  });
  it.skip("rejects negative quantities", () => {});
  it.skip("handles discounts", () => {});
});
