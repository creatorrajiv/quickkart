/**
 * CategoryTabs — v2 Big tile-style category selector
 * ──────────────────────────────────────────────────────────────────────────
 *  Horizontally scrollable. Each category is a vertical tile with a
 *  large icon on a pastel background — Swiggy/Blinkit style.
 *
 *  Props unchanged from v1 so the parent doesn't need updates.
 */

export default function CategoryTabs({ categories, active, onChange, counts }) {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
      {categories.map(cat => {
        const isActive = active === cat.key;
        const count    = counts?.[cat.key];

        return (
          <button
            key={cat.key}
            onClick={() => onChange(cat.key)}
            className={`flex flex-shrink-0 flex-col items-center justify-center gap-1.5 w-20 py-3 px-2 rounded-2xl transition-all active:scale-95
              ${isActive
                ? 'bg-brand-500 text-white shadow-brand'
                : 'bg-white border border-ink-100 text-ink-700 hover:border-brand-200 hover:shadow-card'
              }`}
          >
            <span className={`text-2xl leading-none ${isActive ? '' : 'opacity-90'}`}>
              {cat.emoji ?? '🛒'}
            </span>
            <span className="text-[11px] font-semibold leading-none">
              {cat.label}
            </span>
            {typeof count === 'number' && (
              <span className={`text-[9px] leading-none rounded-full px-1.5 py-0.5 font-medium
                ${isActive ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-500'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
