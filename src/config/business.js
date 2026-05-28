/**
 * Business Configuration — Single Source of Truth
 * ──────────────────────────────────────────────────────────────────────────
 * All pricing, tax, delivery, and currency rules live here.
 * Want to change the delivery fee? Tax %? Currency symbol?
 * Edit ONE constant in this file — the entire app updates.
 *
 * DO NOT hardcode any of these values elsewhere in the codebase.
 * Always import from this module:
 *
 *   import { CURRENCY, getDeliveryFee, calculateTax } from '@/config/business';
 *
 * Adaptability notes:
 *  • Switch from flat tax to per-category tax → change TAX_RATE to a function.
 *  • Add tiered delivery (by distance) → expand getDeliveryFee() logic.
 *  • Going multi-currency → wrap CURRENCY in a locale-aware function.
 */

// ─── Currency ────────────────────────────────────────────────────────────────
export const CURRENCY = {
  symbol: '₹',
  code:   'INR',
  locale: 'en-IN',
};

/** Format a numeric amount as a display string. */
export const formatPrice = (amount) =>
  `${CURRENCY.symbol}${Number(amount).toFixed(2)}`;

// ─── Delivery fees ───────────────────────────────────────────────────────────
/**
 * Base delivery fee charged on every order below the free-delivery threshold.
 * Adjust freely — components read this via getDeliveryFee().
 */
export const DELIVERY = {
  baseFee:              30,   // flat delivery charge below threshold
  freeDeliveryAbove:    499,  // subtotal at which delivery becomes free
  agentEarningsPerJob:  25,   // what the delivery agent earns per completed delivery
};

/**
 * Compute the delivery fee for a given subtotal.
 * Pure function — easy to unit-test and easy to refactor.
 */
export const getDeliveryFee = (subtotal) =>
  subtotal >= DELIVERY.freeDeliveryAbove ? 0 : DELIVERY.baseFee;

// ─── Tax ─────────────────────────────────────────────────────────────────────
/**
 * Flat tax rate applied on (subtotal + delivery).
 * Replace this with category-aware logic when needed —
 * keep the calculateTax() signature stable so consumers don't break.
 */
export const TAX_RATE = 0.05; // 5 %

export const calculateTax = (taxableAmount) =>
  Math.round(taxableAmount * TAX_RATE * 100) / 100;

// ─── Order totals helper ─────────────────────────────────────────────────────
/**
 * Single helper that returns the full cost breakdown for a cart.
 * Centralised so checkout, summary, and order history all agree.
 *
 * @param {number} subtotal - sum of (price × quantity) for all cart items
 * @returns {{ subtotal:number, delivery:number, tax:number, total:number }}
 */
export const calculateOrderTotals = (subtotal) => {
  const sub      = Math.round(subtotal * 100) / 100;
  const delivery = getDeliveryFee(sub);
  const tax      = calculateTax(sub + delivery);
  const total    = Math.round((sub + delivery + tax) * 100) / 100;
  return { subtotal: sub, delivery, tax, total };
};

// ─── Delivery ETA (estimated time) ──────────────────────────────────────────
/**
 * Rough delivery time estimates by order status. These are deliberately
 * coarse — real estimates require route + agent location and come later.
 *
 * Returned as a range so the UI can show "20-30 min" rather than a single
 * misleading number.
 *
 * @param {string} status - current order_status
 * @returns {{ min:number, max:number, label:string } | null}
 */
export const ETA_BY_STATUS = {
  placed:           { min: 25, max: 40 },
  preparing:        { min: 15, max: 25 },
  out_for_delivery: { min: 5,  max: 15 },
};

export const getDeliveryETA = (status) => {
  const eta = ETA_BY_STATUS[status];
  if (!eta) return null;
  return { ...eta, label: `${eta.min}-${eta.max} min` };
};

// ─── Payment methods ─────────────────────────────────────────────────────────
/**
 * Matches the payment_method enum in the database.
 * Adding a new method? Update the DB enum + this constant together.
 */
export const PAYMENT_METHODS = {
  ONLINE: 'online',
  COD:    'cod',
};

export const PAYMENT_LABELS = {
  [PAYMENT_METHODS.ONLINE]: 'Online Payment',
  [PAYMENT_METHODS.COD]:    'Cash on Delivery',
};
