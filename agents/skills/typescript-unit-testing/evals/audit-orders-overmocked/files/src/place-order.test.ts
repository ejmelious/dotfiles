import { beforeAll, describe, expect, it, vi } from 'vitest';
import { notifyOrderPlaced } from './notifier';
import { findCustomer, saveOrder } from './order-repo';
import { CustomerNotFound, placeOrder } from './place-order';
import { priceOrder } from './pricing';

vi.mock('./pricing');
vi.mock('./order-repo');
vi.mock('./notifier');

const lines = [{ sku: 'MUG', quantity: 3, unitPriceCents: 20_00 }];
const newId = () => 'ord_1';

describe('placeOrder', () => {
  beforeAll(() => {
    vi.mocked(findCustomer).mockResolvedValue({ id: 'cus_1', email: 'ada@example.com', coupon: 'SAVE10' });
    vi.mocked(priceOrder).mockReturnValue(54_00);
    vi.mocked(saveOrder).mockResolvedValue(undefined);
    vi.mocked(notifyOrderPlaced).mockResolvedValue(undefined);
  });

  it('looks up the customer', async () => {
    await placeOrder('cus_1', lines, newId);
    expect(findCustomer).toHaveBeenCalledWith('cus_1');
    expect(findCustomer).toHaveBeenCalledTimes(1);
  });

  it('prices the order', async () => {
    const order = await placeOrder('cus_1', lines, newId);
    expect(priceOrder).toHaveBeenCalledWith(lines, 'SAVE10');
    expect(order.totalCents).toBe(54_00);
  });

  it('saves the order', async () => {
    await placeOrder('cus_1', lines, newId);
    expect(saveOrder).toHaveBeenCalledWith({ id: 'ord_1', customerId: 'cus_1', lines, totalCents: 54_00 });
  });

  it('emails the customer after saving', async () => {
    await placeOrder('cus_1', lines, newId);
    expect(notifyOrderPlaced).toHaveBeenCalledWith('ada@example.com', 'ord_1');
    expect(saveOrder).toHaveBeenCalledBefore(vi.mocked(notifyOrderPlaced));
  });

  it('throws when the customer does not exist', async () => {
    vi.mocked(findCustomer).mockResolvedValue(null);
    await expect(placeOrder('cus_missing', lines, newId)).rejects.toThrow(CustomerNotFound);
    expect(saveOrder).not.toHaveBeenCalled();
  });
});
