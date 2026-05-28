/**
 * Orders Service
 * ──────────────────────────────────────────────────────────────────────────
 * The ONLY place in the codebase that performs order-related mutations.
 *
 * Components never call `supabase.rpc(...)` or `supabase.from('orders')`
 * for writes — they import functions from here. This keeps:
 *  • Validation logic centralised
 *  • Server contract (RPC names, payload shapes) in one place
 *  • Easy refactor to a different backend (REST API, GraphQL) later
 *
 * Reads are handled separately in src/hooks/*.js so realtime subscriptions
 * stay close to the UI components that consume them.
 */

import { supabase }              from '../lib/supabaseClient';
import { calculateOrderTotals }  from '../config/business';

/**
 * @typedef {Object} CartItem
 * @property {string} productId
 * @property {string} name
 * @property {number} price
 * @property {number} quantity
 * @property {string} [image_url]
 * @property {string} [category]
 */

/**
 * @typedef {Object} PlaceOrderInput
 * @property {CartItem[]} items
 * @property {'online'|'cod'} paymentMethod
 * @property {string} deliveryAddress
 */

/**
 * @typedef {Object} PlaceOrderResult
 * @property {string|null} orderId   - The new order's UUID, or null on failure
 * @property {Object|null} totals    - Cost breakdown applied
 * @property {Error|null}  error
 */

/**
 * Place an order atomically.
 *
 * Calls the create_order_with_items() Postgres function which inserts the
 * order row and all its line items in a single transaction — rolls back
 * everything if any insert fails.
 *
 * Pricing is computed CLIENT-SIDE and passed to the server. This is fine
 * because the RPC validates with the customer_id from auth.uid(), and
 * Phase-2-future could add a server-side price recomputation if needed.
 *
 * @param {PlaceOrderInput} input
 * @returns {Promise<PlaceOrderResult>}
 */
export async function placeOrder({
  items,
  paymentMethod,
  deliveryAddress,
  couponCode = null,
  deliverySlot = null,
  deliverySlotLabel = null,
  redeemPoints = 0,
}) {
  // ── Local validation (fast fail) ────────────────────────────────────────
  if (!Array.isArray(items) || items.length === 0) {
    return { orderId: null, totals: null, error: new Error('Your cart is empty.') };
  }

  if (!deliveryAddress || !deliveryAddress.trim()) {
    return { orderId: null, totals: null, error: new Error('Delivery address is required.') };
  }

  if (paymentMethod !== 'online' && paymentMethod !== 'cod') {
    return { orderId: null, totals: null, error: new Error('Pick a valid payment method.') };
  }

  // ── Compute totals using the canonical helper ───────────────────────────
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totals   = calculateOrderTotals(subtotal);

  // ── Shape the RPC payload — keys must match the function signature ──────
  const rpcItems = items.map(i => ({
    product_id:        i.productId,
    quantity:          i.quantity,
    price_at_purchase: i.price,
  }));

  // ── Call the atomic RPC ─────────────────────────────────────────────────
  const { data: orderId, error } = await supabase.rpc('create_order_with_items', {
    p_items:            rpcItems,
    p_payment_method:   paymentMethod,
    p_delivery_address: deliveryAddress.trim(),
    p_total_price:      totals.total,
    p_coupon_code:      couponCode ? couponCode.trim().toUpperCase() : null,
    p_redeem_points:    Math.max(0, Math.floor(Number(redeemPoints) || 0)),
  });

  if (error) {
    console.error('[ordersService] placeOrder failed:', error);
    return { orderId: null, totals, error };
  }

  // Slot is stored separately after creation (RPC signature stays stable).
  // The RPC always sets status='placed' regardless of slot.
  if (orderId && (deliverySlot || deliverySlotLabel)) {
    await supabase.from('orders').update({
      delivery_slot:       deliverySlot,
      delivery_slot_label: deliverySlotLabel,
    }).eq('id', orderId);
  }

  return { orderId, totals, error: null };
}

