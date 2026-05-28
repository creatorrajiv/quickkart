/**
 * Coupons Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Customer: validate code on cart, see live discount preview
 *  Admin:    CRUD on coupons table
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Validate a code against the current cart subtotal.
 * Returns a JSONB shape:
 *   { valid: true,  coupon_id, code, discount_amount, message }
 *   { valid: false, message }
 */
export async function validateCoupon(code, subtotal) {
  const { data, error } = await supabase.rpc('validate_coupon', {
    p_code:     code.trim().toUpperCase(),
    p_subtotal: subtotal,
  });
  if (error) return { valid: false, message: error.message };
  return data ?? { valid: false, message: 'Unknown error' };
}

// ─── Admin ─────────────────────────────────────────────────────────────────
export async function fetchAllCoupons() {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createCoupon(input) {
  const payload = { ...input, code: input.code?.trim().toUpperCase() };
  const { data, error } = await supabase.from('coupons').insert(payload).select().single();
  return { data, error };
}

export async function updateCoupon(id, updates) {
  if (updates.code) updates.code = updates.code.trim().toUpperCase();
  const { data, error } = await supabase.from('coupons').update(updates).eq('id', id).select().single();
  return { data, error };
}

export async function deleteCoupon(id) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  return { error };
}
