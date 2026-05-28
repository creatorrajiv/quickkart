/**
 * Order Status Configuration
 * ──────────────────────────────────────────────────────────────────────────
 * The order lifecycle: placed → preparing → out_for_delivery → delivered.
 * MUST match the order_status ENUM in the database (supabase/schema.sql).
 *
 * Used by:
 *  • Customer tracking page    (OrderStatusStepper)
 *  • Agent dashboard           (status badges)
 *  • Admin orders view         (filters and chips)
 *
 * Adaptability notes:
 *  • Renaming a label ("Out for Delivery" → "On the Way")? Update LABELS only.
 *  • Adding a new status? Update DB enum, this STATUSES array, plus LABELS/COLORS.
 *  • Re-ordering steps? STATUS_ORDER drives the stepper UI automatically.
 */

// ─── Status keys — keep in sync with the order_status enum in Postgres ──────
export const ORDER_STATUS = {
  PLACED:           'placed',
  PREPARING:        'preparing',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED:        'delivered',
  CANCELLED:        'cancelled',
};

/**
 * Canonical step order — drives the stepper UI.
 * If you ever insert a status between steps, just add the key here in the right spot.
 */
export const STATUS_ORDER = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

/** Display labels — free to localise here without touching components. */
export const STATUS_LABELS = {
  [ORDER_STATUS.PLACED]:           'Order Placed',
  [ORDER_STATUS.PREPARING]:        'Preparing',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: 'Out for Delivery',
  [ORDER_STATUS.DELIVERED]:        'Delivered',
  [ORDER_STATUS.CANCELLED]:        'Cancelled',
};

/** Tailwind colour map per status — used by badges and step icons. */
export const STATUS_COLORS = {
  [ORDER_STATUS.PLACED]:           { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  [ORDER_STATUS.PREPARING]:        { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  [ORDER_STATUS.OUT_FOR_DELIVERY]: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  [ORDER_STATUS.DELIVERED]:        { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  [ORDER_STATUS.CANCELLED]:        { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500'    },
};

/** Emoji per status — purely cosmetic, easy to swap for icon components later. */
export const STATUS_ICONS = {
  [ORDER_STATUS.PLACED]:           '📝',
  [ORDER_STATUS.PREPARING]:        '👨‍🍳',
  [ORDER_STATUS.OUT_FOR_DELIVERY]: '🛵',
  [ORDER_STATUS.DELIVERED]:        '✅',
  [ORDER_STATUS.CANCELLED]:        '🚫',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns 0-based step index for a status. -1 if unknown. */
export const getStatusIndex = (status) => STATUS_ORDER.indexOf(status);

/** True if step A has been reached given current status. */
export const isStatusReached = (currentStatus, targetStatus) =>
  getStatusIndex(currentStatus) >= getStatusIndex(targetStatus);

/** The next status after the given one. Returns null if already delivered. */
export const getNextStatus = (currentStatus) => {
  const idx = getStatusIndex(currentStatus);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
};
