/**
 * Loyalty Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Customer-facing helpers for the loyalty + referral programme.
 *  All security enforcement lives in Postgres (the RPCs in migration 023).
 */

import { supabase } from '../lib/supabaseClient';

/** Read the signed-in user's points balance + referral code (fresh from DB). */
export async function fetchMyLoyalty() {
  const { data, error } = await supabase
    .from('profiles')
    .select('loyalty_points, referral_code, referred_by')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();
  return { data, error };
}

/** Last N transactions for the signed-in user. */
export async function fetchLoyaltyHistory(limit = 20) {
  const { data, error } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
}

export async function claimSignupBonus() {
  const { data, error } = await supabase.rpc('claim_signup_bonus');
  return { data, error };
}

export async function applyReferralCode(code) {
  const { data, error } = await supabase.rpc('apply_referral_code', { p_code: code });
  return { data, error };
}
