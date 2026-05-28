/**
 * Customer OrderDetailPage — v2 redesign + Live tracking
 * ──────────────────────────────────────────────────────────────────────────
 *  Sections:
 *   1. Brand-gradient header with short id + total
 *   2. Hero status card with vertical timeline
 *   3. Shop card (with "Call shop" if phone)
 *   4. Agent card (with "Call agent" + "Open in Google Maps" for delivery)
 *   5. Items list
 *   6. Bill breakdown
 *   7. Delivery address card + "Open in Maps"
 *   8. Cancel button (if status allows)
 *   9. Cancellation reason (if cancelled)
 *  10. Review block (if delivered)
 *
 *  Realtime — the page subscribes to UPDATEs on this single order row, so
 *  the status flips in place when shopkeeper/agent advance it.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { fetchOrderById, cancelOrder } from '../../services/ordersService';
import { fetchReviewForOrder, submitReview } from '../../services/reviewsService';
import { calculateOrderTotals, formatPrice, getDeliveryETA } from '../../config/business';
import { useReorder } from '../../hooks/useReorder';
import { notify } from '../../lib/notify';
import {
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_ICONS,
  getStatusIndex,
} from '../../config/orderStatus';
import { NotificationBell } from '../../components/common';
import { Button, Textarea, Badge } from '../../ui';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [review,     setReview]     = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  // Fetch + subscribe
  useEffect(() => {
    if (!id || !session) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data, error: err }, { data: rev }] = await Promise.all([
        fetchOrderById(id),
        fetchReviewForOrder(id),
      ]);
      if (cancelled) return;
      if (err) setError(err); else setOrder(data);
      setReview(rev);
      setLoading(false);
    })();

    // Realtime: re-fetch on any update
    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        async () => {
          const { data } = await fetchOrderById(id);
          if (!cancelled) setOrder(data);
        })
      .subscribe();

    return () => { cancelled = true; channel.unsubscribe(); };
  }, [id, session]);

  const totals = useMemo(() => {
    if (!order?.order_items) return null;
    const subtotal = order.order_items.reduce(
      (sum, i) => sum + Number(i.price_at_purchase) * i.quantity, 0);
    return calculateOrderTotals(subtotal);
  }, [order]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell onBack={() => navigate('/orders')} title="Loading…">
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-ink-100" />)}
        </div>
      </Shell>
    );
  }

  if (error || !order) {
    return (
      <Shell onBack={() => navigate('/orders')} title="Order">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          {error?.message ?? 'Order not found.'}
        </div>
      </Shell>
    );
  }

  const shortId = order.id.split('-')[0];
  const placedAt = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const cancelled = order.status === 'cancelled';

  return (
    <Shell onBack={() => navigate('/orders')} title={`#${shortId}`} subtitle={formatPrice(order.total_price)}>
      <div className="space-y-5">

        {/* ── Status hero with timeline ── */}
        <StatusHero order={order} placedAt={placedAt} cancelled={cancelled} />

        {/* ── Shop card ── */}
        {order.shop && <ShopCard shop={order.shop} />}

        {/* ── Agent card ── */}
        {order.agent && <AgentCard agent={order.agent} address={order.delivery_address} />}

        {/* ── Items ── */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h3 className="font-display text-base font-bold text-ink-900 mb-3">
            Items <span className="text-ink-500 font-normal text-sm">({order.order_items.length})</span>
          </h3>
          <ul className="divide-y divide-ink-100">
            {order.order_items.map(item => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                {item.products?.image_url ? (
                  <img src={item.products.image_url} alt="" className="h-14 w-14 rounded-xl object-cover bg-ink-100" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-2xl">🛒</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-900 truncate">{item.products?.name ?? 'Product'}</p>
                  <p className="text-xs text-ink-500">{formatPrice(item.price_at_purchase)} × {item.quantity}</p>
                </div>
                <p className="font-display text-base font-bold text-ink-900">
                  {formatPrice(Number(item.price_at_purchase) * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Bill ── */}
        {totals && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h3 className="font-display text-base font-bold text-ink-900 mb-3">Bill details</h3>
            <dl className="space-y-2.5 text-sm">
              <Row label="Item total"   value={formatPrice(totals.subtotal)} />
              <Row label="Delivery fee" value={totals.delivery === 0 ? 'FREE' : formatPrice(totals.delivery)} highlight={totals.delivery === 0} />
              <Row label="Taxes & charges" value={formatPrice(totals.tax)} />
              <div className="border-t border-dashed border-ink-200 my-2" />
              <div className="flex items-center justify-between">
                <dt className="font-display text-base font-bold text-ink-900">Total paid</dt>
                <dd className="font-display text-xl font-extrabold text-ink-900">{formatPrice(order.total_price)}</dd>
              </div>
              <div className="text-xs text-ink-500 pt-1">
                Paid via <span className="uppercase font-bold text-ink-700">{order.payment_method}</span>
              </div>
            </dl>
          </section>
        )}

        {/* ── Delivery address + Open in Maps ── */}
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-base font-bold text-ink-900">Delivery to</h3>
              <p className="mt-1.5 text-sm text-ink-700 whitespace-pre-line">{order.delivery_address}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openInMaps(order.delivery_address)}
              leftIcon={<MapIcon />}
            >
              Map
            </Button>
          </div>
        </section>

        {/* ── Cancellation block ── */}
        {cancelled && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h3 className="font-display text-base font-bold text-red-900 mb-1">Order cancelled</h3>
            {order.cancellation_reason && (
              <p className="text-sm text-red-700">Reason: {order.cancellation_reason}</p>
            )}
            {order.cancelled_at && (
              <p className="mt-1 text-xs text-red-600">{new Date(order.cancelled_at).toLocaleString()}</p>
            )}
          </section>
        )}

        {/* ── Cancel button ── */}
        {['placed','preparing'].includes(order.status) && (
          <CancelOrderBlock
            orderId={order.id}
            cancelling={cancelling}
            setCancelling={setCancelling}
            onCancelled={(o) => setOrder(o)}
          />
        )}

        {/* ── Review ── */}
        {order.status === 'delivered' && (
          <ReviewBlock order={order} existing={review} onSubmitted={setReview} />
        )}

        {/* ── Reorder ── */}
        {['delivered','cancelled'].includes(order.status) && (
          <ReorderButton order={order} />
        )}
      </div>
    </Shell>
  );
}

function ReorderButton({ order }) {
  const { reorder, busy } = useReorder();
  return (
    <button
      onClick={() => reorder(order)}
      disabled={busy}
      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white border-2 border-brand-500 text-brand-600 font-bold py-3.5 hover:bg-brand-500 hover:text-white active:scale-[0.98] disabled:opacity-60 transition-all"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {busy ? 'Adding…' : 'Reorder these items'}
    </button>
  );
}

// ─── Shell ─────────────────────────────────────────────────────────────────
function Shell({ onBack, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-ink-50 pb-10">
      <header className="bg-brand-gradient text-white px-4 pt-5 pb-8 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-3xl flex items-center gap-3 relative">
          <button
            onClick={onBack}
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold leading-tight">Order {title}</h1>
            {subtitle && <p className="text-xs text-white/85">{subtitle}</p>}
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 -mt-4 relative z-10">{children}</main>
    </div>
  );
}

// ─── Status hero with vertical timeline ────────────────────────────────────
function StatusHero({ order, placedAt, cancelled }) {
  const eta = !cancelled ? getDeliveryETA(order.status) : null;
  if (cancelled) {
    return (
      <section className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🚫</span>
          <div>
            <h2 className="font-display text-xl font-bold text-red-900">Cancelled</h2>
            <p className="text-xs text-red-700">Placed on {placedAt}</p>
          </div>
        </div>
      </section>
    );
  }

  const currentIdx = getStatusIndex(order.status);

  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card overflow-hidden">
      <div className="bg-gradient-to-br from-brand-50 to-accent-50 px-5 py-4 border-b border-ink-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-ink-500 font-bold">Current status</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl animate-pulse-soft">{STATUS_ICONS[order.status]}</span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-bold text-ink-900 truncate">
                  {STATUS_LABELS[order.status]}
                </h2>
                <p className="text-xs text-ink-600">Placed on {placedAt}</p>
              </div>
            </div>
          </div>
          {eta && order.status !== 'delivered' && (
            <div className="flex-shrink-0 text-right rounded-2xl bg-white px-4 py-2 border border-ink-100 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">Arriving in</p>
              <p className="font-display text-lg font-extrabold text-brand-600 leading-tight">{eta.label}</p>
            </div>
          )}
        </div>
      </div>

      <ol className="px-5 py-4">
        {STATUS_ORDER.map((status, idx) => {
          const reached = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast = idx === STATUS_ORDER.length - 1;
          return (
            <li key={status} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Vertical line */}
              {!isLast && (
                <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${reached && idx < currentIdx ? 'bg-brand-500' : 'bg-ink-200'}`} />
              )}
              {/* Dot */}
              <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all
                ${reached
                  ? (isCurrent ? 'bg-brand-500 text-white shadow-brand ring-4 ring-brand-100 animate-pulse-soft' : 'bg-brand-500 text-white shadow-brand')
                  : 'bg-ink-100 text-ink-400'
                }`}>
                {reached ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{idx + 1}</span>
                )}
              </div>
              <div className="pt-0.5">
                <p className={`text-sm font-bold ${reached ? 'text-ink-900' : 'text-ink-400'}`}>
                  {STATUS_LABELS[status]}
                </p>
                {isCurrent && (
                  <p className="text-[11px] text-brand-600 font-semibold mt-0.5">in progress…</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── Shop & Agent cards ────────────────────────────────────────────────────
function ShopCard({ shop }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-2xl">🏪</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">From shop</p>
          <p className="text-sm font-bold text-ink-900 truncate">{shop.name}</p>
          {shop.address && <p className="text-xs text-ink-500 truncate">{shop.address}</p>}
        </div>
        {shop.phone && (
          <a href={`tel:${shop.phone}`}
            className="rounded-xl border border-ink-200 bg-white px-3 h-9 inline-flex items-center gap-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50 transition-all">
            <PhoneIcon /> Call
          </a>
        )}
      </div>
    </section>
  );
}

function AgentCard({ agent, address }) {
  const hasLiveLocation = agent.current_lat != null && agent.current_lng != null;
  const locFreshSec = agent.location_updated_at
    ? Math.floor((Date.now() - new Date(agent.location_updated_at).getTime()) / 1000)
    : null;
  const isLive = hasLiveLocation && locFreshSec != null && locFreshSec < 60;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-purple-100 text-2xl">
          🛵
          {isLive && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">
            Delivery partner {isLive && <span className="text-green-600">· LIVE</span>}
          </p>
          <p className="text-sm font-bold text-ink-900 truncate">{agent.full_name || 'Agent'}</p>
          {agent.vehicle_type && (
            <p className="text-xs text-ink-500 truncate">
              {agent.vehicle_type}{agent.vehicle_number && <> · {agent.vehicle_number}</>}
            </p>
          )}
        </div>
        <div className="flex gap-1.5">
          {hasLiveLocation && (
            <button onClick={() => openInMaps(`${agent.current_lat},${agent.current_lng}`)}
              className="rounded-xl bg-green-500 hover:bg-green-600 text-white px-3 h-9 inline-flex items-center gap-1.5 text-xs font-bold shadow active:scale-95 transition-all">
              <MapIcon /> Live
            </button>
          )}
          {agent.phone && (
            <a href={`tel:${agent.phone}`}
              className="rounded-xl border border-ink-200 bg-white px-3 h-9 inline-flex items-center gap-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50 transition-all">
              <PhoneIcon /> Call
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Cancel block ──────────────────────────────────────────────────────────
function CancelOrderBlock({ orderId, cancelling, setCancelling, onCancelled }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setCancelling(true);
    const { data, error } = await cancelOrder(orderId, reason || null);
    setCancelling(false);
    if (error) { notify.error('Cancellation failed', error.message); return; }
    notify.success('Order cancelled');
    setOpen(false);
    onCancelled(data);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-red-200 bg-white px-4 py-3.5 text-sm font-bold text-red-700 hover:bg-red-50 active:scale-[0.99] transition-all">
        Cancel this order
      </button>
    );
  }
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5 space-y-3">
      <h3 className="font-display text-base font-bold text-red-900">Cancel order</h3>
      <Textarea rows={2} placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Keep order</Button>
        <Button variant="danger" size="sm" onClick={submit} loading={cancelling}>Confirm cancel</Button>
      </div>
    </section>
  );
}

// ─── Review block ──────────────────────────────────────────────────────────
function ReviewBlock({ order, existing, onSubmitted }) {
  const [shopRating,  setShopRating]  = useState(existing?.shop_rating  ?? 0);
  const [agentRating, setAgentRating] = useState(existing?.agent_rating ?? 0);
  const [comment,     setComment]     = useState(existing?.comment      ?? '');
  const [saving,      setSaving]      = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (shopRating === 0 && agentRating === 0) { notify.error('Pick at least one rating'); return; }
    setSaving(true);
    const { data, error } = await submitReview({
      order_id:     order.id,
      customer_id:  order.customer_id,
      shop_id:      order.shop_id  ?? null,
      agent_id:     order.agent_id ?? null,
      shop_rating:  shopRating  || null,
      agent_rating: agentRating || null,
      comment:      comment.trim() || null,
    });
    setSaving(false);
    if (error) { notify.error('Save failed', error.message); return; }
    onSubmitted(data);
    notify.success(existing ? 'Review updated' : 'Thanks for your feedback!');
  };

  return (
    <section className="rounded-2xl border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-brand-50 p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-card text-2xl">⭐</span>
        <div>
          <h3 className="font-display text-base font-bold text-ink-900">
            {existing ? 'Update your rating' : 'How was your order?'}
          </h3>
          <p className="text-xs text-ink-600">Your feedback helps shops and agents improve.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        {order.shop_id && (
          <div className="rounded-xl bg-white p-3 border border-ink-100">
            <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Rate the shop</p>
            <Stars value={shopRating} onChange={setShopRating} />
          </div>
        )}
        {order.agent_id && (
          <div className="rounded-xl bg-white p-3 border border-ink-100">
            <p className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1.5">Rate the delivery</p>
            <Stars value={agentRating} onChange={setAgentRating} />
          </div>
        )}
        <Textarea rows={2} placeholder="Tell others what stood out (optional)…" value={comment} onChange={e => setComment(e.target.value)} />
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>{existing ? 'Update review' : 'Submit review'}</Button>
        </div>
      </form>
    </section>
  );
}

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n === value ? 0 : n)}
          className={`text-3xl leading-none transition-all hover:scale-125
            ${n <= value ? 'text-accent-400 drop-shadow-sm' : 'text-ink-200'}`}
          aria-label={`${n} star`}>★</button>
      ))}
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-600">{label}</dt>
      <dd className={`font-semibold ${highlight ? 'text-green-600 font-bold' : 'text-ink-900'}`}>{value}</dd>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function openInMaps(address) {
  if (!address) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  window.open(url, '_blank', 'noopener');
}

function MapIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.553 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
