/**
 * Agent ActiveOrdersPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *  Brand-gradient header with:
 *    • Prominent online/offline toggle (the agent's single most important control)
 *    • Live stats: pickups, in-transit, today's earnings
 *
 *  Per-order card:
 *    • Shop info + "Navigate to pickup" Google Maps button
 *    • Customer info + "Call customer" tel: link
 *    • Drop-off address + "Navigate to drop" Google Maps button
 *    • Items summary
 *    • Bold action button to advance status
 *
 *  Realtime — subscribes to UPDATEs on orders where agent_id = me so newly
 *  assigned orders show up + status changes refresh instantly.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchAgentOrders,
  updateOrderStatus,
} from '../../services/ordersService';
import { setOnlineStatus, updateAgentLocation } from '../../services/agentsService';
import { startWatching, isGeolocationSupported } from '../../lib/geolocation';
import { NotificationBell } from '../../components/common';
import { formatPrice } from '../../config/business';
import { notify } from '../../lib/notify';
import {
  ORDER_STATUS,
  STATUS_LABELS,
  STATUS_ICONS,
  getNextStatus,
} from '../../config/orderStatus';
import { Button, Badge, EmptyState } from '../../ui';

export default function ActiveOrdersPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut, refreshProfile } = useAuth();

  const [orders,         setOrders]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [actingId,       setActingId]       = useState(null);
  const [togglingOnline, setTogglingOnline] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAgent = profile?.role === 'agent';

  // Fetch
  useEffect(() => {
    if (!isAgent || !profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await fetchAgentOrders(profile.id);
      if (cancelled) return;
      if (err) setError(err); else setOrders(data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAgent, profile?.id]);

  // Realtime
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`agent-orders:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `agent_id=eq.${profile.id}` },
        async () => {
          const { data } = await fetchAgentOrders(profile.id);
          setOrders(data ?? []);
        })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [profile?.id]);

  // ── Live GPS broadcast ──────────────────────────────────────────────────
  // Watches the agent's position while they're ONLINE and have at least one
  // in-transit delivery. Throttled to one DB write every 10s to keep load
  // manageable and battery friendly. Stops cleanly on unmount / state change.
  useEffect(() => {
    if (!profile?.id || !profile?.is_online) return;
    if (!isGeolocationSupported()) return;

    // Find the first in-transit order (status = out_for_delivery) — only
    // broadcast when we're actively delivering. No active delivery → no GPS.
    const hasActiveDelivery = orders.some(o => o.status === ORDER_STATUS.OUT_FOR_DELIVERY);
    if (!hasActiveDelivery) return;

    let lastSentAt = 0;
    const stop = startWatching(
      (loc) => {
        const now = Date.now();
        if (now - lastSentAt < 10_000) return;     // throttle to 10s
        lastSentAt = now;
        updateAgentLocation(profile.id, loc).catch(() => {});
      },
      (err) => console.warn('[Geolocation] watch error:', err),
    );

    return () => stop();
  }, [profile?.id, profile?.is_online, orders]);

  const handleToggleOnline = async () => {
    if (!profile?.id) return;
    setTogglingOnline(true);
    const { error: err } = await setOnlineStatus(profile.id, !profile.is_online);
    if (err) notify.error('Could not update status', err.message);
    else { await refreshProfile(); notify.success(profile.is_online ? "You're offline" : "You're online — ready to deliver"); }
    setTogglingOnline(false);
  };

  const handleAdvance = async (order) => {
    const next = getNextStatus(order.status);
    if (!next) return;
    setActingId(order.id);
    const { error: err } = await updateOrderStatus(order.id, next);
    setActingId(null);
    if (err) { notify.error('Update failed', err.message); return; }
    notify.success(`Marked ${STATUS_LABELS[next]}`);
  };

  if (!authLoading && session && profile && !isAgent) {
    return <RoleMismatch profile={profile} email={session.user.email} onSignOut={signOut} />;
  }

  const active = orders.filter(o => o.status !== ORDER_STATUS.DELIVERED && o.status !== 'cancelled');
  const pickup     = active.filter(o => ['placed','preparing'].includes(o.status));
  const inTransit  = active.filter(o => o.status === ORDER_STATUS.OUT_FOR_DELIVERY);

  // Today's earnings: sum of delivered orders today's total
  const todayEarn = useMemo(() => {
    const dayStart = new Date(); dayStart.setHours(0,0,0,0);
    return orders
      .filter(o => o.status === ORDER_STATUS.DELIVERED && new Date(o.created_at) >= dayStart)
      .reduce((s, o) => s + Number(o.total_price), 0);
  }, [orders]);

  return (
    <div className="min-h-screen bg-ink-50 pb-10">

      {/* Brand header */}
      <header className="bg-brand-gradient text-white px-4 pt-5 pb-14 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-accent-400/30 blur-2xl pointer-events-none" />

        <div className="mx-auto max-w-5xl relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Delivery Partner</p>
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold leading-tight truncate">
                Hi, {profile?.full_name?.split(' ')[0] || 'Rider'} 🛵
              </h1>
              <p className="mt-1 text-xs text-white/85">
                {profile?.vehicle_type && <>{profile.vehicle_type}{profile.vehicle_number && <> · {profile.vehicle_number}</>}</>}
              </p>
            </div>
            <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
              <NotificationBell />
            </div>
          </div>

          {/* Online toggle — BIG */}
          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className={`mt-5 inline-flex items-center gap-3 rounded-2xl px-5 h-14 font-bold transition-all active:scale-95 shadow-pop
              ${profile?.is_online
                ? 'bg-white text-green-700'
                : 'bg-white/15 backdrop-blur text-white border border-white/30 hover:bg-white/25'
              }`}
          >
            <span className={`relative flex h-3 w-3 ${profile?.is_online ? '' : 'opacity-60'}`}>
              {profile?.is_online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${profile?.is_online ? 'bg-green-500' : 'bg-white/60'}`} />
            </span>
            <div className="text-left leading-tight">
              <p className="text-base">{togglingOnline ? '…' : (profile?.is_online ? 'You are ONLINE' : 'You are OFFLINE')}</p>
              <p className="text-[11px] font-medium opacity-80">{profile?.is_online ? 'Tap to stop receiving deliveries' : 'Tap to start receiving'}</p>
            </div>
          </button>

          {/* Quick nav */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/agent/history"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-9 text-xs font-bold text-white hover:bg-white/25 transition-all">
              History →
            </Link>
            <Link to="/profile"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-9 text-xs font-bold text-white hover:bg-white/25 transition-all">
              Profile
            </Link>
            <button onClick={signOut}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/20 px-3 h-9 text-xs font-bold text-white hover:bg-white/25 transition-all">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 -mt-10 relative z-10 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Pickup" value={pickup.length}       icon="📦" tone="bg-amber-50 text-amber-700"  pulse={pickup.length > 0} />
          <StatCard label="In transit" value={inTransit.length} icon="🛵" tone="bg-purple-50 text-purple-700" />
          <StatCard label="Today" value={formatPrice(todayEarn)} icon="💰" tone="bg-green-50 text-green-700" small />
        </div>

        {loading && <SkeletonList />}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error.message}
          </div>
        )}

        {!loading && !error && active.length === 0 && (
          <EmptyState
            icon="🛵"
            title="No active deliveries"
            description={profile?.is_online
              ? "You're all caught up! New orders will appear here when assigned."
              : 'Switch to ONLINE above to start receiving deliveries.'}
          />
        )}

        {pickup.length > 0 && (
          <section>
            <h2 className="mb-3 px-1 font-display text-lg font-bold text-brand-700">📦 Pickup</h2>
            <ul className="space-y-3">
              {pickup.map(order => (
                <DeliveryCard key={order.id} order={order} acting={actingId === order.id} onAdvance={() => handleAdvance(order)} />
              ))}
            </ul>
          </section>
        )}

        {inTransit.length > 0 && (
          <section>
            <h2 className="mb-3 px-1 font-display text-lg font-bold text-ink-900">🛵 In transit</h2>
            <ul className="space-y-3">
              {inTransit.map(order => (
                <DeliveryCard key={order.id} order={order} acting={actingId === order.id} onAdvance={() => handleAdvance(order)} />
              ))}
            </ul>
          </section>
        )}

        {/* Spacer so sticky action bar doesn't cover the last card */}
        {inTransit.length === 1 && <div className="h-24" />}
      </main>

      {/* Sticky "Mark Delivered" bar — only shows when exactly ONE in-transit
          delivery. Most agents carry one at a time; one-tap completion. */}
      {inTransit.length === 1 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 py-3 bg-white border-t border-ink-100 shadow-pop">
          <div className="mx-auto max-w-5xl">
            <Button
              onClick={() => handleAdvance(inTransit[0])}
              loading={actingId === inTransit[0].id}
              size="lg"
              fullWidth
              rightIcon={!actingId && (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            >
              {actingId === inTransit[0].id ? 'Marking delivered…' : `Mark Delivered · ${formatPrice(inTransit[0].total_price)}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, tone, pulse, small }) {
  return (
    <div className={`relative rounded-2xl border border-ink-100 bg-white p-4 shadow-card overflow-hidden ${pulse ? 'animate-pulse-soft' : ''}`}>
      <div className={`absolute right-2 top-2 h-10 w-10 rounded-xl flex items-center justify-center text-xl ${tone}`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">{label}</p>
      <p className={`font-display font-extrabold text-ink-900 leading-none mt-1 ${small ? 'text-xl' : 'text-3xl'}`}>{value}</p>
    </div>
  );
}

// ─── DeliveryCard ──────────────────────────────────────────────────────────
function DeliveryCard({ order, acting, onAdvance }) {
  const shortId   = order.id.split('-')[0];
  const next      = getNextStatus(order.status);
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const isPickup  = ['placed','preparing'].includes(order.status);

  return (
    <li className="rounded-2xl border border-ink-100 bg-white shadow-card hover:shadow-pop transition-all overflow-hidden">

      {/* Header strip */}
      <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-brand-50 to-accent-50 border-b border-ink-100">
        <span className="text-2xl">{STATUS_ICONS[order.status]}</span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-ink-500">#{shortId}</p>
          <Badge tone={tone(order.status)} size="sm">{STATUS_LABELS[order.status]}</Badge>
        </div>
        <div className="text-right">
          <p className="font-display text-lg font-extrabold text-ink-900 leading-none">{formatPrice(order.total_price)}</p>
          <p className="text-[10px] text-ink-500 mt-0.5">{order.payment_method?.toUpperCase()}</p>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {/* Pickup row */}
        {order.shop && (
          <RouteRow
            kind="pickup"
            label="PICKUP FROM"
            name={order.shop.name}
            detail={order.shop.address}
            phone={order.shop.phone}
            mapsQuery={order.shop.address || order.shop.name}
            highlight={isPickup}
          />
        )}

        {/* Drop-off row */}
        <RouteRow
          kind="drop"
          label="DROP TO"
          name={order.customer?.full_name || 'Customer'}
          detail={order.delivery_address}
          phone={order.customer?.phone}
          mapsQuery={order.delivery_address}
          highlight={!isPickup}
        />

        {/* Items */}
        {order.order_items?.length > 0 && (
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-1.5">
              {itemCount} item{itemCount === 1 ? '' : 's'} in this order
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {order.order_items.slice(0, 6).map(item => (
                <li key={item.id} className="rounded-full bg-white border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700">
                  {item.products?.name ?? 'Item'} <span className="text-ink-400 font-bold">×{item.quantity}</span>
                </li>
              ))}
              {order.order_items.length > 6 && (
                <li className="rounded-full bg-white border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500">
                  +{order.order_items.length - 6} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Action bar */}
      {next && (
        <div className="border-t border-ink-100 bg-white p-3">
          <Button onClick={onAdvance} loading={acting} size="lg" fullWidth
            rightIcon={!acting && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}>
            {acting ? 'Updating…' : `Mark · ${STATUS_LABELS[next]}`}
          </Button>
        </div>
      )}
    </li>
  );
}

// ─── RouteRow ──────────────────────────────────────────────────────────────
function RouteRow({ kind, label, name, detail, phone, mapsQuery, highlight }) {
  const accent = kind === 'pickup' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700';
  const icon = kind === 'pickup' ? '🏪' : '📍';
  return (
    <div className={`relative rounded-xl p-3 ${highlight ? 'bg-gradient-to-br from-brand-50 to-white ring-2 ring-brand-200' : 'bg-ink-50/50 border border-ink-100'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${accent} text-xl`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">{label}</p>
          <p className="text-sm font-bold text-ink-900 truncate">{name}</p>
          {detail && <p className="text-xs text-ink-600 mt-0.5 line-clamp-2 whitespace-pre-line">{detail}</p>}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => openInMaps(mapsQuery)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 text-white px-3 h-10 text-xs font-bold shadow-brand hover:bg-brand-600 active:scale-95 transition-all">
          <NavigateIcon /> Navigate
        </button>
        {phone && (
          <a href={`tel:${phone}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 h-10 text-xs font-bold text-ink-700 hover:bg-ink-50 transition-all">
            <PhoneIcon /> Call
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function tone(status) {
  if (status === 'out_for_delivery') return 'purple';
  if (status === 'preparing')        return 'warning';
  if (status === 'delivered')        return 'success';
  return 'info';
}
function openInMaps(q) {
  if (!q) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank', 'noopener');
}
function NavigateIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 010 1.414L9.414 8.586a11.042 11.042 0 005.657 5.657l1.464-1.464a1 1 0 011.414 0l2.414 2.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1,2].map(i => <li key={i} className="h-60 animate-pulse rounded-2xl border border-ink-100 bg-white" />)}
    </ul>
  );
}

function RoleMismatch({ profile, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-amber-100 bg-white shadow-card p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-amber-900">Access denied</h2>
        <p className="text-sm text-amber-800">This dashboard is for delivery agents. Your role: <code className="rounded bg-amber-100 px-1 font-mono text-xs">{profile.role}</code>.</p>
        <Button onClick={onSignOut} variant="outline" fullWidth>Sign out</Button>
      </div>
    </div>
  );
}
