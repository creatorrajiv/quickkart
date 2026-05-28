/**
 * ProductCard — v3 with gallery support
 * ──────────────────────────────────────────────────────────────────────────
 *  • Reads product.image_urls (array) when present, falls back to image_url
 *  • Tap the image → opens a full-screen gallery carousel
 *  • Counter chip in top-right shows total image count when > 1
 *  • i18n via useTranslation
 */

import { useState } from 'react';
import { formatPrice } from '../../config/business';
import { useTranslation } from '../../i18n/I18nProvider';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';

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
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { ids: wishIds, toggle: toggleWish, busy: wishBusy } = useWishlist();
  const inCart = quantityInCart > 0;
  const [galleryOpen, setGalleryOpen] = useState(false);

  const isFav   = wishIds.has(product.id);
  const isWishBusy = wishBusy.has(product.id);
  const canWish = profile?.role === 'customer';

  // `product.category` may be the joined object or legacy enum string.
  const isCategoryObj = product.category && typeof product.category === 'object';
  const categorySlug  = isCategoryObj ? product.category.slug : product.category;
  const categoryLabel = isCategoryObj ? product.category.name : product.category;
  const categoryIcon  = isCategoryObj
    ? (product.category.icon || CATEGORY_EMOJI[product.category.slug] || '📦')
    : (CATEGORY_EMOJI[categorySlug] ?? '📦');

  // Build the gallery list. Falls back to single image for legacy rows.
  const gallery = Array.isArray(product.image_urls) && product.image_urls.length > 0
    ? product.image_urls
    : (product.image_url ? [product.image_url] : []);
  const hasMultiple = gallery.length > 1;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl bg-white border border-ink-100 shadow-card hover:shadow-pop hover:-translate-y-0.5 transition-all duration-200">

      {/* Image — tap to open gallery */}
      <button
        type="button"
        onClick={() => gallery.length > 0 && setGalleryOpen(true)}
        className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-ink-50 to-ink-100 cursor-zoom-in"
      >
        {gallery[0] ? (
          <img
            src={gallery[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl opacity-60">
            {categoryIcon}
          </div>
        )}

        {categoryLabel && (
          <span className="absolute top-2 left-2 rounded-full bg-white/95 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-700 shadow-sm">
            {categoryLabel}
          </span>
        )}

        {hasMultiple && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-ink-900/70 backdrop-blur text-white px-2 py-0.5 text-[10px] font-bold">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16v12H4V6z" />
            </svg>
            {gallery.length}
          </span>
        )}
      </button>

      {/* Wishlist heart — positioned over the image, top-right */}
      {canWish && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleWish(product.id); }}
          disabled={isWishBusy}
          aria-label={isFav ? 'Remove from wishlist' : 'Add to wishlist'}
          className={`absolute top-2 right-2 z-10 h-9 w-9 rounded-full flex items-center justify-center backdrop-blur shadow transition-all active:scale-90
            ${isFav ? 'bg-red-500 text-white' : 'bg-white/95 text-ink-500 hover:text-red-500'}
            ${isWishBusy ? 'opacity-60 animate-pulse-soft' : ''}`}
        >
          <svg className={`h-5 w-5 ${isFav ? '' : 'fill-none'}`} fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isFav ? 0 : 2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
          </svg>
        </button>
      )}

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
              {t('product.add')}
            </button>
          )}
        </div>
      </div>

      {galleryOpen && (
        <ProductGallery
          images={gallery}
          name={product.name}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Gallery modal — fullscreen image carousel ────────────────────────────
function ProductGallery({ images, name, onClose }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 backdrop-blur-sm p-4 animate-fade-in"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 text-white hover:bg-white/25 flex items-center justify-center"
        aria-label="Close"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div onClick={(e) => e.stopPropagation()} className="relative max-w-3xl w-full">
        <img src={images[idx]} alt={`${name} ${idx + 1}/${images.length}`}
          className="w-full max-h-[80vh] object-contain rounded-2xl bg-ink-800" />

        {images.length > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white text-ink-900 font-bold shadow-pop">‹</button>
            <button onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 hover:bg-white text-ink-900 font-bold shadow-pop">›</button>

            <div className="mt-3 flex justify-center gap-2">
              {images.map((src, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-brand-500 scale-110' : 'border-white/30 opacity-70'}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mt-3 text-center text-white text-sm font-bold">{name}</p>
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
