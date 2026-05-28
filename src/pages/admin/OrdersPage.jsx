/**
 * Admin OrdersPage — All Orders Dashboard
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/orders
 *
 * Lists every order in the system, with:
 *  • Status filter chips
 *  • Customer name/email
 *  • "Advance status" action (placed → preparing → out_for_delivery → delivered)
 *
 * Auth:
 *  • Effect-based guard checks profile.role === 'admin'.
 *  • Same UX as ProductsPage so the role-mismatch screen feels consistent.
 *
 * Adaptability:
 *  • Want search by order id / customer? Add an <input> bound to a query
 *    state and filter `orders` locally.
 *  • Want bulk actions? Wrap rows in checkboxes and pass selected ids to a
 *    new ordersService.bulkUpdateStatus(ids, status).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchAllOrders,
  updateOrderStatus,
  fetchAgents,
  assignAgent,
  assignShop,
} from '../../services/ordersService';
import { fetchShops } from '../../services/shopsService';
import { AssignmentModeToggle, AdminShell } from '../../components/admin';
import { Button, Select } from '../../ui';
import { downloadCSV } from '../../lib/csv';
import { notify } from '../../lib/notify';
import { formatPrice } from '../../config/business';
import {
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_ICONS,
  getNextStatus,
} from '../../config/orderStatus';

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();

  const [orders, setOrders] = useState([]);
  const [agents, setAgents] = useState([]);
  const [shops,  setShops]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');  // 'all' | <status>
  const [advancingId, setAdvancingId] = useState(null);
  const [assigningId, setAssigningId] = useState(null);     // tracks both shop+agent saves
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkBusy,    setBulkBusy]    = useState(false);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  // ── Fetch all orders (admin RLS) ─────────────────────────────────────────
  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [
        { data: orderData, error: err },
        { data: agentData },
        { data: shopData },
      ] = await Promise.all([
        fetchAllOrders(),
        fetchAgents(),
        fetchShops(),
      ]);
      if (cancelled) return;
      if (err) setError(err);
      else    setOrders(orderData ?? []);
      setAgents(agentData ?? []);
      setShops(shopData ?? []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [isAdmin]);

  // ── Filtered view ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (showUnassignedOnly)     list = list.filter(o => !o.shop_id);
    return list;
  }, [orders, statusFilter, showUnassignedOnly]);

  const unassignedCount = useMemo(
    () => orders.filter(o => !o.shop_id).length,
    [orders],
  );

  // ── Counts per status (for chip badges) ──────────────────────────────────
  const counts = useMemo(() => {
    const c = { all: orders.length };
    for (const s of STATUS_ORDER) c[s] = 0;
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  // ── Handle agent assignment ──────────────────────────────────────────────
  const handleAssign = async (order, agentId) => {
    setAssigningId(order.id);
    const next = agentId === '' ? null : agentId;
    const { error: err } = await assignAgent(order.id, next);
    setAssigningId(null);

    if (err) {
      alert(`Could not assign agent: ${err.message}`);
      return;
    }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, agent_id: next } : o));
  };

  // ── Handle shop (re)assignment ──────────────────────────────────────────
  const handleAssignShop = async (order, shopId) => {
    setAssigningId(order.id);
    const nextId   = shopId === '' ? null : shopId;
    const { error: err } = await assignShop(order.id, nextId);
    setAssigningId(null);

    if (err) {
      alert(`Could not assign shop: ${err.message}`);
      return;
    }
    const nextShop = nextId ? shops.find(s => s.id === nextId) : null;
    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, shop_id: nextId, shop: nextShop ? { id: nextShop.id, name: nextShop.name } : null } : o
    ));
  };

  // ── Handle status advance ────────────────────────────────────────────────
  const handleAdvance = async (order) => {
    const next = getNextStatus(order.status);
    if (!next) return;

    setAdvancingId(order.id);
    const { error: err } = await updateOrderStatus(order.id, next);
    setAdvancingId(null);

    if (err) {
      alert(`Could not update status: ${err.message}`);
      return;
    }
    // Optimistic local update
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: next } : o));
  };

  // Selection helpers
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllVisible = () => {
    setSelectedIds(prev => {
      const all = new Set(prev);
      filtered.forEach(o => all.add(o.id));
      return all;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // Bulk assign agent
  const handleBulkAssignAgent = async (agentId) => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    setBulkBusy(true);
    const nextAgentId = agentId === '' ? null : agentId;
    // Best-effort sequential — keeps DB load low and surfaces partial failures
    let failed = 0;
    for (const id of ids) {
      const order = orders.find(o => o.id === id);
      if (!order) continue;
      const { error } = await assignAgent(id, nextAgentId);
      if (error) failed++;
    }
    // Refresh full list
    const { data } = await fetchAllOrders();
    setOrders(data ?? []);
    setBulkBusy(false);
    clearSelection();
    if (failed === 0)        notify.success(`Updated ${ids.length} order${ids.length === 1 ? '' : 's'}`);
    else if (failed === ids.length) notify.error('Bulk assign failed', 'No orders were updated.');
    else                     notify.warning(`${ids.length - failed} updated, ${failed} failed`);
  };

  // Bulk advance status (one step forward for each)
  const handleBulkAdvance = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Advance ${selectedIds.size} order${selectedIds.size === 1 ? '' : 's'} to the next status?`)) return;
    setBulkBusy(true);
    let advanced = 0;
    for (const id of selectedIds) {
      const order = orders.find(o => o.id === id);
      if (!order) continue;
      const next = getNextStatus(order.status);
      if (!next) continue;
      const { error } = await updateOrderStatus(id, next);
      if (!error) advanced++;
    }
    const { data } = await fetchAllOrders();
    setOrders(data ?? []);
    setBulkBusy(false);
    clearSelection();
    notify.success(`Advanced ${advanced} order${advanced === 1 ? '' : 's'}`);
  };

  // CSV export
  const handleExport = () => {
    downloadCSV(`orders-${new Date().toISOString().slice(0,10)}.csv`, filtered, [
      { key: 'id',                 label: 'Order ID' },
      { key: 'created_at',         label: 'Placed at',   fmt: v => new Date(v).toISOString() },
      { key: 'status',             label: 'Status' },
      { key: 'total_price',        label: 'Total',       fmt: v => Number(v).toFixed(2) },
      { key: 'payment_method',     label: 'Payment' },
      { label: 'Customer',         value: o => o.customer?.full_name ?? '' },
      { label: 'Customer email',   value: o => o.customer?.email ?? '' },
      { label: 'Shop',             value: o => o.shop?.name ?? '' },
      { label: 'Agent',            value: o => o.agent?.full_name ?? '' },
      { key: 'delivery_address',   label: 'Delivery address' },
      { key: 'cancellation_reason',label: 'Cancellation reason' },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminShell
      title="Orders"
      subtitle={`${orders.length} total${unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ''}`}
      actions={
        <>
          <AssignmentModeToggle />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
            ⤓ CSV
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* ── Filter chips ── */}
        <div className="flex flex-wrap gap-2">
          <Chip
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label={`All (${counts.all})`}
          />
          {STATUS_ORDER.map(s => (
            <Chip
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={`${STATUS_ICONS[s]} ${STATUS_LABELS[s]} (${counts[s] ?? 0})`}
              colors={STATUS_COLORS[s]}
            />
          ))}
          {unassignedCount > 0 && (
            <Chip
              active={showUnassignedOnly}
              onClick={() => setShowUnassignedOnly(v => !v)}
              label={`⚠️ Unassigned (${unassignedCount})`}
              colors={{ bg: 'bg-red-100', text: 'text-red-700' }}
            />
          )}
        </div>

        {/* ── Body ── */}
        {loading && <SkeletonList />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load orders. {error.message}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No orders match this filter.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            {/* Bulk action bar — only when something is selected */}
            {selectedIds.size > 0 && (
              <div className="sticky top-[60px] z-10 rounded-2xl border border-brand-200 bg-brand-50 shadow-pop p-3 flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold text-brand-700">
                  {selectedIds.size} selected
                </p>
                <Select
                  size="sm"
                  defaultValue=""
                  onChange={(e) => handleBulkAssignAgent(e.target.value)}
                  disabled={bulkBusy}
                  className="!w-48"
                >
                  <option value="" disabled>Assign agent…</option>
                  <option value="">— Unassign —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.email}</option>)}
                </Select>
                <Button size="sm" variant="secondary" onClick={handleBulkAdvance} disabled={bulkBusy}>
                  Advance status
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy} className="ml-auto">
                  Clear
                </Button>
              </div>
            )}

            {/* Select-all bar */}
            <div className="flex items-center gap-3 px-2 text-xs text-ink-600">
              <button onClick={selectAllVisible} className="font-bold text-brand-600 hover:underline">
                Select all {filtered.length}
              </button>
              {selectedIds.size > 0 && (
                <button onClick={clearSelection} className="font-bold text-ink-500 hover:underline">
                  Clear
                </button>
              )}
            </div>

            <ul className="space-y-3">
              {filtered.map(order => (
                <OrderRow
                  key={order.id}
                  order={order}
                  agents={agents}
                  shops={shops}
                  selected={selectedIds.has(order.id)}
                  onToggleSelect={() => toggleSelect(order.id)}
                  advancing={advancingId === order.id}
                  assigning={assigningId === order.id}
                  onAdvance={() => handleAdvance(order)}
                  onAssign={(agentId) => handleAssign(order, agentId)}
                  onAssignShop={(shopId) => handleAssignShop(order, shopId)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </AdminShell>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function OrderRow({ order, agents, shops, selected, onToggleSelect, advancing, assigning, onAdvance, onAssign, onAssignShop }) {
  const shortId = order.id.split('-')[0];
  const colors = STATUS_COLORS[order.status] ?? STATUS_COLORS.placed;
  const next = getNextStatus(order.status);
  const itemCount = order.order_items?.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const placedAt = new Date(order.created_at).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <li className={`rounded-xl border bg-white p-4 shadow-sm transition-colors ${selected ? 'border-brand-300 ring-2 ring-brand-100' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Selection checkbox */}
        {onToggleSelect && (
          <label className="flex-shrink-0 mt-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!selected}
              onChange={onToggleSelect}
              className="h-5 w-5 rounded text-brand-500 focus:ring-brand-400 cursor-pointer"
            />
          </label>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-gray-500">#{shortId}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              <span>{STATUS_ICONS[order.status]}</span>
              {STATUS_LABELS[order.status]}
            </span>
            {order.shop ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                🏪 {order.shop.name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                ⚠️ Unassigned
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {order.customer?.full_name ?? 'Customer'}
            <span className="ml-2 text-xs font-normal text-gray-500">{order.customer?.email}</span>
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {itemCount} item{itemCount === 1 ? '' : 's'} • {placedAt} • {order.payment_method?.toUpperCase()}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <p className="text-sm font-bold text-gray-900">{formatPrice(order.total_price)}</p>
          {next ? (
            <button
              onClick={onAdvance}
              disabled={advancing}
              className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white
                hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all"
            >
              {advancing ? 'Updating…' : `Mark ${STATUS_LABELS[next]} →`}
            </button>
          ) : (
            <span className="text-xs font-medium text-green-700">Completed</span>
          )}
        </div>
      </div>

      {/* Compact item preview */}
      {order.order_items?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {order.order_items.slice(0, 4).map(item => (
            <li key={item.id} className="flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-1 text-xs text-gray-700">
              <span className="font-medium">{item.products?.name ?? 'Item'}</span>
              <span className="text-gray-400">×{item.quantity}</span>
            </li>
          ))}
          {order.order_items.length > 4 && (
            <li className="rounded-full bg-gray-50 px-2 py-1 text-xs text-gray-500">
              +{order.order_items.length - 4} more
            </li>
          )}
        </ul>
      )}

      <p className="mt-3 text-xs text-gray-500 whitespace-pre-line">
        <span className="font-medium text-gray-700">Address:</span> {order.delivery_address}
      </p>

      {/* ── Shop + Agent assignment ── */}
      <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2">
          <label className="w-12 text-xs font-medium text-gray-700">Shop:</label>
          <select
            value={order.shop_id ?? ''}
            onChange={(e) => onAssignShop(e.target.value)}
            disabled={assigning || shops.length === 0}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs
              focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
          >
            <option value="">{shops.length === 0 ? 'No shops onboarded' : 'Unassigned'}</option>
            {shops.map(s => (
              <option key={s.id} value={s.id} disabled={s.status !== 'active' || !s.is_open}>
                {s.name}{s.status !== 'active' ? ` (${s.status})` : ''}{!s.is_open ? ' — closed' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="w-12 text-xs font-medium text-gray-700">Agent:</label>
          <select
            value={order.agent_id ?? ''}
            onChange={(e) => onAssign(e.target.value)}
            disabled={assigning || agents.length === 0}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs
              focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
          >
            <option value="">{agents.length === 0 ? 'No agents registered' : 'Unassigned'}</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.full_name || a.email}
              </option>
            ))}
          </select>
          {assigning && <span className="text-xs text-gray-500">Saving…</span>}
        </div>
      </div>
    </li>
  );
}

function Chip({ active, onClick, label, colors }) {
  const activeClasses = colors
    ? `${colors.bg} ${colors.text} border-transparent`
    : 'bg-orange-500 text-white border-orange-500';
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors
        ${active ? activeClasses : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
    >
      {label}
    </button>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map(i => (
        <li key={i} className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white" />
      ))}
    </ul>
  );
}

function RoleMismatch({ profile, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-amber-900">Access Denied</h2>
          <p className="mt-1 text-sm text-amber-700">
            This dashboard requires the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">admin</code> role.
            Your current role is <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">{profile.role}</code>.
          </p>
        </div>
        <div className="rounded-lg bg-white border border-amber-200 p-3 text-xs text-gray-700 font-mono leading-relaxed">
          <p className="mb-1 font-semibold text-gray-800">To grant admin access, run in Supabase SQL editor:</p>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
{`UPDATE public.profiles
SET role = 'admin'
WHERE email = '${email}';`}
          </pre>
        </div>
        <button
          onClick={onSignOut}
          className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm
            font-medium text-amber-700 hover:bg-amber-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
