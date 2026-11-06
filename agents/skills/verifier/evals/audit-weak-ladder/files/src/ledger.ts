import { db } from "./db";

export interface LineItem { amountCents: number; quantity: number }

export function invoiceTotalCents(items: LineItem[]): number {
  return items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);
}

export async function recordInvoice(customerId: string, items: LineItem[]) {
  await db.insert("invoices", { customerId, totalCents: invoiceTotalCents(items) });
}
