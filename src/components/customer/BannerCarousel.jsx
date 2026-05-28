/**
 * BannerCarousel — Hero rotator for the customer storefront
 * ──────────────────────────────────────────────────────────────────────────
 *   • Auto-rotates every 5s
 *   • Swipe / drag on mobile
 *   • Dot indicators
 *   • Tap to follow link_url (opens in same tab; admin can use external URL too)
 *
 * Renders nothing if there are no active banners — the page stays clean
 * until admin uploads the first banner.
 */

import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '../../ui';

export default function BannerCarousel({ banners = [], loading = false, intervalMs = 5000 }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef(null);
  const dragX    = useRef(null);

  // Auto-rotate
  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => {
      setIndex(i => (i + 1) % banners.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [banners.length, intervalMs]);

  if (loading) return <Skeleton className="aspect-[16/7] sm:aspect-[16/5]" rounded="rounded-3xl" />;
  if (!banners.length) return null;

  const onPointerDown = (e) => { dragX.current = e.clientX ?? e.touches?.[0]?.clientX; };
  const onPointerUp = (e) => {
    const startX = dragX.current; if (startX == null) return;
    const endX   = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const delta  = (endX ?? startX) - startX;
    dragX.current = null;
    if (Math.abs(delta) < 40) return;
    setIndex(i => (delta < 0 ? (i + 1) % banners.length : (i - 1 + banners.length) % banners.length));
  };

  const handleClick = (banner) => {
    if (!banner.link_url) return;
    // External link → new tab; relative → same tab
    if (/^https?:\/\//i.test(banner.link_url)) window.open(banner.link_url, '_blank', 'noopener');
    else window.location.href = banner.link_url;
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onMouseDown={onPointerDown}  onMouseUp={onPointerUp}
        onTouchStart={onPointerDown} onTouchEnd={onPointerUp}
        className="relative aspect-[16/7] sm:aspect-[16/5] overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-accent-500 shadow-card cursor-pointer select-none"
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            onClick={() => i === index && handleClick(b)}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <img src={b.image_url} alt={b.title}
              className="h-full w-full object-cover"
              draggable="false"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {/* Subtle dark gradient at the bottom so white text is readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7 text-white">
              <h3 className="font-display text-xl sm:text-3xl font-bold drop-shadow">{b.title}</h3>
              {b.subtitle && <p className="mt-1 text-sm sm:text-base text-white/90 max-w-md">{b.subtitle}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'bg-brand-500 w-6' : 'bg-ink-300 w-1.5 hover:bg-ink-400'}`}
              aria-label={`Banner ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
