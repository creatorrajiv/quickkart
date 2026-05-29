/**
 * Subscriptions Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Customer-owned recurring order templates.
 */

import { supabase } from '../lib/supabaseClient';

export async function fetchMySubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Save a cart as a new subscription.
 *
 * @param {Object} input
 * @param {string} input.userId
 * @param {string} input.name              - friendly label
 * @param {Array}  input.items             - cart items (productId, variantId, etc.)
 * @param {string} input.deliveryAddress
 * @param {string} input.paymentMethod     - 'cod' | 'online'
 * @param {number} input.frequencyDays     - 1..365
 */
export async function createSubscription(input) {
  const items = (input.items ?? []).map(i => ({
    product_id:    i.productId,
    variant_id:    i.variantId    ?? null,
    variant_label: i.variantLabel ?? null,
    quantity:      i.quantity,
    price_at_save: i.price,
    name:          i.name,
  }));
  const { data, error } = await supabase.from('subscriptions').insert({
    customer_id:      input.userId,
    name:             input.name?.trim() || 'My subscription',
    items,
    delivery_address: input.deliveryAddress ?? null,
    payment_method:   input.paymentMethod ?? 'cod',
    frequency_days:   Math.max(1, Math.min(365, Number(input.frequencyDays) || 7)),
    next_run_at:      new Date(Date.now() + (Number(input.frequencyDays) || 7) * 86_400_000).toISOString(),
  }).select().single();
  return { data, error };
}

export async function updateSubscription(id, updates) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteSubscription(id) {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  return { error };
}

/** Manually trigger the subscription — creates an order at current prices. */
export async function runSubscription(id) {
  const { data, error } = await supabase.rpc('run_subscription', {
    p_subscription_id: id,
  });
  return { data, error };
}
