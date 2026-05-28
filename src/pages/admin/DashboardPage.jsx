/**
 * Admin DashboardPage — v2 redesign in AdminShell
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin
 *
 * Reuses admin_dashboard_metrics() RPC. Restyled with brand cards and modern
 * tables. Auth guard handled by AdminShell.
 */

import { useEffect, useState } from 'react';

import { fetchAdminMetrics } from '../../services/adminMetricsService';
import { formatPrice } from '../../config/business';
import { AdminShell } from '../../components/admin';
import { Skeleton } from '../../ui';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await fetchAdminMetrics();
      if (cancelled) return;
      if (err) setError(err); else setMetrics(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminShell title="Dashboard" subtitle="Platform overview · this month">
      {loading && <SkeletonGrid />}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

      {!loading && metrics && (
        <div className="space-y-6">
          {/* Revenue */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-500">Revenue</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <RevenueCard label="Today"      orders={metrics.today.orders} revenue={metrics.today.revenue} tone="from-emerald-500 to-emerald-600" />
              <RevenueCard label="This week"  orders={metrics.week.orders}  revenue={metrics.week.revenue}  tone="from-blue-500 to-blue-600" />
              <RevenueCard label="This month" orders={metrics.month.orders} revenue={metrics.month.revenue} tone="from-brand-500 to-brand-600" />
            </div>
          </section>

          {/* Live counters */}
          <section>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-500">Live state</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <CounterCard label="Active orders"     value={metrics.active_orders}        icon="📦" />
              <CounterCard label="Cancelled today"   value={metrics.cancelled_today}      icon="🚫" />
              <CounterCard label="Customers"         value={metrics.totals.customers}     icon="👤" />
              <CounterCard label="Active shops"      value={metrics.totals.shops}         icon="🏪" />
              <CounterCard label="Active agents"     value={metrics.totals.agents}        icon="🛵" />
              <CounterCard label="Shopkeepers"       value={metrics.totals.shopkeepers}   icon="🧑‍🍳" />
            </div>
          </section>

          {/* Top performers */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopList title="Top shops (this month)" emptyMsg="No data yet." rows={metrics.top_shops} columns={[
              { key: 'name',    label: 'Shop' },
              { key: 'orders',  label: 'Orders',  align: 'right' },
              { key: 'revenue', label: 'Revenue', align: 'right', fmt: formatPrice },
            ]} />
            <TopList title="Top agents (this month)" emptyMsg="No data yet." rows={metrics.top_agents} columns={[
              { key: 'full_name',     label: 'Agent' },
              { key: 'deliveries',    label: 'Deliveries', align: 'right' },
              { key: 'handled_value', label: 'Value',      align: 'right', fmt: formatPrice },
            ]} />
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function RevenueCard({ label, orders, revenue, tone }) {
  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${tone} text-white p-5 shadow-pop overflow-hidden`}>
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <p className="text-[10px] uppercase tracking-wide text-white/80 font-bold">{label}</p>
      <p className="font-display text-3xl font-extrabold leading-none mt-2">{formatPrice(revenue)}</p>
      <p className="text-xs text-white/80 mt-1">{orders} order{orders === 1 ? '' : 's'}</p>
    </div>
  );
}

function CounterCard({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:shadow-pop transition-all">
      <p className="text-2xl leading-none">{icon}</p>
      <p className="mt-1 font-display text-xl font-extrabold text-ink-900 leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">{label}</p>
    </div>
  );
}

function TopList({ title, rows, columns, emptyMsg }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <h3 className="font-display text-sm font-bold text-ink-900 mb-3">{title}</h3>
      {(!rows || rows.length === 0) ? (
        <p className="text-xs text-ink-500">{emptyMsg}</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-ink-500 font-bold">
            <tr>{columns.map(c => <th key={c.key} className={`pb-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className="border-t border-ink-100">
                {columns.map(c => (
                  <td key={c.key} className={`py-2 ${c.align === 'right' ? 'text-right font-mono font-semibold' : 'text-ink-700'}`}>
                    {c.fmt ? c.fmt(r[c.key] ?? 0) : (r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1,2,3].map(i => <Skeleton key={i} className="h-28" rounded="rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}
      </div>
    </div>
  );
}
