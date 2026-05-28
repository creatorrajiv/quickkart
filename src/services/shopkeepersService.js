/**
 * Shopkeepers Service
 * ──────────────────────────────────────────────────────────────────────────
 * Admin-side management of shopkeeper accounts + the shopkeeper's own
 * data-fetch helpers (their shop, their orders, their inventory).
 *
 * Splitting from shopsService.js so the "manage shop record" concerns
 * stay separate from "manage the human who owns that shop" concerns.
 */

import { supabase } from '../lib/supabaseClient';

/* ============================================================
 * ADMIN-SIDE: manage shopkeeper auth accounts
 * ============================================================ */

/**
 * Fetch every profile with role='shopkeeper', newest first.
 * Each row is joined with their owned shop (if any).
 */
export async function fetchShopkeepers() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, full_name, email, phone, is_active, created_at,
      shops:shops!shops_owner_id_fkey ( id, name, status, is_open )
    `)
    .eq('role', 'shopkeeper')
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Create a new shopkeeper auth user via the admin-create-user Edge Function.
 *
 * @param {Object} input
 * @param {string} input.email
 * @param {string} input.password
 * @param {string} input.full_name
 * @param {string} input.phone
 */
export async function createShopkeeper(input) {
  return invokeAdminCreateUser({ ...input, role: 'shopkeeper' });
}

/**
 * Shared invoker that surfaces the JSON body of non-2xx responses.
 *
 * supabase-js's functions.invoke() drops the response body and just hands
 * back a FunctionsHttpError when status is non-2xx, which is why earlier
 * versions of this code only showed "Edge Function returned a non-2xx
 * status code". We re-read the body from error.context.response so the
 * UI gets the real reason (e.g. "Profile setup failed: ...").
 */
async function invokeAdminCreateUser(body) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', { body });

  if (error) {
    let detail = null;
    try {
      const res = error?.context?.response;
      if (res) {
        const parsed = await res.clone().json();
        detail = parsed?.error || JSON.stringify(parsed);
      }
    } catch { /* response not JSON */ }
    return { data: null, error: new Error(detail || data?.error || error.message || 'Unknown error') };
  }
  if (data?.error) return { data: null, error: new Error(data.error) };
  return { data, error: null };
}

export async function updateShopkeeper(id, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .eq('role', 'shopkeeper')
    .select()
    .single();
  return { data, error };
}

export async function deactivateShopkeeper(id) {
  return updateShopkeeper(id, { is_active: false });
}
export async function activateShopkeeper(id) {
  return updateShopkeeper(id, { is_active: true });
}

/* ============================================================
 * SHOPKEEPER-SIDE: data for the shopkeeper's own dashboard
 * ============================================================ */

/**
 * Fetch the shop owned by the signed-in shopkeeper.
 * Returns null in `data` if they don't own a shop yet (admin hasn't
 * linked them as owner — the shopkeeper sees an onboarding screen).
 *
 * @param {string} userId  - auth.uid() of the shopkeeper
 */
export async function fetchMyShop(userId) {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();          // 0 or 1 row — not an error if missing
  return { data, error };
}

/**
 * Fetch all orders for a given shop. Used by the shopkeeper dashboard.
 * RLS: shopkeepers can SELECT orders where shop_id matches a shop
 * they own (policy added in migration 005 below).
 */
export async function fetchShopOrders(shopId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:profiles!orders_customer_id_fkey ( id, full_name, phone ),
      agent:profiles!orders_agent_id_fkey ( id, full_name, phone ),
      order_items ( id, quantity, price_at_purchase,
        products ( id, name, image_url )
      )
    `)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Inventory rows for a given shop, joined to product details.
 * If a product has no row, it's "not stocked" — the UI treats absence
 * the same as available=false.
 */
export async function fetchShopInventory(shopId) {
  // Pull all products + LEFT JOIN inventory so we can show the full
  // catalog with each row's stocked/unstocked state.
  const [{ data: products, error: pErr }, { data: inventory, error: iErr }] = await Promise.all([
    supabase.from('products').select('id, name, category, price, image_url').order('name'),
    supabase.from('shop_inventory').select('product_id, available, stock_qty').eq('shop_id', shopId),
  ]);
  if (pErr || iErr) return { data: null, error: pErr || iErr };

  const invMap = new Map((inventory ?? []).map(r => [r.product_id, r]));
  const rows = (products ?? []).map(p => {
    const inv = invMap.get(p.id);
    return {
      ...p,
      available: inv?.available ?? false,
      stock_qty: inv?.stock_qty ?? 0,
      stocked:   !!inv,                  // does an inventory row exist?
    };
  });
  return { data: rows, error: null };
}

/**
 * Toggle one product's availability at one shop. Creates the row if it
 * doesn't exist, otherwise flips the boolean.
 */
export async function setProductAvailability(shopId, productId, available) {
  const { data, error } = await supabase
    .from('shop_inventory')
    .upsert(
      { shop_id: shopId, product_id: productId, available },
      { onConflict: 'shop_id,product_id' },
    )
    .select()
    .single();
  return { data, error };
}

/**
 * Shopkeeper-edit-own-shop. Limited to a safe subset of fields
 * (open/closed, COD, hours, phone, address).
 */
export async function updateMyShop(shopId, updates) {
  const allowed = ['is_open', 'accepts_cod', 'opens_at', 'closes_at', 'phone', 'address', 'name'];
  const patch = Object.fromEntries(
    Object.entries(updates).filter(([k]) => allowed.includes(k)),
  );
  const { data, error } = await supabase
    .from('shops')
    .update(patch)
    .eq('id', shopId)
    .select()
    .single();
  return { data, error };
}
