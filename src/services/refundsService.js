/**
 * Refunds Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Admin-only refund actions. Full refund by default; pass an explicit
 *  amount for partial refunds.
 */

import { supabase } from '../lib/supabaseClient';

export async function refundOrder(orderId, { amount = null, reason = null } = {}) {
  const { data, error } = await supabase.rpc('refund_order', {
    p_order_id: orderId,
    p_amount:   amount,
    p_reason:   reason,
  });
  return { data, error };
}
