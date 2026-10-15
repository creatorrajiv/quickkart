/**
 * Audit Log Service
 * ──────────────────────────────────────────────────────────────────────────
 *  Read recent admin actions (admin-only via RLS).
 *  Writes happen inside the SQL RPCs themselves (refund_order, etc.) so the
 *  log is guaranteed to capture every admin action — clients never write
 *  the log directly.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * @param {Object} [filter]
 * @param {string} [filter.action]      filter by exact action key
 * @param {string} [filter.target_type] filter by target type
 * @param {number} [filter.limit]       default 100
 */
export async function fetchAuditLog({ action, target_type, limit = 100 } = {}) {
  let q = supabase
    .from('admin_audit_log')
    .select(`
      *,
      admin:profiles!admin_audit_log_admin_id_fkey ( id, full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (action)      q = q.eq('action', action);
  if (target_type) q = q.eq('target_type', target_type);

  const { data, error } = await q;
  return { data, error };
}

/**
 * Manually log an admin action from the client. Use sparingly — prefer
 * to wrap critical actions in DB RPCs that write the log atomically.
 */
export async function logAdminAction(action, { target_type = null, target_id = null, metadata = null } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('not authenticated') };
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_id: user.id,
    action,
    target_type,
    target_id,
    metadata,
  });
  return { error };
}
