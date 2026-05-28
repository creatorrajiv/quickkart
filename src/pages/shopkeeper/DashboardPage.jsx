/**
 * Shopkeeper DashboardPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Sections:
 *   1. Brand-gradient header with shop name + open/closed toggle + nav
 *   2. Stats row — today's orders, preparing, out, delivered
 *   3. Realtime order subscriptions — sound + auto-refresh on changes
 *   4. New orders section (action card with prominent Accept button)
 *   5. Preparing, Out for delivery, Delivered sections
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchMyShop,
  fetchShopOrders,
  updateMyShop,
} from '../../services/shopkeepersService';
import { updateOrderStatus } from '../../services/ordersService';
import { formatPrice } from '../../config/business';
import { notify } from '../../lib/notify';
import {
  ORDER_STATUS,
  STATUS_LABELS,
  STATUS_ICONS,
} from '../../config/orderStatus';
import { NotificationBell } from '../../components/common';
import { Button, Badge, EmptyState } from '../../ui';

export default function ShopkeeperDashboardPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();

  const [shop,         setShop]         = useState(null);
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [actingId,     setActingId]     = useState(null);
  const [togglingOpen, setTogglingOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isShopkeeper = profile?.role === 'shopkeeper';

  // Initial fetch
  useEffect(() => {
    if (!isShopkeeper || !profile?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data: shopData, error: shopErr } = await fetchMyShop(profile.id);
      if (cancelled) return;
      if (shopErr) { setError(shopErr); setLoading(false); return; }
      setShop(shopData);

      if (!shopData) { setLoading(false); return; }

      const { data: ordersData, error: oErr } = await fetchShopOrders(shopData.id);
      if (cancelled) return;
      if (oErr) setError(oErr); else setOrders(ordersData ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [isShopkeeper, profile?.id]);

  // Realtime — re-fetch on any change to this shop's orders
  useEffect(() => {
    if (!shop?.id) return;
    const channel = supabase
      .channel(`shop-orders:${shop.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shop.id}` },
        async () => {
          const { data } = await fetchShopOrders(shop.id);
          setOrders(data ?? []);
        })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [shop?.id]);

  const handleToggleOpen = async () => {
    if (!shop) return;
    setTogglingOpen(true);
    const { data, error: err } = await updateMyShop(shop.id, { is_open: !shop.is_open });
    setTogglingOpen(false);
    if (err) { notify.error('Could not update', err.message); return; }
    setShop(data);
    notify.success(data.is_open ? 'Shop is now open' : 'Shop closed');
  };

  const handleAccept = async (order) => {
    setActingId(order.id);
    const { error: err } = await updateOrderStatus(order.id, ORDER_STATUS.PREPARING);
    setActingId(null);
    if (err) { notify.error('Update failed', err.message); return; }
    notify.success(`Started preparing #${order.id.slice(0, 8)}`);
  };

  if (!authLoading && session && profile && !isShopkeeper) {
    return <RoleMismatch role={profile.role} email={session.user.email} onSignOut={signOut} />;
  }

  // Onboarding: shopkeeper but no shop linked
  if (!loading && !shop && isShopkeeper) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <div className="rounded-3xl bg-white shadow-card border border-amber-100 p-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-4xl mb-4">⏳</div>
            <h2 className="font-display text-xl font-bold text-ink-900">Waiting for shop assignment</h2>
            <p className="mt-2 text-sm text-ink-600">
              Your account exists but an admin hasn't linked you to a shop yet.
              Orders will appear here as soon as they do.
            </p>
            <Button onClick={signOut} variant="outline" size="md" className="mt-6">Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  const placed     = orders.filter(o => o.status === ORDER_STATUS.PLACED);
  const preparing  = orders.filter(o => o.status === ORDER_STATUS.PREPARING);
  const inDelivery = orders.filter(o => o.status === ORDER_STATUS.OUT_FOR_DELIVERY);
  const delivered  = orders.filter(o => o.status === ORDER_STATUS.DELIVERED);

  return (
    <div className="min-h-screen bg-ink-50 pb-10">

      {/* Brand header */}
      <header className="bg-brand-gradient text-white px-4 pt-5 pb-12 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent-400/30 blur-2xl pointer-events-none" />

        <div className="mx-auto max-w-6xl relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Shopkeeper dashboard</p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight truncate flex items-center gap-2">
                🏪 {shop?.name || 'Your shop'}
              </h1>
              <p className="mt-1 text-xs text-white/85 truncate">{shop?.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
                <NotificationBell />
              </div>
            </div>
          </div>

          {/* Open/closed switch + nav */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleOpen}
              disabled={togglingOpen}
              className={`inline-flex items-center gap-2 rounded-xl px-4 h-10 text-sm font-bold transition-all active:scale-95
                ${shop?.is_open
                  ? 'bg-white text-green-700 shadow-md'
                  : 'bg-white/15 text-white border border-white/30 hover:bg-white/25'
                }`}
            >
              <span className={`h-2 w-2 rounded-full ${shop?.is_open ? 'bg-green-500 animate-pulse' : 'bg-white/60'}`} />
              {togglingOpen ? '…' : (shop?.is_open ? 'Open · Accepting orders' : 'Closed — tap to open')}
            </button>

            <Link to="/shopkeeper/inventory"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-10 text-xs font-bold text-white hover:bg-white/25 transition-all">
              Inventory →
            </Link>
            <Link to="/shopkeeper/profile"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-10 text-xs font-bold text-white hover:bg-white/25 transition-all">
              Settings →
            </Link>
            <Link to="/profile"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-10 text-xs font-bold text-white hover:bg-white/25 transition-all">
              My profile
            </Link>
            <button onClick={signOut}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-10 text-xs font-bold text-white hover:bg-white/25 transition-all">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 -mt-8 relative z-10 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="New" value={placed.length}        icon="🆕" tone="bg-amber-50 text-amber-700 border-amber-200" pulse={placed.length > 0} />
          <StatCard label="Preparing" value={preparing.length} icon="🧑‍🍳" tone="bg-blue-50 text-blue-700 border-blue-200" />
          <StatCard label="Out for delivery" value={inDelivery.length} icon="🛵" tone="bg-purple-50 text-purple-700 border-purple-200" />
          <StatCard label="Delivered" value={delivered.length} icon="✅" tone="bg-green-50 text-green-700 border-green-200" />
        </div>

        {loading && <SkeletonList />}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <EmptyState
            icon="🍞"
            title="No orders yet"
            description="When customers place an order assigned to your shop, it'll appear here. Make sure your shop is Open and you've stocked products."
            action={<Link to="/shopkeeper/inventory"><Button>Manage inventory</Button></Link>}
          />
        )}

        {!loading && !error && orders.length > 0 && (
          <>
            <Section title="🆕 New orders — needs your action" count={placed.length} highlight>
              {placed.map(o => (
                <NewOrderCard key={o.id} order={o} acting={actingId === o.id} onAccept={() => handleAccept(o)} />
              ))}
            </Section>

            <Section title="🧑‍🍳 Preparing" count={preparing.length}>
              {preparing.map(o => <CompactOrderCard key={o.id} order={o} />)}
            </Section>

            <Section title="🛵 Out for delivery" count={inDelivery.length}>
              {inDelivery.map(o => <CompactOrderCard key={o.id} order={o} />)}
            </Section>

            {delivered.length > 0 && (
              <Section title="✅ Recently delivered" count={delivered.length}>
                {delivered.slice(0, 8).map(o => <CompactOrderCard key={o.id} order={o} delivered />)}
              </Section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, tone, pulse }) {
  return (
    <div className={`relative rounded-2xl border bg-white p-4 shadow-card overflow-hidden ${pulse ? 'animate-pulse-soft' : ''}`}>
      <div className={`absolute right-2 top-2 h-12 w-12 rounded-2xl flex items-center justify-center text-2xl ${tone}`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">{label}</p>
      <p className="font-display text-3xl font-extrabold text-ink-900 leading-none mt-1">{value}</p>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────
function Section({ title, count, highlight, children }) {
  if (count === 0) return null;
  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className={`font-display text-lg font-bold ${highlight ? 'text-brand-700' : 'text-ink-900'}`}>{title}</h2>
        <Badge tone={highlight ? 'warning' : 'neutral'}>{count}</Badge>
      </div>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

// ─── New order card (action) ───────────────────────────────────────────────
function NewOrderCard({ order, acting, onAccept }) {
  const shortId = order.id.slice(0, 8);
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const placedAgo = timeAgo(order.created_at);

  return (
    <li className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-white to-brand-50/40 shadow-card hover:shadow-pop transition-all overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">Order #{shortId}</p>
            <h3 className="font-display text-lg font-bold text-ink-900 mt-0.5">
              {order.customer?.full_name || order.customer?.phone || 'Customer'}
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">{placedAgo} · {itemCount} item{itemCount === 1 ? '' : 's'}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold text-ink-900">{formatPrice(order.total_price)}</p>
            <Badge tone="info" size="sm">{order.payment_method?.toUpperCase()}</Badge>
          </div>
        </div>

        <ul className="mt-3 space-y-1.5">
          {order.order_items?.slice(0, 4).map(item => (
            <li key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-700">
                <span className="font-bold text-brand-600 mr-1">×{item.quantity}</span>
                {item.products?.name ?? 'Item'}
              </span>
              <span className="font-mono text-xs text-ink-500">{formatPrice(item.price_at_purchase * item.quantity)}</span>
            </li>
          ))}
          {(order.order_items?.length ?? 0) > 4 && (
            <li className="text-[11px] text-ink-500">+ {order.order_items.length - 4} more</li>
          )}
        </ul>

        <div className="mt-4 rounded-xl bg-ink-50 p-3 text-xs">
          <p className="text-ink-500 font-bold uppercase tracking-wide text-[10px]">Deliver to</p>
          <p className="text-ink-800 mt-0.5 line-clamp-2">{order.delivery_address}</p>
        </div>
      </div>

      <div className="bg-white border-t border-ink-100 p-3">
        <Button onClick={onAccept} loading={acting} size="lg" fullWidth
          rightIcon={
            !acting && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )
          }>
          Accept · Start Preparing
        </Button>
      </div>
    </li>
  );
}

// ─── Compact card (read-only states) ────────────────────────────────────────
function CompactOrderCard({ order, delivered }) {
  const shortId = order.id.slice(0, 8);
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;

  return (
    <li className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-2xl">
          {STATUS_ICONS[order.status]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[11px] text-ink-500">#{shortId}</p>
            <Badge tone={order.status === 'delivered' ? 'success' : (order.status === 'out_for_delivery' ? 'purple' : 'info')} size="sm">
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink-900 truncate">
            {order.customer?.full_name || order.customer?.phone || 'Customer'} · {itemCount} item{itemCount === 1 ? '' : 's'}
          </p>
          {order.agent && (
            <p className="text-[11px] text-ink-500 truncate">🛵 {order.agent.full_name}{order.agent.phone && <> · {order.agent.phone}</>}</p>
          )}
        </div>
        <p className="font-display text-base font-bold text-ink-900">{formatPrice(order.total_price)}</p>
      </div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1,2,3].map(i => <li key={i} className="h-32 animate-pulse rounded-2xl bg-white border border-ink-100" />)}
    </ul>
  );
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function RoleMismatch({ role, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-white shadow-card p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-amber-900">Access denied</h2>
        <p className="text-sm text-amber-800">This dashboard is for shopkeepers. Your role: <code className="rounded bg-amber-100 px-1 font-mono text-xs">{role}</code>.</p>
        <Button onClick={onSignOut} variant="outline" fullWidth>Sign out</Button>
      </div>
    </div>
  );
}
