/**
 * Admin Reviews Service
 * ──────────────────────────────────────────────────────────────────────────
 * Admin-only view of every review for moderation.
 */

import { supabase } from '../lib/supabaseClient';

export async function fetchAllReviews({ filter = 'all' } = {}) {
  let q = supabase
    .from('reviews')
    .select(`
      *,
      customer:profiles!reviews_customer_id_fkey ( id, full_name, email ),
      shop:shops!reviews_shop_id_fkey ( id, name ),
      agent:profiles!reviews_agent_id_fkey ( id, full_name )
    `)
    .order('created_at', { ascending: false });

  if (filter === 'hidden') q = q.eq('is_hidden', true);
  if (filter === 'visible') q = q.eq('is_hidden', false);

  const { data, error } = await q;
  return { data, error };
}

export async function hideReview(id, reason) {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      is_hidden:     true,
      hidden_reason: reason ?? null,
      moderated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function unhideReview(id) {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      is_hidden:     false,
      hidden_reason: null,
      moderated_at:  new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  return { error };
}
