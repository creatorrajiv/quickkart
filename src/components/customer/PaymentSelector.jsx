/**
 * PaymentSelector — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Card-style payment options with bigger icons, brand accents on selection.
 */

import { PAYMENT_METHODS, PAYMENT_LABELS } from '../../config/business';

const METHODS = [
  {
    key:    PAYMENT_METHODS.COD,
    label:  PAYMENT_LABELS[PAYMENT_METHODS.COD],
    sub:    'Pay the delivery agent on arrival',
    icon:   '💵',
  },
  {
    key:    PAYMENT_METHODS.ONLINE,
    label:  PAYMENT_LABELS[PAYMENT_METHODS.ONLINE],
    sub:    'UPI, cards, wallets — coming soon',
    icon:   '💳',
    disabled: true,
  },
];

export default function PaymentSelector({ value, onChange }) {
  return (
    <div>
      <h3 className="font-display text-base font-bold text-ink-900 mb-3">Payment method</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {METHODS.map(m => {
          const selected = value === m.key;
          return (
            <button
              key={m.key}
              type="button"
              disabled={m.disabled}
              onClick={() => !m.disabled && onChange(m.key)}
              className={`relative flex items-center gap-3 rounded-2xl border-2 p-4 text-left
                transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60
                ${selected
                  ? 'border-brand-500 bg-brand-50 shadow-brand'
                  : 'border-ink-100 bg-white hover:border-brand-200 hover:shadow-card'
                }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-3xl shadow-sm">
                {m.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900">{m.label}</p>
                <p className="text-[11px] text-ink-500 mt-0.5">{m.sub}</p>
              </div>
              <span
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors
                  ${selected ? 'border-brand-500 bg-brand-500' : 'border-ink-300'}`}
              >
                {selected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              {m.disabled && (
                <span className="absolute top-2 right-2 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">Soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
