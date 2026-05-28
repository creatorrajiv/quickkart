/**
 * WishlistContext — Customer wishlist state with realtime updates
 * ──────────────────────────────────────────────────────────────────────────
 *   const { ids, toggle, busy } = useWishlist();
 *   const isFav = ids.has(product.id);
 *   <button onClick={() => toggle(product.id)}>...</button>
 *
 *  • Lazy-loads ids when the customer signs in
 *  • Optimistic update on toggle, with rollback on error
 *  • Single source of truth so the storefront heart and the /wishlist
 *    page stay in sync
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchWishlistIds, addToWishlist, removeFromWishlist,
} from '../services/wishlistService';
import { notify } from '../lib/notify';

const WishlistContext = createContext({
  ids: new Set(),
  toggle: () => {},
  busy: new Set(),
});

export function WishlistProvider({ children }) {
  const { session, profile } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [busy, setBusy] = useState(new Set());

  // Load on customer sign-in. Other roles don't need wishlist.
  useEffect(() => {
    if (!session?.user?.id || profile?.role !== 'customer') {
      setIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { ids: loaded } = await fetchWishlistIds();
      if (!cancelled) setIds(loaded);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id, profile?.role]);

  const toggle = useCallback(async (productId) => {
    if (!session?.user?.id) {
      notify.error('Sign in to save favourites');
      return;
    }
    if (busy.has(productId)) return;
    setBusy(prev => new Set(prev).add(productId));

    const wasIn = ids.has(productId);
    // Optimistic update
    setIds(prev => {
      const next = new Set(prev);
      if (wasIn) next.delete(productId); else next.add(productId);
      return next;
    });

    const op = wasIn
      ? removeFromWishlist(session.user.id, productId)
      : addToWishlist(session.user.id, productId);
    const { error } = await op;

    setBusy(prev => { const next = new Set(prev); next.delete(productId); return next; });

    if (error) {
      // Roll back
      setIds(prev => {
        const next = new Set(prev);
        if (wasIn) next.add(productId); else next.delete(productId);
        return next;
      });
      notify.error('Could not update wishlist', error.message);
    }
  }, [session?.user?.id, ids, busy]);

  return (
    <WishlistContext.Provider value={{ ids, toggle, busy }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
