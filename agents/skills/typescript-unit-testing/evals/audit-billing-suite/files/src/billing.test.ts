import { describe, expect, it, vi } from 'vitest';
import {
  BULK_DISCOUNT_RATE,
  BULK_DISCOUNT_THRESHOLD_CENTS,
  InvalidWebhook,
  discountCents,
  handlePaymentWebhook,
  parsePaymentEvent,
  splitBill,
  subtotalCents,
  type InvoiceStore,
} from './billing';

describe('subtotalCents', () => {
  it('adds up line items', () => {
    expect(
      subtotalCents([
        { sku: 'A', quantity: 2, unitPriceCents: 250 },
        { sku: 'B', quantity: 1, unitPriceCents: 1000 },
      ]),
    ).toBe(1500);
  });

  it('is zero for an empty order', () => {
    expect(subtotalCents([])).toBe(0);
  });
});

describe('discountCents', () => {
  it('gives the bulk discount on large orders', () => {
    const subtotal = 250_00;
    expect(discountCents(subtotal)).toBe(Math.floor(subtotal * BULK_DISCOUNT_RATE));
  });

  it('gives the bulk discount on a big order', () => {
    expect(discountCents(300_00)).toBe(30_00);
  });

  it('gives the bulk discount on a really big order', () => {
    expect(discountCents(500_00)).toBe(50_00);
  });

  it('gives no discount on small orders', () => {
    expect(discountCents(20_00)).toBe(0);
  });

  it('threshold constant is $100', () => {
    expect(BULK_DISCOUNT_THRESHOLD_CENTS).toBe(10000);
  });
});

describe('splitBill', () => {
  it('splits a bill', () => {
    const shares = splitBill(1000, 3);
    expect(shares).toBeDefined();
    expect(shares.length).toBeTruthy();
  });

  it('rejects zero people', () => {
    expect(() => splitBill(1000, 0)).toThrow(RangeError);
  });
});

describe('parsePaymentEvent', () => {
  it('parses a valid event', () => {
    expect(parsePaymentEvent({ type: 'payment.succeeded', invoiceId: 'in_1', amountCents: 5000 })).toEqual({
      type: 'payment.succeeded',
      invoiceId: 'in_1',
      amountCents: 5000,
    });
  });

  it('rejects a body that is not an object', () => {
    try {
      parsePaymentEvent('nope');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidWebhook);
    }
  });
});

describe('handlePaymentWebhook', () => {
  it('rejects malformed webhooks', async () => {
    const store: InvoiceStore = { markPaid: vi.fn() };
    handlePaymentWebhook(store, { type: 'payment.succeeded', amountCents: 5000 }).catch((e) => {
      expect(e).toBeInstanceOf(InvalidWebhook);
    });
  });

  it('marks the invoice paid', async () => {
    const store = { markPaid: vi.fn<InvoiceStore['markPaid']>().mockResolvedValue(undefined) };
    const result = await handlePaymentWebhook(store, { type: 'payment.succeeded', invoiceId: 'in_1', amountCents: 5000 });
    expect(result).toBe('paid');
    expect(store.markPaid).toHaveBeenCalledWith('in_1', 5000);
  });

  it('handles failed payments', async () => {
    const store: InvoiceStore = { markPaid: vi.fn() };
    await handlePaymentWebhook(store, { type: 'payment.failed', invoiceId: 'in_1', amountCents: 5000 });
  });
});
