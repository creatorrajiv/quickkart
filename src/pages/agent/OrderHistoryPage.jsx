/**
 * Agent OrderHistoryPage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 *  Brand-gradient header + premium earnings cards (today / week / lifetime)
 *  + clean rows for every completed delivery.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { fetchAgentOrders } from '../../services/ordersService';
import { formatPrice, DELIVERY } from '../../config/business';
import { ORDER_STATUS } from '../../config/orderStatus';
import { NotificationBell } from '../../components/common';
import { Button, EmptyState, Skeleton } from '../../ui';

export default function OrderHistoryPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAgent = profile?.role === 'agent';

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

  const delivered = useMemo(() => orders.filter(o => o.status === ORDER_STATUS.DELIVERED), [orders]);

  const { today, week, total } = useMemo(() => {
    const now = new Date();
    const startOfDay  = new Date(now); startOfDay.setHours(0,0,0,0);
    const weekAgo     = new Date(now.getTime() - 7 * 86400 * 1000);
    const count = (filterFn) => delivered.filter(o => filterFn(new Date(o.created_at))).length;
    const t = count(d => d >= startOfDay);
    const w = count(d => d >= weekAgo);
    return {
      today: t * DELIVERY.agentEarningsPerJob,
      week:  w * DELIVERY.agentEarningsPerJob,
      total: delivered.length * DELIVERY.agentEarningsPerJob,
    };
  }, [delivered]);

  return (
    <div className="min-h-screen bg-ink-50 pb-10">

      <header className="bg-brand-gradient text-white px-4 pt-5 pb-12 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />

        <div className="mx-auto max-w-3xl relative flex items-center gap-3">
          <Link to="/agent/active-orders"
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">History & Earnings</p>
            <h1 className="font-display text-xl font-extrabold leading-tight truncate">
              {delivered.length} completed
            </h1>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 -mt-8 relative z-10 space-y-5">

        {/* Earnings: 3-up cards */}
        <div className="grid grid-cols-3 gap-3">
          <EarningCard label="Today"    amount={today} icon="💰" />
          <EarningCard label="Past 7d"  amount={week}  icon="📅" />
          <EarningCard label="Lifetime" amount={total} icon="🏆" big />
        </div>

        <div className="rounded-2xl bg-white border border-ink-100 shadow-card p-4">
          <p className="text-xs text-ink-500">
            Earnings are calculated at <span className="font-bold text-ink-900">{formatPrice(DELIVERY.agentEarningsPerJob)}</span> per delivery.
          </p>
        </div>

        {loading && (
          <ul className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-20" rounded="rounded-2xl" />)}
          </ul>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>
        )}

        {!loading && !error && delivered.length === 0 && (
          <EmptyState
            icon="📭"
            title="No deliveries yet"
            description="Completed orders will appear here."
            action={<Link to="/agent/active-orders"><Button>See active orders</Button></Link>}
          />
        )}

        {!loading && !error && delivered.length > 0 && (
          <ul className="space-y-2">
            {delivered.map(order => <HistoryRow key={order.id} order={order} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function EarningCard({ label, amount, icon, big }) {
  return (
    <div className={`relative rounded-2xl bg-white border border-ink-100 shadow-card p-4 overflow-hidden ${big ? 'ring-2 ring-brand-200' : ''}`}>
      <div className="absolute right-2 top-2 h-9 w-9 rounded-xl flex items-center justify-center text-lg bg-brand-50 text-brand-700">{icon}</div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">{label}</p>
      <p className={`font-display font-extrabold text-ink-900 leading-none mt-1 ${big ? 'text-xl' : 'text-base'}`}>
        {formatPrice(amount)}
      </p>
    </div>
  );
}

function HistoryRow({ order }) {
  const shortId   = order.id.split('-')[0];
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const at = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-2xl">✅</span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] text-ink-500">#{shortId}</p>
        <p className="text-sm font-bold text-ink-900 truncate">{order.delivery_address}</p>
        <p className="text-[11px] text-ink-500 mt-0.5">{itemCount} item{itemCount === 1 ? '' : 's'} · {at}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-base font-extrabold text-ink-900">{formatPrice(order.total_price)}</p>
        <p className="text-[10px] text-green-600 font-bold">+{formatPrice(DELIVERY.agentEarningsPerJob)}</p>
      </div>
    </li>
  );
}
