import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCents } from './money.ts';

test('formats cents as dollars', () => {
  assert.equal(formatCents(1999), '$19.99');
});
