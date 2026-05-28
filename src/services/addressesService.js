/**
 * Addresses Service
 * ──────────────────────────────────────────────────────────────────────────
 * CRUD for customer_addresses. RLS limits every operation to the
 * signed-in user, so we don't need to pass a user_id from the client —
 * Postgres reads it from auth.uid().
 */

import { supabase } from '../lib/supabaseClient';

export async function fetchAddresses() {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function createAddress({ label, address, phone = null, is_default = false, user_id }) {
  // Caller passes user_id since RLS uses auth.uid() for the policy check,
  // but the column itself isn't auto-populated. supabase-js doesn't have
  // an "insert without specifying NOT NULL fields" mode here.
  if (is_default) {
    // Demote any existing default before inserting (partial unique index
    // would otherwise reject the insert).
    await supabase.from('customer_addresses').update({ is_default: false })
      .eq('user_id', user_id).eq('is_default', true);
  }
  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({ user_id, label, address, phone, is_default })
    .select()
    .single();
  return { data, error };
}

export async function updateAddress(id, updates, userId) {
  if (updates.is_default === true && userId) {
    await supabase.from('customer_addresses').update({ is_default: false })
      .eq('user_id', userId).eq('is_default', true).neq('id', id);
  }
  const { data, error } = await supabase
    .from('customer_addresses')
    .update(updates).eq('id', id).select().single();
  return { data, error };
}

export async function deleteAddress(id) {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  return { error };
}

export async function setDefaultAddress(id, userId) {
  return updateAddress(id, { is_default: true }, userId);
}
