/**
 * Shops Service
 * ──────────────────────────────────────────────────────────────────────────
 * The ONLY place in the codebase that performs shop-related queries.
 *
 * Components import from here; they never call supabase.from('shops') directly.
 * This keeps:
 *  • Query shapes (joins, ordering) consistent across pages
 *  • Server contract centralised for a future edge-function refactor
 *  • RLS errors localised to one layer (easier to diagnose)
 *
 * Adaptability:
 *  • Swap Supabase for a REST/GraphQL gateway → only this file changes.
 *  • Add caching (SWR, React Query) → wrap these functions, not the callers.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * @typedef {Object} Shop
 * @property {string}  id
 * @property {string|null} owner_id
 * @property {string}  name
 * @property {string|null} phone
 * @property {string}  address
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {boolean} is_open
 * @property {boolean} accepts_cod
 * @property {'pending'|'active'|'paused'|'suspended'} status
 * @property {number}  rating
 * @property {string|null} opens_at
 * @property {string|null} closes_at
 * @property {string}  created_at
 * @property {string}  updated_at
 */

// ─── Reads ───────────────────────────────────────────────────────────────────

/**
 * Fetch every shop the caller is allowed to see.
 * Admin → all rows. Shopkeeper → their own. Customer → only active+open.
 */
export async function fetchShops() {
  const { data, error } = await supabase
    .from('shops')
    .select(`
      *,
      owner:profiles!shops_owner_id_fkey ( id, full_name, email )
    `)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Fetch a single shop by id.
 */
export async function fetchShopById(shopId) {
  const { data, error } = await supabase
    .from('shops')
    .select(`
      *,
      owner:profiles!shops_owner_id_fkey ( id, full_name, email, phone )
    `)
    .eq('id', shopId)
    .single();

  return { data, error };
}

/**
 * For each shop, count how many orders it has received this calendar month.
 * Used by the admin to verify the fairness allocator is balancing load.
 *
 * Returns: [{ shop_id, orders_this_month }]
 *
 * Implementation note: we run this as a separate query rather than embedding
 * a subquery in fetchShops() so the list view stays fast when the admin
 * doesn't need the counters.
 */
export async function fetchShopMonthlyOrderCounts() {
  // First day of current month, in ISO format
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('orders')
    .select('shop_id')
    .gte('created_at', monthStart.toISOString())
    .not('shop_id', 'is', null);

  if (error) return { data: null, error };

  // Bucket counts client-side — cheap, and avoids needing an RPC for this.
  const counts = {};
  for (const row of data) {
    counts[row.shop_id] = (counts[row.shop_id] ?? 0) + 1;
  }
  return { data: counts, error: null };
}

// ─── Writes (admin-only by RLS) ──────────────────────────────────────────────

/**
 * Create a new shop. Admin-only via RLS.
 *
 * @param {Partial<Shop>} input
 */
export async function createShop(input) {
  const payload = {
    name:        input.name?.trim(),
    phone:       input.phone?.trim() || null,
    address:     input.address?.trim(),
    lat:         input.lat ?? null,
    lng:         input.lng ?? null,
    is_open:     input.is_open ?? true,
    accepts_cod: input.accepts_cod ?? true,
    status:      input.status ?? 'active',
    opens_at:    input.opens_at || null,
    closes_at:   input.closes_at || null,
    owner_id:    input.owner_id || null,
  };

  // Local validation — fail fast with friendlier error than a DB constraint
  if (!payload.name)    return { data: null, error: new Error('Shop name is required.') };
  if (!payload.address) return { data: null, error: new Error('Shop address is required.') };

  const { data, error } = await supabase
    .from('shops')
    .insert(payload)
    .select()
    .single();

  return { data, error };
}

/**
 * Update an existing shop. Admin or the shop's own owner (RLS).
 */
export async function updateShop(shopId, updates) {
  const { data, error } = await supabase
    .from('shops')
    .update(updates)
    .eq('id', shopId)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a shop. Admin-only. Cascades to shop_inventory; orders.shop_id
 * is SET NULL by the FK on delete so historical orders are preserved.
 */
export async function deleteShop(shopId) {
  const { error } = await supabase
    .from('shops')
    .delete()
    .eq('id', shopId);

  return { error };
}

// ─── Inventory helpers ───────────────────────────────────────────────────────

/**
 * Bulk-seed inventory rows for every existing product against a shop.
 * Called once when a shop is first onboarded — the shopkeeper can then
 * toggle individual SKUs off from their dashboard (Phase C).
 *
 * `available` defaults to TRUE — shops opt-out, not opt-in, so a kirana
 * that joins immediately starts receiving orders for the full catalog.
 *
 * Uses upsert so re-seeding is safe and won't duplicate rows.
 */
export async function seedShopInventory(shopId, { available = true } = {}) {
  // Pull all product ids (cheap — products table is admin-curated).
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id');

  if (prodErr) return { count: 0, error: prodErr };
  if (!products?.length) return { count: 0, error: null };

  const rows = products.map(p => ({
    shop_id:    shopId,
    product_id: p.id,
    available,
    stock_qty:  0,    // informational; shopkeeper sets real qty later
  }));

  const { error } = await supabase
    .from('shop_inventory')
    .upsert(rows, { onConflict: 'shop_id,product_id' });

  return { count: rows.length, error };
}

/**
 * Toggle one product's availability at a shop.
 * Used by shopkeepers in Phase C and by admins for testing.
 */
export async function setInventoryAvailability(shopId, productId, available) {
  const { data, error } = await supabase
    .from('shop_inventory')
    .upsert(
      { shop_id: shopId, product_id: productId, available },
      { onConflict: 'shop_id,product_id' }
    )
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch the full inventory for a shop, joined with product info.
 * Used by the shopkeeper's inventory page (Phase C) and the admin
 * "view shop" detail screen.
 */
export async function fetchShopInventory(shopId) {
  const { data, error } = await supabase
    .from('shop_inventory')
    .select(`
      shop_id,
      product_id,
      available,
      stock_qty,
      updated_at,
      products ( id, name, category, price, image_url )
    `)
    .eq('shop_id', shopId);

  return { data, error };
}
