export interface CartItem {
  sku: string;
  priceCents: number;
  qty: number;
}

export interface PromoItem extends CartItem {
  promoPriceCents: number;
}

export interface CartState {
  items: CartItem[];
  checkoutStatus: string;
}

export type CartAction =
  | { type: 'add'; item: CartItem }
  | { type: 'remove'; sku: string }
  | { type: 'clear' };

export const initialCart: CartState = { items: [], checkoutStatus: 'idle' };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return { ...state, items: [...state.items, action.item] };
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.sku !== action.sku) };
    default:
      return state;
  }
}

// Called after a successful checkout so the next order starts empty.
export function afterCheckout(state: CartState): CartState {
  return cartReducer({ ...state, checkoutStatus: 'done' }, { type: 'clear' });
}

export function isPromoItem(item: CartItem): item is PromoItem {
  return 'sku' in item;
}

export function lineTotalCents(item: CartItem): number {
  const unit = isPromoItem(item) ? item.promoPriceCents : item.priceCents;
  return unit * item.qty;
}

export function cartTotalCents(state: CartState): number {
  return state.items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}
