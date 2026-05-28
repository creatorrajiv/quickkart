/**
 * CartLineItem — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Larger thumbnail, bolder typography, gradient stepper, trash icon for remove.
 */

import { formatPrice } from '../../config/business';

const CATEGORY_EMOJI = {
  grocery: '🥦',
  meat:    '🥩',
  egg:     '🥚',
  food:    '🍱',
};

export default function CartLineItem({ item, onIncrement, onDecrement, onRemove }) {
  const lineTotal = item.price * item.quantity;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card hover:shadow-pop transition-all">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-ink-50 to-ink-100">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">
            {/* item.category may be a string (cart stored from old code) or an object now */}
            {(typeof item.category === 'object' ? item.category?.icon : CATEGORY_EMOJI[item.category]) ?? '📦'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-ink-900">{item.name}</p>
        {item.variantLabel && (
          <p className="inline-block mt-0.5 rounded-md bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
            {item.variantLabel}
          </p>
        )}
        <p className="text-xs text-ink-500 mt-0.5">
          {formatPrice(item.price)} <span className="text-ink-300">·</span> {item.quantity} × unit
        </p>
        <button
          onClick={onRemove}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
          </svg>
          Remove
        </button>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center bg-brand-500 rounded-xl overflow-hidden h-8 shadow-brand">
          <button onClick={onDecrement} className="flex h-8 w-8 items-center justify-center text-white text-lg font-bold hover:bg-brand-600 active:scale-90 transition" aria-label="Decrease">−</button>
          <span className="w-6 text-center text-xs font-bold text-white">{item.quantity}</span>
          <button onClick={onIncrement} className="flex h-8 w-8 items-center justify-center text-white text-lg font-bold hover:bg-brand-600 active:scale-90 transition" aria-label="Increase">+</button>
        </div>
        <p className="text-sm font-bold text-ink-900">{formatPrice(lineTotal)}</p>
      </div>
    </div>
  );
}
