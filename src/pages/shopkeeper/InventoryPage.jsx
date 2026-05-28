/**
 * Shopkeeper InventoryPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *   • Brand-gradient header
 *   • Modern search + segmented filter
 *   • Compact rows with bigger thumbnails + sleek toggle
 *   • Stats summary in header
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchMyShop,
  fetchShopInventory,
  setProductAvailability,
} from '../../services/shopkeepersService';
import { formatPrice } from '../../config/business';
import { notify } from '../../lib/notify';
import { NotificationBell } from '../../components/common';
import { Input, EmptyState, Skeleton } from '../../ui';

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'stocked',   label: 'Stocked' },
  { key: 'unstocked', label: 'Not stocked' },
];

const CATEGORY_EMOJI = {
  grocery: '🥦', meat: '🥩', egg: '🥚', food: '🍱',
};

export default function ShopkeeperInventoryPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [shop,     setShop]     = useState(null);
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isShopkeeper = profile?.role === 'shopkeeper';

  useEffect(() => {
    if (!isShopkeeper || !profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: shopData } = await fetchMyShop(profile.id);
      if (cancelled) return;
      setShop(shopData);
      if (!shopData) { setLoading(false); return; }

      const { data, error: err } = await fetchShopInventory(shopData.id);
      if (cancelled) return;
      if (err) setError(err); else setRows(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isShopkeeper, profile?.id]);

  const handleToggle = async (row) => {
    if (!shop) return;
    setSavingId(row.id);
    const newAvailable = !row.available;
    const { error: err } = await setProductAvailability(shop.id, row.id, newAvailable);
    setSavingId(null);
    if (err) { notify.error('Update failed', err.message); return; }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, available: newAvailable, stocked: true } : r));
  };

  const filtered = useMemo(() => {
    let out = rows;
    if (filter === 'stocked')   out = out.filter(r => r.available);
    if (filter === 'unstocked') out = out.filter(r => !r.available);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(r => r.name.toLowerCase().includes(q));
    }
    return out;
  }, [rows, filter, search]);

  if (!loading && !shop && isShopkeeper) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-amber-100 bg-white shadow-card p-8 text-center">
          <p className="text-5xl mb-3">⏳</p>
          <h2 className="font-display text-xl font-bold text-amber-900">No shop linked yet</h2>
          <Link to="/shopkeeper/dashboard" className="mt-4 inline-block text-sm font-bold text-brand-600 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const stockedCount = rows.filter(r => r.available).length;
  const total = rows.length;
  const pct = total === 0 ? 0 : Math.round((stockedCount / total) * 100);

  return (
    <div className="min-h-screen bg-ink-50 pb-10">

      <header className="bg-brand-gradient text-white px-4 pt-5 pb-12 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />

        <div className="mx-auto max-w-5xl relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <Link to="/shopkeeper/dashboard"
                className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Inventory</p>
                <h1 className="font-display text-xl font-extrabold leading-tight truncate">{shop?.name}</h1>
              </div>
            </div>
            <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
              <NotificationBell />
            </div>
          </div>

          {/* Progress card */}
          <div className="mt-5 rounded-2xl bg-white/15 backdrop-blur border border-white/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/85 font-semibold">{stockedCount} of {total} products available</p>
                <p className="text-[11px] text-white/70 mt-0.5">{pct}% stocked</p>
              </div>
              <span className="font-display text-3xl font-extrabold">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full rounded-full bg-white shadow" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 -mt-8 relative z-10 space-y-4">

        {/* Search + filter */}
        <div className="rounded-2xl bg-white shadow-card border border-ink-100 p-3 space-y-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            leftIcon={<SearchIcon />}
          />
          <div className="flex rounded-xl bg-ink-100 p-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${filter === f.key ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-600 hover:text-ink-900'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <ul className="space-y-2">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}
          </ul>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon="🔍" title="No products match" description={search ? `Nothing matches "${search}".` : 'Try a different filter.'} />
        )}

        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map(row => (
              <li key={row.id} className={`flex items-center gap-3 rounded-2xl border bg-white p-3 shadow-card transition-all
                ${row.available ? 'border-green-200' : 'border-ink-100'}`}>
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-ink-50 to-ink-100">
                  {row.image_url ? (
                    <img src={row.image_url} alt={row.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">{CATEGORY_EMOJI[row.category] ?? '📦'}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{row.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">
                    <span className="capitalize">{row.category}</span> · {formatPrice(row.price)}
                  </p>
                </div>
                <Toggle checked={row.available} onChange={() => handleToggle(row)} disabled={savingId === row.id} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button onClick={onChange} disabled={disabled} type="button" role="switch" aria-checked={checked}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50
        ${checked ? 'bg-brand-500 shadow-brand' : 'bg-ink-300'}`}>
      <span className={`pointer-events-none absolute top-0.5 left-0.5 inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15z" />
    </svg>
  );
}
