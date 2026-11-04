import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWebhook, cachedTotal, applyDiscount, type OrderStore } from './orders.ts';

const store: OrderStore = {
  save: async () => {},
  refund: async () => {},
};

const body = JSON.stringify({
  id: 'o1',
  status: 'paid',
  items: [{ sku: 'a', unitCents: 500, qty: 2 }],
});

test('handles a webhook and returns the total', () => {
  assert.equal(handleWebhook(body, store), '$10.00');
});

test('reads a cached total', () => {
  assert.equal(cachedTotal('o1'), '$10.00');
});

test('applies a discount with a floor', () => {
  assert.equal(applyDiscount(1000, 10, 500), 900);
});
