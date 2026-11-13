import { notifyOrderPlaced } from './notifier';
import { findCustomer, saveOrder, type Order } from './order-repo';
import { priceOrder, type OrderLine } from './pricing';

export class CustomerNotFound extends Error {}

export async function placeOrder(customerId: string, lines: readonly OrderLine[], newId: () => string): Promise<Order> {
  const customer = await findCustomer(customerId);
  if (!customer) throw new CustomerNotFound(customerId);
  const order: Order = { id: newId(), customerId, lines, totalCents: priceOrder(lines, customer.coupon) };
  await saveOrder(order);
  await notifyOrderPlaced(customer.email, order.id);
  return order;
}
