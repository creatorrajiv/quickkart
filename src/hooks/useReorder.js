/**
 * useReorder — one-tap "buy this order again"
 * ──────────────────────────────────────────────────────────────────────────
 *   const { reorder, busy } = useReorder();
 *   <Button onClick={() => reorder(order)}>Reorder</Button>
 *
 * Behavior:
 *   1. Clears the current cart
 *   2. Re-adds each of the order's line items (using CURRENT product price
 *      from the joined product row, not the historical price_at_purchase —
 *      customers expect today's prices)
 *   3. Skips items that no longer exist or are out of stock; counts them
 *      and surfaces in the toast
 *   4. Navigates to /cart
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartProvider';
import { notify } from '../lib/notify';
import { supabase } from '../lib/supabaseClient';

export function useReorder() {
  const navigate = useNavigate();
  const { clearCart, addItem } = useCart();
  const [busy, setBusy] = useState(false);

  /**
   * @param {Object} order  - either an order object with order_items joined,
   *                          or just an orderId string (in which case we fetch)
   */
  const reorder = async (order) => {
    setBusy(true);

    // Allow caller to pass either the full row or just an id
    let orderRow = order;
    if (typeof order === 'string') {
      const { data, error } = await supabase
        .from('orders')
        .select(`order_items ( quantity, products ( id, name, price, image_url, is_available, category:product_categories!products_category_id_fkey ( slug ) ) )`)
        .eq('id', order)
        .single();
      if (error || !data) {
        setBusy(false);
        notify.error('Could not load order', error?.message);
        return;
      }
      orderRow = data;
    }

    const items = orderRow.order_items ?? [];
    if (items.length === 0) {
      setBusy(false);
      notify.error('Nothing to reorder');
      return;
    }

    clearCart();

    let added = 0;
    let unavailable = 0;
    for (const item of items) {
      const product = item.products;
      if (!product || !product.is_available) { unavailable++; continue; }
      addItem({
        productId: product.id,
        name:      product.name,
        price:     Number(product.price),
        image_url: product.image_url,
        category:  product.category?.slug ?? null,
        quantity:  item.quantity,
      });
      added++;
    }

    setBusy(false);

    if (added === 0) {
      notify.error('None of those items are available right now');
      return;
    }
    if (unavailable > 0) {
      notify.warning(`Added ${added} items`, `${unavailable} no longer available, skipped`);
    } else {
      notify.success(`Added ${added} item${added === 1 ? '' : 's'} to cart`);
    }
    navigate('/cart');
  };

  return { reorder, busy };
}
