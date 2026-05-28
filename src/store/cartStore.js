/**
 * Cart Reducer (Pure)
 * ──────────────────────────────────────────────────────────────────────────
 * Pure reducer functions — no side effects, no I/O, no React.
 * This file is deliberately decoupled from any storage or context so it
 * can be unit-tested in isolation and replaced (Zustand/Redux) without
 * touching components.
 *
 * Cart item shape:
 *   {
 *     productId: string (uuid),
 *     name:      string,
 *     price:     number,    // unit price snapshotted at add-time
 *     image_url: string | null,
 *     category:  string,
 *     quantity:  number,
 *   }
 *
 * Adaptability notes:
 *  • Want server-side cart? Replace this reducer with API-backed mutations;
 *    consumers (useCart) keep the same signature.
 */

export const CART_ACTIONS = {
  HYDRATE:         'HYDRATE',          // restore from storage on app boot
  ADD_ITEM:        'ADD_ITEM',
  REMOVE_ITEM:     'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART:      'CLEAR_CART',
};

export const cartInitialState = { items: [] };

export function cartReducer(state, action) {
  switch (action.type) {
    // Replace state wholesale — used on first mount when restoring from storage
    case CART_ACTIONS.HYDRATE: {
      const payload = action.payload;
      if (!payload || !Array.isArray(payload.items)) return cartInitialState;
      return { items: payload.items };
    }

    case CART_ACTIONS.ADD_ITEM: {
      const product = action.payload;
      const existing = state.items.find(i => i.productId === product.productId);
      if (existing) {
        return {
          items: state.items.map(i =>
            i.productId === product.productId
              ? { ...i, quantity: i.quantity + (product.quantity ?? 1) }
              : i
          ),
        };
      }
      return {
        items: [...state.items, { ...product, quantity: product.quantity ?? 1 }],
      };
    }

    case CART_ACTIONS.REMOVE_ITEM:
      return {
        items: state.items.filter(i => i.productId !== action.payload),
      };

    case CART_ACTIONS.UPDATE_QUANTITY: {
      const { productId, quantity } = action.payload;
      // Guard: drop the line entirely if quantity falls to 0 or below
      if (quantity <= 0) {
        return { items: state.items.filter(i => i.productId !== productId) };
      }
      return {
        items: state.items.map(i =>
          i.productId === productId ? { ...i, quantity } : i
        ),
      };
    }

    case CART_ACTIONS.CLEAR_CART:
      return cartInitialState;

    default:
      return state;
  }
}
