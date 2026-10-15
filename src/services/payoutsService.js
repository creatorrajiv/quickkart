/**
 * Payouts Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Admin pages call these to display the ledger and record actual payouts.
 */

import { supabase } from '../lib/supabaseClient';

/** Single round-trip summary for the admin payouts page. */
export async function fetchPayoutsSummary() {
  const { data, error } = await supabase.rpc('admin_payouts_summary');
  return { data, error };
}

/** Payout history for one shop. */
export async function fetchShopPayouts(shopId) {
  const { data, error } = await supabase
    .from('shop_payouts')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  return { data, error };
}

/** Payout history for one agent. */
export async function fetchAgentPayouts(agentId) {
  const { data, error } = await supabase
    .from('agent_payouts')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function recordShopPayout({ shopId, amount, method, reference, note }) {
  const { data, error } = await supabase
    .from('shop_payouts')
    .insert({ shop_id: shopId, amount, method, reference, note })
    .select()
    .single();
  return { data, error };
}

export async function recordAgentPayout({ agentId, amount, method, reference, note }) {
  const { data, error } = await supabase
    .from('agent_payouts')
    .insert({ agent_id: agentId, amount, method, reference, note })
    .select()
    .single();
  return { data, error };
}

export async function deleteShopPayout(id)  { return supabase.from('shop_payouts').delete().eq('id', id); }
export async function deleteAgentPayout(id) { return supabase.from('agent_payouts').delete().eq('id', id); }
