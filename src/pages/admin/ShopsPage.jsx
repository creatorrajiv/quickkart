/**
 * Admin ShopsPage — Kirana Onboarding & Management
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/shops
 *
 * Responsibilities:
 *  • List every shop (newest first), with status + open/closed badges and
 *    a monthly order counter that proves the fairness allocator is working.
 *  • Onboard a new shop in one form.
 *  • Edit / pause / suspend / delete shops.
 *  • Seed the new shop's inventory in one click (marks every product
 *    available at the shop so it becomes eligible for assignment).
 *  • Surface the global Auto/Manual assignment mode toggle.
 *
 * Adaptability:
 *  • Map picker for lat/lng → swap the two number inputs for a Leaflet /
 *    Google Maps component (Phase B).
 *  • Owner linking → today the field is empty; Phase C will let admin paste
 *    a shopkeeper email and look up their profile id.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchShops,
  createShop,
  updateShop,
  deleteShop,
  seedShopInventory,
  fetchShopMonthlyOrderCounts,
} from '../../services/shopsService';
import { fetchShopkeepers } from '../../services/shopkeepersService';
import { AssignmentModeToggle, AdminShell } from '../../components/admin';
import { Button } from '../../ui';

const STATUS_META = {
  active:    { label: 'Active',    chip: 'bg-green-100 text-green-700'   },
  pending:   { label: 'Pending',   chip: 'bg-blue-100 text-blue-700'     },
  paused:    { label: 'Paused',    chip: 'bg-amber-100 text-amber-700'   },
  suspended: { label: 'Suspended', chip: 'bg-red-100 text-red-700'       },
};

export default function ShopsPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();

  const [shops,         setShops]         = useState([]);
  const [shopkeepers,   setShopkeepers]   = useState([]);
  const [monthCounts,   setMonthCounts]   = useState({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editingShop,   setEditingShop]   = useState(null);
  const [actingId,      setActingId]      = useState(null);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAdmin = profile?.role === 'admin';

  // ── Data load ────────────────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    const [{ data, error: err }, { data: counts }, { data: sks }] = await Promise.all([
      fetchShops(),
      fetchShopMonthlyOrderCounts(),
      fetchShopkeepers(),
    ]);
    if (err) setError(err);
    else     setShops(data ?? []);
    setMonthCounts(counts ?? {});
    setShopkeepers(sks ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const handleSave = async (formData) => {
    const result = editingShop
      ? await updateShop(editingShop.id, formData)
      : await createShop(formData);

    if (result.error) {
      alert(`Save failed: ${result.error.message}`);
      return false;
    }
    setModalOpen(false);
    setEditingShop(null);
    await loadAll();
    return true;
  };

  const handleDelete = async (shop) => {
    if (!window.confirm(`Delete "${shop.name}"? Its inventory rows are removed. Orders are preserved (shop reference cleared).`)) return;
    setActingId(shop.id);
    const { error: err } = await deleteShop(shop.id);
    setActingId(null);
    if (err) {
      alert(`Delete failed: ${err.message}`);
      return;
    }
    setShops(prev => prev.filter(s => s.id !== shop.id));
  };

  const handleToggleOpen = async (shop) => {
    setActingId(shop.id);
    const { error: err } = await updateShop(shop.id, { is_open: !shop.is_open });
    setActingId(null);
    if (err) { alert(err.message); return; }
    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_open: !shop.is_open } : s));
  };

  const handleSeedInventory = async (shop) => {
    if (!window.confirm(`Seed inventory: mark ALL existing products as available at "${shop.name}"? You can fine-tune from the shopkeeper dashboard later.`)) return;
    setActingId(shop.id);
    const { count, error: err } = await seedShopInventory(shop.id);
    setActingId(null);
    if (err) { alert(`Seed failed: ${err.message}`); return; }
    alert(`Seeded ${count} products as available at ${shop.name}.`);
  };

  // ── Derived (hooks must run unconditionally; keep above any early return) ─
  const totalMonthly = useMemo(
    () => Object.values(monthCounts).reduce((s, n) => s + n, 0),
    [monthCounts],
  );

  // ── Role mismatch ────────────────────────────────────────────────────────
  if (!authLoading && session && profile && !isAdmin) {
    return <RoleMismatch role={profile.role} email={session.user.email} onSignOut={signOut} />;
  }

  return (
    <AdminShell
      title="Shops"
      subtitle={`${shops.length} total · ${totalMonthly} orders distributed this month`}
      actions={
        <>
          <AssignmentModeToggle />
          <Button onClick={() => { setEditingShop(null); setModalOpen(true); }} size="md">+ Add Shop</Button>
        </>
      }
    >
      <div className="space-y-4">
        {loading && <SkeletonList />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load shops. {error.message}
          </div>
        )}

        {!loading && !error && shops.length === 0 && <EmptyState onAdd={() => setModalOpen(true)} />}

        {!loading && !error && shops.length > 0 && (
          <ul className="space-y-3">
            {shops.map(shop => (
              <ShopCard
                key={shop.id}
                shop={shop}
                monthlyCount={monthCounts[shop.id] ?? 0}
                acting={actingId === shop.id}
                onEdit={() => { setEditingShop(shop); setModalOpen(true); }}
                onDelete={() => handleDelete(shop)}
                onToggleOpen={() => handleToggleOpen(shop)}
                onSeedInventory={() => handleSeedInventory(shop)}
              />
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <ShopFormModal
          initial={editingShop}
          shopkeepers={shopkeepers}
          onCancel={() => { setModalOpen(false); setEditingShop(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────────

function ShopCard({ shop, monthlyCount, acting, onEdit, onDelete, onToggleOpen, onSeedInventory }) {
  const statusMeta = STATUS_META[shop.status] ?? STATUS_META.pending;
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{shop.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusMeta.chip}`}>
              {statusMeta.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              shop.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}>
              {shop.is_open ? '● Open' : '○ Closed'}
            </span>
            {shop.accepts_cod && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                COD
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{shop.address}</p>
          <p className="mt-1 text-xs text-gray-500">
            {shop.phone || 'No phone'}
            {(shop.opens_at || shop.closes_at) && (
              <> · Hours: {shop.opens_at?.slice(0, 5) ?? '—'} → {shop.closes_at?.slice(0, 5) ?? '—'}</>
            )}
            {shop.owner?.full_name && <> · Owner: {shop.owner.full_name}</>}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-gray-500">This month</p>
          <p className="text-2xl font-bold text-gray-900 leading-none">{monthlyCount}</p>
          <p className="text-[10px] text-gray-500">orders received</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button onClick={onToggleOpen} disabled={acting}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-60 transition-all">
          {shop.is_open ? 'Close shop' : 'Open shop'}
        </button>
        <button onClick={onSeedInventory} disabled={acting}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-60 transition-all">
          Seed inventory
        </button>
        <button onClick={onEdit} disabled={acting}
          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 active:scale-95 disabled:opacity-60 transition-all">
          Edit
        </button>
        <button onClick={onDelete} disabled={acting}
          className="ml-auto rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 active:scale-95 disabled:opacity-60 transition-all">
          Delete
        </button>
      </div>
    </li>
  );
}

function ShopFormModal({ initial, shopkeepers = [], onCancel, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(() => ({
    name:        initial?.name        ?? '',
    phone:       initial?.phone       ?? '',
    address:     initial?.address     ?? '',
    lat:         initial?.lat         ?? '',
    lng:         initial?.lng         ?? '',
    status:      initial?.status      ?? 'active',
    is_open:     initial?.is_open     ?? true,
    accepts_cod: initial?.accepts_cod ?? true,
    opens_at:    initial?.opens_at?.slice(0, 5)  ?? '',
    closes_at:   initial?.closes_at?.slice(0, 5) ?? '',
    owner_id:    initial?.owner_id    ?? '',
  }));
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      lat: form.lat === '' ? null : Number(form.lat),
      lng: form.lng === '' ? null : Number(form.lng),
      owner_id: form.owner_id || null,
    };
    const ok = await onSave(payload);
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit shop' : 'Onboard new shop'}</h2>

        <Field label="Shop name" required>
          <input className={INPUT} value={form.name} onChange={update('name')} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className={INPUT} value={form.phone} onChange={update('phone')} placeholder="10-digit" />
          </Field>
          <Field label="Status">
            <select className={INPUT} value={form.status} onChange={update('status')}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="paused">Paused</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>
        </div>

        <Field label="Address" required>
          <textarea className={INPUT} rows={2} value={form.address} onChange={update('address')} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" hint="Optional — used in Phase B for distance">
            <input type="number" step="any" className={INPUT} value={form.lat} onChange={update('lat')} placeholder="e.g. 28.6139" />
          </Field>
          <Field label="Longitude">
            <input type="number" step="any" className={INPUT} value={form.lng} onChange={update('lng')} placeholder="e.g. 77.2090" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Opens at">
            <input type="time" className={INPUT} value={form.opens_at} onChange={update('opens_at')} />
          </Field>
          <Field label="Closes at">
            <input type="time" className={INPUT} value={form.closes_at} onChange={update('closes_at')} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_open} onChange={update('is_open')} className="h-4 w-4 rounded text-orange-500 focus:ring-orange-500" />
            Open now
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.accepts_cod} onChange={update('accepts_cod')} className="h-4 w-4 rounded text-orange-500 focus:ring-orange-500" />
            Accepts COD
          </label>
        </div>

        <Field label="Owner (shopkeeper)" hint="Pick the shopkeeper account that should manage this shop. Create accounts at /admin/shopkeepers first.">
          <select className={INPUT} value={form.owner_id} onChange={update('owner_id')}>
            <option value="">— Unassigned —</option>
            {shopkeepers.map(sk => (
              <option key={sk.id} value={sk.id}>
                {sk.full_name || '(no name)'} — {sk.email}
              </option>
            ))}
          </select>
        </Field>

        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Tip:</strong> after saving, click <em>Seed inventory</em> on the new shop to mark all products available so it starts receiving orders.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">
            Cancel
          </button>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create shop')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Form field + skeleton + empty + access-denied helpers ──────────────────

const INPUT = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
  disabled:bg-gray-100 disabled:text-gray-500`;

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map(i => (
        <li key={i} className="h-32 animate-pulse rounded-xl border border-gray-200 bg-white" />
      ))}
    </ul>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="text-6xl">🏪</p>
      <h2 className="mt-4 text-lg font-bold text-gray-900">No shops yet</h2>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Onboard the first kirana to start accepting orders. Until at least one shop exists in <strong>auto</strong> mode,
        new orders will land with no shop assigned and an admin will need to pick one manually.
      </p>
      <button
        onClick={onAdd}
        className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 transition-all"
      >
        + Onboard first shop
      </button>
    </div>
  );
}

function RoleMismatch({ role, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-amber-900">Access Denied</h2>
          <p className="mt-1 text-sm text-amber-700">
            This dashboard requires the <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">admin</code> role.
            Your current role is <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">{role}</code>.
          </p>
        </div>
        <div className="rounded-lg bg-white border border-amber-200 p-3 text-xs text-gray-700 font-mono leading-relaxed">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all">
{`UPDATE public.profiles
SET role = 'admin'
WHERE email = '${email}';`}
          </pre>
        </div>
        <button
          onClick={onSignOut}
          className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
