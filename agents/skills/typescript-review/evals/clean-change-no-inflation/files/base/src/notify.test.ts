import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPlain } from './notify.ts';

test('renders plain text', () => {
  assert.equal(renderPlain({ userId: 'u1', message: 'hi' }), 'u1: hi');
});
