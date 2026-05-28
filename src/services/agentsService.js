/**
 * Agents Service
 * ──────────────────────────────────────────────────────────────────────────
 * All admin-side agent management lives here.
 *
 * Why a dedicated service:
 *   The original ordersService.fetchAgents() was good enough for a dropdown,
 *   but now admins need full CRUD on agent profiles (create, list, edit,
 *   activate/deactivate). Splitting this out keeps ordersService focused on
 *   order lifecycle and isolates the Edge Function call below.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Fetch every profile with role='agent', newest first.
 * Includes KYC + availability fields.
 *
 * Admin-only — RLS "Admins can view all profiles" gates this.
 */
export async function fetchAgents() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, vehicle_type, vehicle_number, is_online, is_active, created_at')
    .eq('role', 'agent')
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Create a new agent. Calls the admin-create-user Edge Function which:
 *   1. Verifies the caller is an admin
 *   2. Creates the auth user (service role)
 *   3. Sets profile.role = 'agent' + KYC fields
 *
 * Failure modes:
 *   • { error: 'Only admins can create users' }       → caller isn't admin
 *   • { error: '... already been registered' }        → duplicate email
 *   • { error: 'Password must be at least 6 ...' }    → weak password
 *
 * @param {Object} input
 * @param {string} input.email
 * @param {string} input.password
 * @param {string} input.full_name
 * @param {string} input.phone
 * @param {string} [input.vehicle_type]    - 'bike' | 'scooter' | 'cycle' | 'car'
 * @param {string} [input.vehicle_number]
 */
export async function createAgent(input) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { ...input, role: 'agent' },
  });

  // supabase-js drops the response body on non-2xx; re-read it from the
  // FunctionsHttpError so the UI can show the real reason.
  if (error) {
    let detail = null;
    try {
      const res = error?.context?.response;
      if (res) {
        const parsed = await res.clone().json();
        detail = parsed?.error || JSON.stringify(parsed);
      }
    } catch { /* not JSON */ }
    return { data: null, error: new Error(detail || data?.error || error.message || 'Unknown error') };
  }
  if (data?.error) return { data: null, error: new Error(data.error) };
  return { data, error: null };
}

/**
 * Patch an existing agent's profile. Admin-only.
 *
 * @param {string} agentId
 * @param {Object} updates - any subset of: full_name, phone, vehicle_type, vehicle_number, is_active
 */
export async function updateAgent(agentId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', agentId)
    .eq('role', 'agent')       // belt-and-suspenders: never let this touch a non-agent
    .select()
    .single();

  return { data, error };
}

/**
 * Soft-delete: deactivate the agent. Their auth user remains so historical
 * orders keep their agent_id reference, but the agent is hidden from the
 * "assign delivery agent" dropdown.
 *
 * Hard delete (remove auth.users row) requires the Edge Function with
 * service role — we don't expose that yet to avoid breaking referential
 * integrity on past orders.
 */
export async function deactivateAgent(agentId) {
  return updateAgent(agentId, { is_active: false });
}

export async function activateAgent(agentId) {
  return updateAgent(agentId, { is_active: true });
}

/**
 * Agent-side: toggle own availability (online/offline).
 *
 * @param {string} agentId
 * @param {boolean} isOnline
 */
/**
 * Update agent's current GPS coordinates. Called periodically (every
 * few seconds) while the agent is online and has an active delivery.
 *
 * @param {string} agentId
 * @param {{ lat: number, lng: number }} coords
 */
export async function updateAgentLocation(agentId, { lat, lng }) {
  const { error } = await supabase
    .from('profiles')
    .update({
      current_lat:         lat,
      current_lng:         lng,
      location_updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
  return { error };
}

export async function setOnlineStatus(agentId, isOnline) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_online: isOnline })
    .eq('id', agentId)
    .select()
    .single();

  return { data, error };
}
