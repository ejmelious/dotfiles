export interface Cart {
  id: string;
  customerId: string;
  status: 'open' | 'checked_out';
  lines: ReadonlyArray<{ sku: string; quantity: number; unitPriceCents: number }>;
}

/** Your own database table of carts. */
export interface CartRepository {
  findById(id: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}

/** Third-party payment provider (Stripe-like). Charges are real money. */
export interface PaymentGateway {
  charge(request: { customerId: string; amountCents: number; idempotencyKey: string }): Promise<{ chargeId: string }>;
}

export class CartNotFound extends Error {}
export class CartAlreadyCheckedOut extends Error {}
export class EmptyCart extends Error {}

export type CheckoutResult = { chargeId: string; totalCents: number };

const FREE_SHIPPING_THRESHOLD_CENTS = 50_00;
const SHIPPING_CENTS = 4_99;

export function cartTotalCents(cart: Cart): number {
  const items = cart.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  return items >= FREE_SHIPPING_THRESHOLD_CENTS ? items : items + SHIPPING_CENTS;
}

export async function checkout(
  deps: { carts: CartRepository; payments: PaymentGateway },
  cartId: string,
): Promise<CheckoutResult> {
  const cart = await deps.carts.findById(cartId);
  if (!cart) throw new CartNotFound(cartId);
  if (cart.status === 'checked_out') throw new CartAlreadyCheckedOut(cartId);
  if (cart.lines.length === 0) throw new EmptyCart(cartId);

  const totalCents = cartTotalCents(cart);
  const { chargeId } = await deps.payments.charge({
    customerId: cart.customerId,
    amountCents: totalCents,
    idempotencyKey: `checkout:${cart.id}`,
  });
  await deps.carts.save({ ...cart, status: 'checked_out' });
  return { chargeId, totalCents };
}
