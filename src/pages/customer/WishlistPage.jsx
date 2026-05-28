/**
 * Customer WishlistPage — favourites
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /wishlist
 *
 * Shows products the customer has hearted. Tap to add to cart.
 * Re-uses the same ProductCard component as /shop so design stays consistent.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartProvider';
import { useTranslation } from '../../i18n/I18nProvider';
import { fetchWishlist } from '../../services/wishlistService';
import { ProductCard, BottomNav } from '../../components/customer';
import { NotificationBell } from '../../components/common';
import { EmptyState, Button, Skeleton } from '../../ui';

export default function WishlistPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { addItem, updateQuantity, getQuantity } = useCart();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchWishlist();
    if (err) setError(err);
    else     setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { if (session) load(); }, [session]);

  // Cart helpers
  const handleAdd = (p) => addItem({
    productId: p.id, name: p.name, price: p.price,
    image_url: p.image_url, category: p.category?.slug ?? null,
  });
  const handleInc = (p) => updateQuantity(p.id, getQuantity(p.id) + 1);
  const handleDec = (p) => updateQuantity(p.id, getQuantity(p.id) - 1);

  return (
    <div className="min-h-screen bg-ink-50 pb-32 sm:pb-10">

      <header className="bg-brand-gradient text-white px-4 pt-5 pb-12 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-5xl flex items-center gap-3 relative">
          <Link to="/shop"
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Saved for later</p>
            <h1 className="font-display text-xl font-extrabold leading-tight">❤️ My Wishlist</h1>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 -mt-6 relative z-10">
        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-64" rounded="rounded-2xl" />)}
          </div>
        )}

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon="💔"
            title="Nothing saved yet"
            description="Tap the heart on any product to save it for later."
            action={<Link to="/shop"><Button>Start shopping</Button></Link>}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map(({ product: p }) => p && (
              <ProductCard
                key={p.id}
                product={p}
                quantityInCart={getQuantity(p.id)}
                onAdd={() => handleAdd(p)}
                onIncrement={() => handleInc(p)}
                onDecrement={() => handleDec(p)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
