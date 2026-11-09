/** Shipping for an order subtotal in cents. Domestic orders of $50.00 or more ship free. */
export class InvalidSubtotal extends Error {}

export const DOMESTIC_SHIPPING_CENTS = 5_99;
export const INTERNATIONAL_SHIPPING_CENTS = 15_00;

export function shippingCents(subtotalCents: number, country: string): number {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) throw new InvalidSubtotal(String(subtotalCents));
  if (country !== "US") return INTERNATIONAL_SHIPPING_CENTS;
  return subtotalCents >= 50_00 ? 0 : DOMESTIC_SHIPPING_CENTS;
}
