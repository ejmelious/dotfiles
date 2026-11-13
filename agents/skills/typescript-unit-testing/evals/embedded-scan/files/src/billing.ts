export interface LineItem {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export const BULK_DISCOUNT_THRESHOLD_CENTS = 100_00;
export const BULK_DISCOUNT_RATE = 0.1;

export function subtotalCents(items: readonly LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

/** Orders of $100.00 or more get 10% off, rounded down to the cent. */
export function discountCents(subtotal: number): number {
  return subtotal >= BULK_DISCOUNT_THRESHOLD_CENTS ? Math.floor(subtotal * BULK_DISCOUNT_RATE) : 0;
}

/** Splits a bill into near-equal integer shares that always add up to the total. */
export function splitBill(totalCents: number, people: number): number[] {
  if (!Number.isInteger(people) || people < 1) throw new RangeError('people must be a positive integer');
  const base = Math.floor(totalCents / people);
  const remainder = totalCents - base * people;
  return Array.from({ length: people }, (_, i) => base + (i < remainder ? 1 : 0));
}

export class InvalidWebhook extends Error {}

export interface PaymentEvent {
  type: 'payment.succeeded' | 'payment.failed';
  invoiceId: string;
  amountCents: number;
}

/** Parses an untrusted webhook body. */
export function parsePaymentEvent(body: unknown): PaymentEvent {
  if (typeof body !== 'object' || body === null) throw new InvalidWebhook('body must be an object');
  const b = body as Record<string, unknown>;
  if (b.type !== 'payment.succeeded' && b.type !== 'payment.failed') throw new InvalidWebhook('unknown type');
  if (typeof b.invoiceId !== 'string' || b.invoiceId === '') throw new InvalidWebhook('invoiceId required');
  if (typeof b.amountCents !== 'number' || !Number.isInteger(b.amountCents) || b.amountCents < 0) {
    throw new InvalidWebhook('amountCents must be a non-negative integer');
  }
  return { type: b.type, invoiceId: b.invoiceId, amountCents: b.amountCents };
}

export interface InvoiceStore {
  markPaid(invoiceId: string, amountCents: number): Promise<void>;
}

export async function handlePaymentWebhook(store: InvoiceStore, body: unknown): Promise<'paid' | 'ignored'> {
  const event = parsePaymentEvent(body);
  if (event.type === 'payment.failed') return 'ignored';
  await store.markPaid(event.invoiceId, event.amountCents);
  return 'paid';
}
