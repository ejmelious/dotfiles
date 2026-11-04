import { renderPlain, type Notification } from './notify.ts';

export type Channel =
  | { readonly kind: 'email'; readonly address: string }
  | { readonly kind: 'sms'; readonly phone: string }
  | { readonly kind: 'webhook'; readonly url: URL };

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Parses one channel from untrusted JSON config.
export function parseChannel(input: unknown): ParseResult<Channel> {
  if (!isRecord(input)) return { ok: false, error: 'channel must be an object' };
  switch (input.kind) {
    case 'email':
      return typeof input.address === 'string' && input.address.includes('@')
        ? { ok: true, value: { kind: 'email', address: input.address } }
        : { ok: false, error: 'email channel needs an address' };
    case 'sms':
      return typeof input.phone === 'string' && /^\+\d{8,15}$/.test(input.phone)
        ? { ok: true, value: { kind: 'sms', phone: input.phone } }
        : { ok: false, error: 'sms channel needs an E.164 phone number' };
    case 'webhook':
      if (typeof input.url !== 'string' || !URL.canParse(input.url)) {
        return { ok: false, error: 'webhook channel needs a valid url' };
      }
      return { ok: true, value: { kind: 'webhook', url: new URL(input.url) } };
    default:
      return { ok: false, error: `unknown channel kind: ${String(input.kind)}` };
  }
}

export function describeChannel(channel: Channel): string {
  switch (channel.kind) {
    case 'email':
      return `email to ${channel.address}`;
    case 'sms':
      return `sms to ${channel.phone}`;
    case 'webhook':
      return `POST ${channel.url.href}`;
    default: {
      const unreachable: never = channel;
      return unreachable;
    }
  }
}

export const channelLimits = {
  email: 10_000,
  sms: 160,
  webhook: 65_536,
} as const satisfies Record<Channel['kind'], number>;

export function preview(n: Notification, channel: Channel): string {
  const text = renderPlain(n);
  const limit = channelLimits[channel.kind];
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
