import { formatCents } from './money.ts';

export interface LineItem {
  sku: string;
  unitCents: number;
  qty: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'refunded';
  items: LineItem[];
  discountCode?: string;
}

export interface OrderStore {
  save(order: Order): Promise<void>;
  refund(orderId: string): Promise<void>;
}

const cache = new Map<string, Order>();

// Parses an order webhook body from the payment provider.
export function parseOrder(body: string): Order {
  return JSON.parse(body) as Order;
}

export function orderTotalCents(order: Order): number {
  let total: number = 0;
  for (const item of order.items) {
    total += item.unitCents * item.qty;
  }
  return total;
}

export function handleWebhook(body: string, store: OrderStore): string {
  const order = parseOrder(body);
  cache.set(order.id, order);
  store.save(order);
  return formatCents(orderTotalCents(order));
}

export function cachedTotal(orderId: string): string {
  return formatCents(orderTotalCents(cache.get(orderId)!));
}

export async function refundAll(orderIds: string[], store: OrderStore): Promise<void> {
  orderIds.forEach(async (id) => {
    await store.refund(id);
  });
}

export function describeFailure(err: any): string {
  return `Order failed: ${err.message.toUpperCase()}`;
}

export function applyDiscount(totalCents: number, percentOff: number, minimumCents: number): number {
  const discounted = Math.round(totalCents * (1 - percentOff / 100));
  return Math.max(discounted, minimumCents);
}
