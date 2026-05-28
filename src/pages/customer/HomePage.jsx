/**
 * Customer HomePage — v2 Swiggy-inspired storefront
 * ──────────────────────────────────────────────────────────────────────────
 * Sections (top to bottom):
 *   1. Brand header — gradient strip with greeting, bell, profile menu
 *   2. Search bar  — sticky on scroll
 *   3. Banner carousel — admin-uploaded promos
 *   4. Category tiles — horizontal scroll
 *   5. Section heading "What's in store"
 *   6. Product grid (live-updating via useProducts)
 *   7. CartFAB        — floating "View Cart"
 *   8. BottomNav      — mobile only
 *
 * Data hooks are unchanged from v1; this is a presentational rewrite.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useProducts }       from '../../hooks/useProducts';
import { useCart }           from '../../context/CartProvider';
import { useAuth }           from '../../context/AuthContext';
import { NotificationBell }  from '../../components/common';
import { fetchActiveBanners } from '../../services/bannersService';
import { fetchActiveCategories } from '../../services/categoriesService';

import {
  ProductCard,
  CategoryTabs,
  SearchBar,
  CartFAB,
  BottomNav,
  BannerCarousel,
} from '../../components/customer';

const ALL_CATEGORY = { key: 'all', label: 'All', emoji: '🛒' };

export default function CustomerHomePage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [category, setCategory] = useState('all');
  const [search,   setSearch]   = useState('');
  const [banners,  setBanners]  = useState([]);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [dynamicCategories, setDynamicCategories] = useState([]);

  // Guard: send unauthenticated visitors to login
  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  // Load banners + categories once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: bs }, { data: cats }] = await Promise.all([
        fetchActiveBanners('storefront'),
        fetchActiveCategories(),
      ]);
      if (cancelled) return;
      setBanners(bs ?? []);
      setBannersLoading(false);
      setDynamicCategories(cats ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  // Build category tabs (All + dynamic rows from DB)
  const CATEGORIES = [
    ALL_CATEGORY,
    ...dynamicCategories.map(c => ({ key: c.slug, label: c.name, emoji: c.icon ?? '🛒' })),
  ];

  const { products, loading, error } = useProducts({ category, search });
  const { count, subtotal, addItem, updateQuantity, getQuantity } = useCart();

  const handleAdd = (product) => addItem({
    productId: product.id,
    name:      product.name,
    price:     product.price,
    image_url: product.image_url,
    // Store the slug string (not the joined object) so the cart stays serializable.
    category:  product.category?.slug ?? product.category ?? null,
  });
  const handleIncrement = (p) => updateQuantity(p.id, getQuantity(p.id) + 1);
  const handleDecrement = (p) => updateQuantity(p.id, getQuantity(p.id) - 1);

  return (
    <div className="min-h-screen bg-ink-50 pb-32 sm:pb-10">

      {/* ── Hero header — brand gradient ── */}
      <header className="bg-brand-gradient pb-24 pt-5 px-4 sm:px-6 relative overflow-hidden">
        {/* Decorative orbs */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent-400/30 blur-2xl pointer-events-none" />

        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 relative">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-semibold">Delivering to</p>
            <h1 className="font-display text-lg sm:text-xl font-bold text-white truncate flex items-center gap-1.5">
              Hi, {profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there'} 👋
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
              <NotificationBell />
            </div>
            <button onClick={() => navigate('/profile')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-9 text-xs font-semibold text-white hover:bg-white/25 transition-all">
              Profile
            </button>
            <button onClick={() => navigate('/orders')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-9 text-xs font-semibold text-white hover:bg-white/25 transition-all">
              My Orders
            </button>
          </div>
        </div>
      </header>

      {/* Search bar — overlapping the header for a "card pulled out" effect */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 -mt-14 relative z-10">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search for groceries, meals, eggs…"
        />
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 space-y-6">

        {/* Banner carousel */}
        <BannerCarousel banners={banners} loading={bannersLoading} />

        {/* Category tiles */}
        <section>
          <h2 className="mb-3 font-display text-base font-bold text-ink-900 px-1">Shop by category</h2>
          <CategoryTabs categories={CATEGORIES} active={category} onChange={setCategory} />
        </section>

        {/* Error banner */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load products: {error.message}
          </div>
        )}

        {/* Product grid */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-display text-base font-bold text-ink-900">
              {search ? `Results for "${search}"` : (category === 'all' ? "What's in store" : `${CATEGORIES.find(c => c.key === category)?.label ?? ''}`)}
            </h2>
            {!loading && products.length > 0 && (
              <span className="text-xs text-ink-500">{products.length} item{products.length === 1 ? '' : 's'}</span>
            )}
          </div>

          {loading ? <SkeletonGrid /> : products.length === 0 ? <Empty search={search} /> : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  quantityInCart={getQuantity(p.id)}
                  onAdd={() => handleAdd(p)}
                  onIncrement={() => handleIncrement(p)}
                  onDecrement={() => handleDecrement(p)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Floating cart pill (sits above bottom nav on mobile) */}
      <CartFAB count={count} subtotal={subtotal} onClick={() => navigate('/cart')} />

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}

// ─── Internal sub-views ────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl bg-white border border-ink-100">
          <div className="aspect-[4/3] w-full animate-pulse bg-ink-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-ink-100" />
            <div className="h-6 w-full animate-pulse rounded bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ search }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-ink-200 bg-white py-16 text-center px-6">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 text-3xl">
        🔍
      </div>
      <p className="font-display text-base font-bold text-ink-900">No products found</p>
      <p className="mt-1 text-sm text-ink-500">
        {search ? `Nothing matches "${search}".` : 'Check back soon — the catalogue is being updated.'}
      </p>
    </div>
  );
}
