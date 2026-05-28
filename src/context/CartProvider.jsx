/**
 * CartProvider
 * ──────────────────────────────────────────────────────────────────────────
 * React Context that owns cart state via useReducer.
 *
 * Responsibilities:
 *  1. Hold the cart in memory (single source of truth in the React tree).
 *  2. Hydrate from persistent storage on first mount (page refresh persistence).
 *  3. Auto-persist to storage on every mutation.
 *  4. Expose a clean useCart() hook with pre-computed derived values
 *     (subtotal, item count) so components stay declarative.
 *
 * Decoupling:
 *  • Storage layer abstracted via src/lib/storage.js — swap to Capacitor
 *    Preferences later without touching this file.
 *  • Reducer lives in src/store/cartStore.js — pure and unit-testable.
 *  • Business math (totals) lives in src/config/business.js.
 *
 * Usage:
 *   // App root
 *   <CartProvider><App /></CartProvider>
 *
 *   // Anywhere inside
 *   const { items, count, subtotal, addItem, removeItem,
 *           updateQuantity, clearCart, isInCart, getQuantity } = useCart();
 */

import { createContext, useContext, useEffect, useReducer, useMemo, useCallback, useRef } from 'react';
import {
  cartReducer,
  cartInitialState,
  CART_ACTIONS,
  deriveCartKey,
} from '../store/cartStore';
import { storage, STORAGE_KEYS } from '../lib/storage';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, cartInitialState);

  // Track whether initial hydration has completed.
  // We use a ref instead of state so the auto-persist effect can skip
  // the very first render (otherwise we'd overwrite stored data with
  // the empty initial state).
  const hydratedRef = useRef(false);

  // ── Step 1: rehydrate cart from storage on first mount ────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      const saved = await storage.get(STORAGE_KEYS.CART);
      if (mounted && saved) {
        dispatch({ type: CART_ACTIONS.HYDRATE, payload: saved });
      }
      hydratedRef.current = true;
    })();
    return () => { mounted = false; };
  }, []);

  // ── Step 2: auto-persist any change after hydration completes ─────────────
  useEffect(() => {
    if (!hydratedRef.current) return;
    storage.set(STORAGE_KEYS.CART, state);
  }, [state]);

  // ── Action creators (stable references via useCallback) ───────────────────
  /**
   * Add a product to the cart (or increment if already present).
   * @param {{ productId:string, name:string, price:number, image_url?:string, category:string, quantity?:number }} item
   */
  const addItem = useCallback((item) => {
    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: item });
  }, []);

  /**
   * Remove a cart line. Accepts a cartKey, or a plain productId for
   * legacy callers (which still works for non-variant products since
   * cartKey === productId in that case).
   */
  const removeItem = useCallback((keyOrProductId) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: keyOrProductId });
  }, []);

  /**
   * Set an exact quantity for a line item.
   * A quantity ≤ 0 removes the item.
   * First arg accepts either a cartKey or a plain productId (same compat
   * note as removeItem).
   */
  const updateQuantity = useCallback((keyOrProductId, quantity) => {
    dispatch({
      type:    CART_ACTIONS.UPDATE_QUANTITY,
      payload: { cartKey: keyOrProductId, quantity },
    });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  }, []);

  // ── Derived values (memoised) ─────────────────────────────────────────────
  // Total number of items (sum of quantities, NOT unique line count).
  const count = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );

  // Cart subtotal — sum of price * quantity. Rounded to 2dp.
  const subtotal = useMemo(() => {
    const raw = state.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    return Math.round(raw * 100) / 100;
  }, [state.items]);

  // O(1) lookups for ProductCard quantity controls. For non-variant
  // products cartKey === productId so legacy callers keep working.
  // For variant products, callers should pass the derived cartKey.
  const getQuantity = useCallback(
    (keyOrProductId) => {
      const found = state.items.find(i =>
        i.cartKey === keyOrProductId || i.productId === keyOrProductId
      );
      return found?.quantity ?? 0;
    },
    [state.items]
  );

  const isInCart = useCallback(
    (keyOrProductId) => state.items.some(i =>
      i.cartKey === keyOrProductId || i.productId === keyOrProductId
    ),
    [state.items]
  );

  /** Expose the key derivation helper so callers can compute cartKey. */
  const getCartKey = useCallback(deriveCartKey, []);

  // ── Final context value ───────────────────────────────────────────────────
  const value = useMemo(() => ({
    // State
    items: state.items,
    count,
    subtotal,

    // Mutations
    addItem,
    removeItem,
    updateQuantity,
    clearCart,

    // Queries
    getQuantity,
    isInCart,
    getCartKey,
  }), [
    state.items, count, subtotal,
    addItem, removeItem, updateQuantity, clearCart,
    getQuantity, isInCart, getCartKey,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Hook for accessing the cart. Throws if used outside <CartProvider>. */
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart() must be used inside <CartProvider>.');
  return ctx;
}