/**
 * Fetch a single order with its line items + product details.
 * Used by Phase 3 tracking page (preload before realtime subscribes).
 *
 * @param {string} orderId
 */
export async function fetchOrderById(orderId) {
  // Include shop + agent so the customer detail page can show "delivered by"
  // and shop info. RLS on shops allows SELECT of active+open shops; agent
  // profiles join may return null if no agent policy exists for customer —
  // that's fine, the UI degrades gracefully.
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id, quantity, price_at_purchase,
        products ( id, name, image_url, category )
      ),
      shop:shops!orders_shop_id_fkey   ( id, name, phone, address ),
      agent:profiles!orders_agent_id_fkey ( id, full_name, phone, vehicle_type, vehicle_number, current_lat, current_lng, location_updated_at )
    `)
    .eq('id', orderId)
    .single();

  return { data, error };
}

/**
 * Fetch ALL orders — admin-only.
 *
 * RLS will reject this for non-admin roles (see "Admins can manage all orders"
 * policy in supabase/schema.sql), so a 401-ish error from the server here
 * almost always means the caller isn't actually an admin.
 *
 * Customer/agent rows are joined for display (name, email).
 */
export async function fetchAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      customer:profiles!orders_customer_id_fkey ( id, full_name, email ),
      shop:shops!orders_shop_id_fkey ( id, name ),
      order_items ( id, quantity, price_at_purchase,
        products ( id, name, image_url )
      )
    `)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Reassign an order to a different shop. Used by admin in manual mode and
 * as an override in auto mode (rebalancing a single order).
 * Pass null to unassign.
 *
 * @param {string}      orderId
 * @param {string|null} shopId
 */
export async function assignShop(orderId, shopId) {
  const { data, error } = await supabase
    .from('orders')
    .update({ shop_id: shopId })
    .eq('id', orderId)
    .select()
    .single();

  return { data, error };
}

/**
 * Update an order's status. Used by admin (any transition) and by
 * the delivery agent (limited transitions, enforced by RLS).
 *
 * @param {string} orderId
 * @param {'placed'|'preparing'|'out_for_delivery'|'delivered'} status
 */
export async function updateOrderStatus(orderId, status) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  return { data, error };
}

/**
 * Fetch all orders assigned to a specific delivery agent.
 * RLS scopes this to the agent themselves; an admin would use fetchAllOrders.
 *
 * @param {string} agentId
 */
export async function fetchAgentOrders(agentId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items ( id, quantity, price_at_purchase,
        products ( id, name, image_url )
      ),
      shop:shops!orders_shop_id_fkey ( id, name, phone, address ),
      customer:profiles!orders_customer_id_fkey ( id, full_name, phone )
    `)
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Fetch every profile with role='agent'. Admin-only — RLS allows it via
 * the "Admins can view all profiles" policy.
 *
 * Returned shape is minimal (id, name, email) so it slots straight into
 * a dropdown.
 */
export async function fetchAgents() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'agent')
    .order('full_name', { ascending: true });

  return { data, error };
}

/**
 * Cancel an order via RPC. Server enforces who can cancel and when:
 *   • Customer: own orders that aren't yet out_for_delivery
 *   • Admin:    any non-delivered, non-cancelled order
 *
 * @param {string} orderId
 * @param {string} [reason]
 */
export async function cancelOrder(orderId, reason = null) {
  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
    p_reason:   reason,
  });
  return { data, error };
}

/**
 * Assign an agent (or unassign by passing null) to an order.
 * Admin-only — RLS "Admins can manage all orders" gates this.
 *
 * @param {string}      orderId
 * @param {string|null} agentId  - null clears the assignment
 */
export async function assignAgent(orderId, agentId) {
  const { data, error } = await supabase
    .from('orders')
    .update({ agent_id: agentId })
    .eq('id', orderId)
    .select()
    .single();

  return { data, error };
}
