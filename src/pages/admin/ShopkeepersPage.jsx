/**
 * Admin ShopkeepersPage — Shopkeeper Account Management
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/shopkeepers
 *
 *  • List every shopkeeper account, with which shop they own (if any).
 *  • Create a new shopkeeper auth account (Edge Function).
 *  • Activate / deactivate.
 *  • Linking a shopkeeper to a specific shop happens on /admin/shops by
 *    setting the "Owner" dropdown.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchShopkeepers,
  createShopkeeper,
  updateShopkeeper,
  deactivateShopkeeper,
  activateShopkeeper,
} from '../../services/shopkeepersService';
import { AdminShell } from '../../components/admin';
import { Button } from '../../ui';

export default function ShopkeepersPage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, signOut } = useAuth();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actingId, setActingId] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isAdmin = profile?.role === 'admin';

  const loadAll = async () => {
    setLoading(true);
    const { data, error: err } = await fetchShopkeepers();
    if (err) setError(err); else setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin]);

  const handleSave = async (form) => {
    if (editing) {
      const { error: err } = await updateShopkeeper(editing.id, {
        full_name: form.full_name, phone: form.phone,
      });
      if (err) { alert(`Save failed: ${err.message}`); return false; }
    } else {
      const { error: err } = await createShopkeeper(form);
      if (err) { alert(`Could not create shopkeeper: ${err.message}`); return false; }
    }
    setModalOpen(false); setEditing(null);
    await loadAll();
    return true;
  };

  const handleToggleActive = async (sk) => {
    setActingId(sk.id);
    const { error: err } = sk.is_active ? await deactivateShopkeeper(sk.id) : await activateShopkeeper(sk.id);
    setActingId(null);
    if (err) { alert(err.message); return; }
    setList(prev => prev.map(s => s.id === sk.id ? { ...s, is_active: !sk.is_active } : s));
  };

  if (!authLoading && session && profile && !isAdmin) {
    return <RoleMismatch role={profile.role} email={session.user.email} onSignOut={signOut} />;
  }

  return (
    <AdminShell
      title="Shopkeepers"
      subtitle={`${list.length} total · ${list.filter(s => s.is_active).length} active`}
      actions={
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} size="md">+ Add Shopkeeper</Button>
      }
    >
      <div className="space-y-4">
        {loading && <SkeletonList />}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && list.length === 0 && (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="text-6xl">👤</p>
            <h2 className="mt-4 text-lg font-bold text-gray-900">No shopkeepers yet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create a shopkeeper account, then link them to a shop from <a href="/admin/shops" className="underline">/admin/shops</a> using the Owner dropdown.
            </p>
            <button onClick={() => setModalOpen(true)}
              className="mt-5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 transition-all">
              + Create first shopkeeper
            </button>
          </div>
        )}

        {!loading && !error && list.length > 0 && (
          <ul className="space-y-3">
            {list.map(sk => (
              <li key={sk.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{sk.full_name || '(no name)'}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sk.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {sk.is_active ? 'Active' : 'Deactivated'}
                      </span>
                      {sk.shops?.length > 0 ? (
                        sk.shops.map(s => (
                          <span key={s.id} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            🏪 {s.name}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">⚠ No shop linked</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{sk.email}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{sk.phone || 'No phone'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => { setEditing(sk); setModalOpen(true); }} disabled={actingId === sk.id}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 active:scale-95 disabled:opacity-60 transition-all">
                      Edit
                    </button>
                    <button onClick={() => handleToggleActive(sk)} disabled={actingId === sk.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium active:scale-95 disabled:opacity-60 transition-all ${sk.is_active ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      {sk.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <ShopkeeperFormModal
          initial={editing}
          onCancel={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

function ShopkeeperFormModal({ initial, onCancel, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    email:     initial?.email     ?? '',
    password:  '',
    full_name: initial?.full_name ?? '',
    phone:     initial?.phone     ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && form.password.length < 6) { alert('Password must be at least 6 characters.'); return; }
    setSubmitting(true);
    const ok = await onSave(form);
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{isEdit ? `Edit shopkeeper: ${initial.full_name || initial.email}` : 'Onboard new shopkeeper'}</h2>

        <Field label="Email" required>
          <input type="email" className={INPUT} value={form.email} onChange={update('email')} required disabled={isEdit} placeholder="owner@kirana.com" />
        </Field>

        {!isEdit && (
          <Field label="Temporary password" required hint="Min 6 chars. Share with the shopkeeper; they can change after first login.">
            <input type="text" className={INPUT} value={form.password} onChange={update('password')} required minLength={6} />
          </Field>
        )}

        <Field label="Full name" required>
          <input className={INPUT} value={form.full_name} onChange={update('full_name')} required />
        </Field>

        <Field label="Phone" required>
          <input className={INPUT} value={form.phone} onChange={update('phone')} required placeholder="10-digit" />
        </Field>

        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Next step:</strong> after creating the account, go to <code className="rounded bg-amber-100 px-1 font-mono">/admin/shops</code>, edit the shop you want them to own, and pick their name in the <em>Owner</em> dropdown.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all">
            {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create shopkeeper')}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────
const INPUT = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
  disabled:bg-gray-100 disabled:text-gray-500`;
const NAV_BTN = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all';

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}

function SkeletonList() {
  return <ul className="space-y-3">{[1,2,3].map(i => <li key={i} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white" />)}</ul>;
}

function RoleMismatch({ role, email, onSignOut }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <h2 className="font-semibold text-amber-900">Access Denied</h2>
        <p className="text-sm text-amber-700">Admin role required. Yours: <code className="rounded bg-amber-100 px-1 font-mono text-xs">{role}</code>.</p>
        <button onClick={onSignOut} className="w-full rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">Sign out</button>
      </div>
    </div>
  );
}
