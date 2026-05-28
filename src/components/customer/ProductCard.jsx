/**
 * ProductCard — v2 Swiggy/Zomato-style card
 * ──────────────────────────────────────────────────────────────────────────
 * Image-forward, large rounded card with overlap ADD button.
 *
 * Two visual states (same as v1):
 *   • Not in cart → big "ADD" button
 *   • In cart     → quantity stepper
 *
 * Additions:
 *   • Discount-style price (strike-through if compare_at_price set; future)
 *   • Hover lift effect
 *   • Larger product image (4:3) and stronger typography
 */

import { formatPrice } from '../../config/business';

const CATEGORY_EMOJI = {
  grocery: '🥦',
  meat:    '🥩',
  egg:     '🥚',
  food:    '🍱',
};

export default function ProductCard({
  product,
  quantityInCart = 0,
  onAdd,
  onIncrement,
  onDecrement,
}) {
  const inCart = quantityInCart > 0;

  // `product.category` is the joined product_categories row (object) for new
  // products and a legacy enum string for un-migrated rows. Normalise here so
  // the JSX below renders text either way.
  const isCategoryObj = product.category && typeof product.category === 'object';
  const categorySlug  = isCategoryObj ? product.category.slug : product.category;
  const categoryLabel = isCategoryObj ? product.category.name : product.category;
  const categoryIcon  = isCategoryObj
    ? (product.category.icon || CATEGORY_EMOJI[product.category.slug] || '📦')
    : (CATEGORY_EMOJI[categorySlug] ?? '📦');

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white border border-ink-100 shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200">

      {/* Image — taller aspect for better visual punch */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-ink-50 to-ink-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl opacity-60">
            {categoryIcon}
          </div>
        )}

        {/* Category chip */}
        {categoryLabel && (
          <span className="absolute top-2 left-2 rounded-full bg-white/95 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-700 shadow-sm">
            {categoryLabel}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3 pt-3">
        <div className="flex-1 min-h-[2.5rem]">
          <h3 className="line-clamp-2 text-sm font-bold text-ink-900 leading-tight">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 line-clamp-1 text-[11px] text-ink-500">
              {product.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-ink-400 leading-none mb-0.5">Price</p>
            <span className="font-display text-lg font-bold text-ink-900 leading-none">
              {formatPrice(product.price)}
            </span>
          </div>

          {inCart ? (
            <QuantityStepper
              quantity={quantityInCart}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
            />
          ) : (
            <button
              onClick={onAdd}
              className="rounded-xl bg-white border-2 border-brand-500 text-brand-600 font-bold text-xs tracking-wider px-4 h-9 hover:bg-brand-500 hover:text-white hover:shadow-brand active:scale-95 transition-all"
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuantityStepper({ quantity, onIncrement, onDecrement }) {
  return (
    <div className="flex items-center bg-brand-500 rounded-xl overflow-hidden h-9 shadow-brand">
      <button
        onClick={onDecrement}
        className="flex h-9 w-9 items-center justify-center text-white text-lg font-bold hover:bg-brand-600 active:scale-90 transition-all"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-7 text-center text-sm font-bold text-white">{quantity}</span>
      <button
        onClick={onIncrement}
        className="flex h-9 w-9 items-center justify-center text-white text-lg font-bold hover:bg-brand-600 active:scale-90 transition-all"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
