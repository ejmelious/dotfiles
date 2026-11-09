export interface OrderLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

/** SAVE10 takes 10% off orders of $50.00 or more. Unknown coupons are ignored. */
export function priceOrder(lines: readonly OrderLine[], coupon: string | null): number {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  if (coupon === 'SAVE10' && subtotal >= 50_00) return Math.round(subtotal * 0.9);
  return subtotal;
}
