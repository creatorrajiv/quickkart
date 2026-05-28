/**
 * Cart Reducer (Pure)
 * ──────────────────────────────────────────────────────────────────────────
 *  Cart items are keyed by `cartKey` so the same product with different
 *  variants can coexist in the cart as separate line items.
 *
 *  Item shape:
 *    {
 *      cartKey:       string   — unique per (product, variant)
 *      productId:     string   — parent product UUID
 *      variantId:     string|null
 *      variantLabel:  string|null
 *      name:          string
 *      price:         number   — variant.price OR product.price snapshot
 *      image_url:     string|null
 *      category:      string|null
 *      quantity:      number
 *    }
 *
 *  Backward-compat: cart items saved BEFORE this refactor only had
 *  productId, no cartKey. The HYDRATE action backfills the cartKey for
 *  these so the new logic still finds them.
 */

export const CART_ACTIONS = {
  HYDRATE:         'HYDRATE',
  ADD_ITEM:        'ADD_ITEM',
  REMOVE_ITEM:     'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART:      'CLEAR_CART',
};

export const cartInitialState = { items: [] };

/** Derive the unique cart key from an item. */
export function deriveCartKey(item) {
  return item.variantId ? `${item.productId}::${item.variantId}` : item.productId;
}

function normalize(item) {
  if (item.cartKey) return item;
  return { ...item, cartKey: deriveCartKey(item) };
}

export function cartReducer(state, action) {
  switch (action.type) {
    case CART_ACTIONS.HYDRATE: {
      const payload = action.payload;
      if (!payload || !Array.isArray(payload.items)) return cartInitialState;
      return { items: payload.items.map(normalize) };
    }

    case CART_ACTIONS.ADD_ITEM: {
      const incoming = normalize({
        ...action.payload,
        quantity: action.payload.quantity ?? 1,
      });
      const existing = state.items.find(i => i.cartKey === incoming.cartKey);
      if (existing) {
        return {
          items: state.items.map(i =>
            i.cartKey === incoming.cartKey
              ? { ...i, quantity: i.quantity + incoming.quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, incoming] };
    }

    case CART_ACTIONS.REMOVE_ITEM:
      return {
        items: state.items.filter(i => i.cartKey !== action.payload),
      };

    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { cartKey, quantity } = action.payload;
      if (quantity <= 0) {
        return { items: state.items.filter(i => i.cartKey !== cartKey) };
      }
      return {
        items: state.items.map(i =>
          i.cartKey === cartKey ? { ...i, quantity } : i,
        ),
      };
    }

    case CART_ACTIONS.CLEAR_CART:
      return cartInitialState;

    default:
      return state;
  }
}
