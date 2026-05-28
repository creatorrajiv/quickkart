/**
 * Reviews Service
 * ──────────────────────────────────────────────────────────────────────────
 * Customer rates the shop and/or the agent after an order is delivered.
 * One review per order (DB-enforced via UNIQUE constraint).
 */

import { supabase } from '../lib/supabaseClient';

export async function fetchReviewForOrder(orderId) {
  const { data, error } = await supabase
    .from('reviews').select('*').eq('order_id', orderId).maybeSingle();
  return { data, error };
}

/**
 * Submit (or upsert) a review.
 *
 * @param {Object} input
 * @param {string} input.order_id
 * @param {string} input.customer_id
 * @param {string|null} input.shop_id
 * @param {string|null} input.agent_id
 * @param {number|null} input.shop_rating   1..5
 * @param {number|null} input.agent_rating  1..5
 * @param {string} [input.comment]
 */
export async function submitReview(input) {
  const { data, error } = await supabase
    .from('reviews')
    .upsert(input, { onConflict: 'order_id' })
    .select()
    .single();
  return { data, error };
}

/** Aggregate rating for a shop — used on public storefront in the future. */
export async function shopRatingSummary(shopId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('shop_rating')
    .eq('shop_id', shopId)
    .not('shop_rating', 'is', null);
  if (error) return { avg: 0, count: 0, error };
  const count = data.length;
  const avg   = count === 0 ? 0 : data.reduce((s, r) => s + r.shop_rating, 0) / count;
  return { avg, count, error: null };
}
