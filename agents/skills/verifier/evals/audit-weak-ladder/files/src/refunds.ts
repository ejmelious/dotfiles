import { db } from "./db";

export async function recordRefund(customerId: string, amountCents: number) {
  await db.insert("invoices", { customerId, totalCents: -amountCents });
}
