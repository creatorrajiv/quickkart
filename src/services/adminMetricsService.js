/**
 * Admin Metrics Service
 * ──────────────────────────────────────────────────────────────────────────
 * Wraps the admin_dashboard_metrics() RPC. Returns a single JSON blob
 * with today/week/month rollups, active orders, totals, top shops/agents.
 */

import { supabase } from '../lib/supabaseClient';

export async function fetchAdminMetrics() {
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');
  return { data, error };
}
