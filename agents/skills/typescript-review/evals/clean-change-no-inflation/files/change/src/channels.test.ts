import test from 'node:test';
import assert from 'node:assert/strict';
import { describeChannel, parseChannel, preview } from './channels.ts';

test('parses valid channels', () => {
  const r = parseChannel({ kind: 'sms', phone: '+15551234567' });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(describeChannel(r.value), 'sms to +15551234567');
});

test('rejects invalid channels', () => {
  assert.deepEqual(parseChannel({ kind: 'fax' }), { ok: false, error: 'unknown channel kind: fax' });
  assert.equal(parseChannel(null).ok, false);
  assert.equal(parseChannel({ kind: 'webhook', url: 'not a url' }).ok, false);
});

test('truncates previews to the channel limit', () => {
  const n = { userId: 'u', message: 'x'.repeat(200) };
  assert.equal(preview(n, { kind: 'sms', phone: '+15551234567' }).length, 160);
});
