/**
 * Platform Settings Service
 * ──────────────────────────────────────────────────────────────────────────
 * Thin wrapper around the public.platform_settings key/value table.
 *
 * Why a service rather than inline calls:
 *  • Settings reads happen on many screens (assignment mode toggle, future
 *    surge pricing, support phone, etc.). A single layer keeps the JSON
 *    parsing + null handling consistent.
 *  • Writes are RLS-gated to admins. The service surfaces the same shape
 *    of {data, error} so callers don't branch on auth themselves.
 *
 * Known keys (extend this list as new settings ship):
 *   order_assignment_mode → "auto" | "manual"
 */

import { supabase } from '../lib/supabaseClient';

/** Convenience: well-known setting keys, exported so callers avoid typos. */
export const SETTING_KEYS = Object.freeze({
  ORDER_ASSIGNMENT_MODE: 'order_assignment_mode',
});

/**
 * Read a single setting. Returns the parsed JSONB value (or null if unset).
 *
 * @param {string} key
 * @returns {Promise<{ value: any|null, error: Error|null }>}
 */
export async function getSetting(key) {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();   // maybeSingle so "no row" returns null instead of erroring

  if (error)        return { value: null, error };
  return { value: data?.value ?? null, error: null };
}

/**
 * Read all settings at once. Returns a flat object keyed by setting name.
 * Useful for app-init prefetch (don't fire one round-trip per setting).
 */
export async function getAllSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('key, value');

  if (error) return { values: {}, error };
  const values = Object.fromEntries((data ?? []).map(r => [r.key, r.value]));
  return { values, error: null };
}

/**
 * Write a single setting. Admin-only by RLS — non-admins get an error back.
 *
 * @param {string} key
 * @param {any}    value  - must be JSON-serialisable
 */
export async function setSetting(key, value) {
  const { data, error } = await supabase
    .from('platform_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    .select()
    .single();

  return { data, error };
}
