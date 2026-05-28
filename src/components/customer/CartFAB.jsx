/**
 * CartFAB — v2 Floating cart pill (bigger, gradient)
 * ──────────────────────────────────────────────────────────────────────────
 *   • Hidden when count === 0
 *   • Sits ABOVE the bottom-nav (extra bottom padding to clear it)
 *   • Brand gradient + bigger tap target
 */

import { formatPrice } from '../../config/business';

export default function CartFAB({ count, subtotal, onClick }) {
  if (count <= 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 sm:bottom-6 z-40 flex justify-center px-4 animate-slide-up">
      <button
        onClick={onClick}
        className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3
          rounded-2xl bg-brand-gradient px-5 py-3.5 text-white shadow-brand-lg
          hover:shadow-pop active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 backdrop-blur text-sm font-extrabold">
            {count}
          </span>
          <div className="text-left leading-tight">
            <p className="text-[11px] uppercase tracking-wide text-white/85 font-medium">
              {count === 1 ? '1 item' : `${count} items`}
            </p>
            <p className="text-sm font-bold">{formatPrice(subtotal)}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-sm font-bold">
          View Cart
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </button>
    </div>
  );
}
