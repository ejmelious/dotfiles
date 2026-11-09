import type { OrderLine } from './pricing';

export interface Customer {
  id: string;
  email: string;
  coupon: string | null;
}

export interface Order {
  id: string;
  customerId: string;
  lines: readonly OrderLine[];
  totalCents: number;
}

// Stand-in for the app's Postgres access layer.
export async function findCustomer(_id: string): Promise<Customer | null> {
  throw new Error('findCustomer needs a database connection');
}

export async function saveOrder(_order: Order): Promise<void> {
  throw new Error('saveOrder needs a database connection');
}
