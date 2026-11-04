import test from 'node:test';
import assert from 'node:assert/strict';
import { cartReducer, initialCart } from './cart.ts';

test('adds and removes items', () => {
  const added = cartReducer(initialCart, { type: 'add', item: { sku: 'a', priceCents: 100, qty: 1 } });
  assert.equal(added.items.length, 1);
  assert.equal(cartReducer(added, { type: 'remove', sku: 'a' }).items.length, 0);
});
