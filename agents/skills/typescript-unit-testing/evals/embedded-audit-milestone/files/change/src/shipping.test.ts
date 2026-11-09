import { describe, expect, it } from 'vitest';
import { InvalidSubtotal, shippingCents } from './shipping';

describe('shippingCents', () => {
  it('domestic orders over $50 ship free', () => {
    expect(shippingCents(60_00, 'US')).toBe(0);
  });

  it('small domestic orders pay shipping', () => {
    expect(shippingCents(20_00, 'US')).toBe(5_99);
  });

  it('international orders pay the flat rate', () => {
    expect(shippingCents(10_00, 'CA')).toBe(15_00);
    expect(shippingCents(100_00, 'CA')).toBe(15_00);
  });

  it('rejects a negative subtotal', () => {
    try {
      shippingCents(-1, 'US');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidSubtotal);
    }
  });
});
