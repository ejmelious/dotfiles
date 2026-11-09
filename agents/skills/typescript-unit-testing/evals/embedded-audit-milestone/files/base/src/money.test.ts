import { expect, it } from 'vitest';
import { formatCents } from './money';

it('formats cents as dollars', () => {
  expect(formatCents(1234)).toBe('$12.34');
});
