/**
 * WhatsApp — share-order helper
 * ──────────────────────────────────────────────────────────────────────────
 *  Opens wa.me with a pre-filled message containing the cart contents.
 *  Customer can then send it to the configured business number.
 *
 *  Business number is read from env: VITE_WHATSAPP_BUSINESS_NUMBER
 *  (10–15 digit international format without `+` or spaces).
 *
 *  This is a "WhatsApp share" — not a real bot. Phase 2 of WhatsApp
 *  integration (Meta Business API) will replace this entire file.
 */

import { formatPrice } from '../config/business';

export function isWhatsAppShareEnabled() {
  return !!import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER;
}

export function getBusinessNumber() {
  return (import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER ?? '').replace(/[^0-9]/g, '');
}

/**
 * Build a human-readable message from a cart.
 *
 * @param {Object} input
 * @param {Array}  input.items
 * @param {string} [input.deliveryAddress]
 * @param {string} [input.paymentMethod]
 * @param {Object} [input.totals]   - { subtotal, delivery, tax, total }
 * @param {Object} [input.profile]  - { full_name, phone }
 */
export function buildOrderMessage({ items, deliveryAddress, paymentMethod, totals, profile } = {}) {
  const lines = [];
  lines.push('🛒 *New Order Request*');
  lines.push('');

  if (profile?.full_name || profile?.phone) {
    lines.push('*From:*');
    if (profile.full_name) lines.push(`Name: ${profile.full_name}`);
    if (profile.phone)     lines.push(`Phone: ${profile.phone}`);
    lines.push('');
  }

  if (items?.length) {
    lines.push('*Items:*');
    for (const i of items) {
      lines.push(`• ${i.name} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`);
    }
    lines.push('');
  }

  if (totals) {
    lines.push('*Bill:*');
    lines.push(`Subtotal: ${formatPrice(totals.subtotal)}`);
    lines.push(`Delivery: ${totals.delivery === 0 ? 'FREE' : formatPrice(totals.delivery)}`);
    lines.push(`Taxes: ${formatPrice(totals.tax)}`);
    lines.push(`*Total: ${formatPrice(totals.total)}*`);
    lines.push('');
  }

  if (deliveryAddress) {
    lines.push('*Deliver to:*');
    lines.push(deliveryAddress);
    lines.push('');
  }

  if (paymentMethod) {
    lines.push(`*Payment:* ${paymentMethod.toUpperCase()}`);
  }

  return lines.join('\n');
}

/**
 * Open WhatsApp (web or app) with the message pre-filled.
 * Uses the wa.me universal link so it works on mobile and desktop.
 *
 * @returns {boolean} true if opened, false if no business number configured
 */
/**
 * Open a WhatsApp chat with a specific phone number, optionally pre-filling
 * a message. Useful for customer↔agent contact during delivery.
 *
 * @param {string} phone        - 10-15 digits (will be cleaned to digits only)
 * @param {string} [message]    - pre-filled message
 * @returns {boolean}           - true if opened
 */
export function openWhatsAppChat(phone, message = '') {
  if (!phone) return false;
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length < 10) return false;
  // If 10 digits and starts with 9/8/7/6 — Indian mobile, add 91 prefix
  const e164 = digits.length === 10 && /^[6-9]/.test(digits) ? `91${digits}` : digits;
  const url = `https://wa.me/${e164}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

export function openWhatsAppOrder(cartInput) {
  const number = getBusinessNumber();
  if (!number) return false;
  const message = buildOrderMessage(cartInput);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}
