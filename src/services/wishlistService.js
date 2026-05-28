/**
 * Wishlist Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Customer favourites — single boolean toggle per product.
 */

import { supabase } from '../lib/supabaseClient';

/** All wishlist items for the signed-in user, with full product detail. */
export async function fetchWishlist() {
  const { data, error } = await supabase
    .from('wishlist_items')
    .select(`
      created_at,
      product:products!wishlist_items_product_id_fkey (
        id, name, description, price, image_url, image_urls, is_available, category_id,
        category:product_categories!products_category_id_fkey ( id, name, slug, icon )
      )
    `)
    .order('created_at', { ascending: false });
  return { data, error };
}

/** Quick id list — used by storefront to render the heart in filled/empty state. */
export async function fetchWishlistIds() {
  const { data, error } = await supabase
    .from('wishlist_items').select('product_id');
  if (error) return { ids: new Set(), error };
  return { ids: new Set((data ?? []).map(r => r.product_id)), error: null };
}

export async function addToWishlist(userId, productId) {
  const { error } = await supabase
    .from('wishlist_items')
    .insert({ user_id: userId, product_id: productId });
  return { error };
}

export async function removeFromWishlist(userId, productId) {
  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  return { error };
}

/** Toggle helper — checks current state and flips it. */
export async function toggleWishlist(userId, productId, currentlyIn) {
  return currentlyIn
    ? removeFromWishlist(userId, productId)
    : addToWishlist(userId, productId);
}
