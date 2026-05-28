/**
 * Customer OrdersPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *   • Brand-gradient header
 *   • Filter tabs (All / Active / Delivered / Cancelled)
 *   • Modern card list with item thumbnails preview
 *   • Bottom nav on mobile
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth }    from '../../context/AuthContext';
import { useOrders }  from '../../hooks/useOrders';
import { formatPrice } from '../../config/business';
import { STATUS_LABELS, STATUS_COLORS, STATUS_ICONS } from '../../config/orderStatus';
import { NotificationBell }        from '../../components/common';
import { BottomNav }               from '../../components/customer';
import { Badge, EmptyState, Button } from '../../ui';
import { useReorder }              from '../../hooks/useReorder';

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { orders, loading, error } = useOrders();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const filtered = useMemo(() => {
    if (filter === 'all')       return orders;
    if (filter === 'active')    return orders.filter(o => ['placed','preparing','out_for_delivery'].includes(o.status));
    if (filter === 'delivered') return orders.filter(o => o.status === 'delivered');
    if (filter === 'cancelled') return orders.filter(o => o.status === 'cancelled');
    return orders;
  }, [orders, filter]);

  return (
    <div className="min-h-screen bg-ink-50 pb-32 sm:pb-10">

      {/* Brand-gradient header */}
      <header className="bg-brand-gradient text-white px-4 pt-5 pb-8 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-3xl flex items-center gap-3 relative">
          <button
            onClick={() => navigate('/shop')}
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all"
            aria-label="Back"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold leading-tight">My Orders</h1>
            <p className="text-xs text-white/85">
              {orders.length} order{orders.length === 1 ? '' : 's'} in total
            </p>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 -mt-5 relative z-10">

        {/* Filter tabs — pill row in a white card */}
        <div className="rounded-2xl bg-white shadow-card p-1.5 flex gap-1 overflow-x-auto scrollbar-hide">
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-1 min-w-fit px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all
                  ${active
                    ? 'bg-brand-500 text-white shadow-brand'
                    : 'text-ink-600 hover:bg-ink-100'
                  }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {loading && <SkeletonList />}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Could not load your orders. {error.message}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={filter === 'all' ? '📦' : '🔍'}
              title={filter === 'all' ? 'No orders yet' : 'Nothing here'}
              description={filter === 'all'
                ? 'Your order history will show up here once you place one.'
                : 'Try a different filter.'}
              action={filter === 'all' && (
                <Button onClick={() => navigate('/shop')}>Browse products</Button>
              )}
            />
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="space-y-3">
              {filtered.map(order => <OrderListItem key={order.id} order={order} />)}
            </ul>
          )}

          {/* Defensive — render BottomNav only here once we know we're staying on page */}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

// ─── Sub-views ─────────────────────────────────────────────────────────────

function OrderListItem({ order }) {
  const { reorder, busy: reordering } = useReorder();
  const shortId = order.id?.split('-')[0] ?? '';
  const colors  = STATUS_COLORS[order.status] ?? STATUS_COLORS.placed;
  const icon    = STATUS_ICONS[order.status]  ?? '📦';
  const label   = STATUS_LABELS[order.status] ?? order.status;
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const placedAt = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const canReorder = ['delivered','cancelled'].includes(order.status);

  // Up to 3 thumbnails from the order
  const thumbs = (order.order_items ?? []).slice(0, 3);
  const extra  = Math.max(0, (order.order_items?.length ?? 0) - 3);

  return (
    <li>
      <Link
        to={`/orders/${order.id}`}
        className="block rounded-2xl border border-ink-100 bg-white p-4 shadow-card
          hover:border-brand-200 hover:shadow-pop hover:-translate-y-0.5 active:scale-[0.99] transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colors.bg} text-lg`}>
              {icon}
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-400 font-bold">#{shortId}</p>
              <Badge tone={colorMapTone(order.status)} size="sm">{label}</Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-base font-extrabold text-ink-900">{formatPrice(order.total_price)}</p>
            <p className="text-[11px] text-ink-500">{placedAt}</p>
          </div>
        </div>

        {/* Item thumbs preview */}
        <div className="mt-3 flex items-center gap-2">
          {thumbs.map(item => (
            <div key={item.id} className="h-10 w-10 overflow-hidden rounded-lg bg-gradient-to-br from-ink-50 to-ink-100 border border-ink-100">
              {item.products?.image_url ? (
                <img src={item.products.image_url} alt={item.products.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base">📦</div>
              )}
            </div>
          ))}
          {extra > 0 && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-[11px] font-bold text-ink-600">
              +{extra}
            </div>
          )}
          <p className="ml-auto text-xs text-ink-500">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
        </div>
      </Link>
      {canReorder && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); reorder(order); }}
          disabled={reordering}
          className="mt-2 w-full rounded-xl bg-white border-2 border-brand-500 text-brand-600 font-bold text-xs py-2.5 hover:bg-brand-500 hover:text-white active:scale-[0.98] disabled:opacity-60 transition-all"
        >
          {reordering ? 'Adding to cart…' : '🔁 Reorder these items'}
        </button>
      )}
    </li>
  );
}

function colorMapTone(status) {
  if (status === 'delivered')        return 'success';
  if (status === 'cancelled')        return 'danger';
  if (status === 'out_for_delivery') return 'purple';
  if (status === 'preparing')        return 'warning';
  return 'info';
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1,2,3].map(i => (
        <li key={i} className="h-28 animate-pulse rounded-2xl border border-ink-100 bg-white" />
      ))}
    </ul>
  );
}
