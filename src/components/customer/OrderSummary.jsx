/**
 * OrderSummary — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Crisper bill card with subtle dividers, "Saved on delivery" highlight,
 * progress bar to free delivery.
 */

import { formatPrice, DELIVERY } from '../../config/business';

export default function OrderSummary({ totals, itemCount }) {
  const { subtotal, delivery, tax, total, discount = 0, loyaltyDiscount = 0 } = totals;
  const freeDeliveryGap = DELIVERY.freeDeliveryAbove - subtotal;
  const isFreeDelivery  = delivery === 0;
  const progress = Math.min(100, Math.round((subtotal / DELIVERY.freeDeliveryAbove) * 100));

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-bold text-ink-900">Bill details</h3>
        {typeof itemCount === 'number' && (
          <span className="text-xs text-ink-500">{itemCount} item{itemCount === 1 ? '' : 's'}</span>
        )}
      </div>

      {/* Free-delivery progress */}
      {!isFreeDelivery && freeDeliveryGap > 0 && (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-accent-50 to-brand-50 border border-accent-100 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-brand-700">
            Add <span className="text-brand-600 font-bold">{formatPrice(freeDeliveryGap)}</span> more for FREE delivery
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white">
            <div className="h-full bg-brand-gradient rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="space-y-2.5 text-sm">
        <Row label="Item total"    value={formatPrice(subtotal)} />
        <Row label="Delivery fee"
          value={isFreeDelivery ? 'FREE' : formatPrice(delivery)}
          valueClass={isFreeDelivery ? 'text-green-600 font-bold' : ''}
        />
        <Row label="Taxes & charges" value={formatPrice(tax)} />
        {discount > 0 && (
          <Row label="Coupon discount" value={`− ${formatPrice(discount)}`} valueClass="text-green-600 font-bold" />
        )}
        {loyaltyDiscount > 0 && (
          <Row label="Loyalty points" value={`− ${formatPrice(loyaltyDiscount)}`} valueClass="text-brand-600 font-bold" />
        )}
      </div>

      <div className="border-t border-dashed border-ink-200 my-3" />

      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold text-ink-900">To Pay</span>
        <span className="font-display text-xl font-extrabold text-ink-900">{formatPrice(total)}</span>
      </div>

      {isFreeDelivery && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
          🎉 You saved on delivery
        </p>
      )}
    </div>
  );
}

function Row({ label, value, valueClass = 'text-ink-900 font-semibold' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
