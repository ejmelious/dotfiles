import { describe, expect, it } from 'vitest';
import { priceOrder } from './pricing';

describe('priceOrder', () => {
  it('sums the lines', () => {
    expect(priceOrder([{ sku: 'A', quantity: 2, unitPriceCents: 10_00 }], null)).toBe(20_00);
  });

  it('applies SAVE10 to a large order', () => {
    expect(priceOrder([{ sku: 'A', quantity: 1, unitPriceCents: 80_00 }], 'SAVE10')).toBe(72_00);
  });
});
