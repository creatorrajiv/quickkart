/**
 * ProfilePage — Universal /profile route
 * ──────────────────────────────────────────────────────────────────────────
 * Works for any signed-in user (customer / agent / shopkeeper / admin).
 *
 * Sections:
 *   1. Account — full_name, phone (everyone)
 *   2. Password change (everyone)
 *   3. Saved addresses (customer only)
 *
 * The page intentionally avoids role-specific extras (agent KYC, shop
 * settings) — those live on the role's own dashboards.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../../services/addressesService';
import { NotificationBell } from '../../components/common';
import { isPushSupported, getPermission, subscribeToPush, unsubscribeFromPush } from '../../lib/push';
import { notify } from '../../lib/notify';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading, updateProfile, signOut } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const homePath = useMemo(() => ({
    admin:      '/admin/orders',
    agent:      '/agent/active-orders',
    customer:   '/shop',
    shopkeeper: '/shopkeeper/dashboard',
  })[profile?.role] ?? '/', [profile?.role]);

  if (authLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to={homePath} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100" aria-label="Back">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
            <h1 className="text-base font-bold text-gray-900">My Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button onClick={signOut} className={NAV_BTN}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6">
        <AccountSection profile={profile} onSave={updateProfile} />
        <PasswordSection />
        <NotificationsSection userId={profile.id} />
        {profile.role === 'customer' && <AddressBookSection userId={profile.id} />}
        <RoleBadge role={profile.role} email={profile.email} />
      </main>
    </div>
  );
}

// ─── Account section ────────────────────────────────────────────────────────
function AccountSection({ profile, onSave }) {
  const [form, setForm] = useState({ full_name: profile.full_name ?? '', phone: profile.phone ?? '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (k) => (e) => { setSaved(false); setForm(f => ({ ...f, [k]: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await onSave(form);
    setSaving(false);
    if (error) { alert(error.message); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card title="Account">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Email" hint="Email changes require admin assistance.">
          <input className={INPUT} value={profile.email ?? ''} disabled />
        </Field>
        <Field label="Full name">
          <input className={INPUT} value={form.full_name} onChange={update('full_name')} />
        </Field>
        <Field label="Phone">
          <input className={INPUT} value={form.phone} onChange={update('phone')} placeholder="10-digit" />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
          <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Card>
  );
}

// ─── Password section ───────────────────────────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const update = (k) => (e) => { setSaved(false); setForm(f => ({ ...f, [k]: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    if (form.next.length < 6) { alert('Password must be at least 6 characters.'); return; }
    if (form.next !== form.confirm) { alert('Passwords do not match.'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: form.next });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setForm({ next: '', confirm: '' });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="space-y-3">
        <Field label="New password" hint="Minimum 6 characters.">
          <input type="password" className={INPUT} value={form.next} onChange={update('next')} required minLength={6} />
        </Field>
        <Field label="Confirm new password">
          <input type="password" className={INPUT} value={form.confirm} onChange={update('confirm')} required minLength={6} />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs font-medium text-emerald-600">Updated ✓</span>}
          <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Updating…' : 'Update password'}</button>
        </div>
      </form>
    </Card>
  );
}

// ─── Browser push notifications ─────────────────────────────────────────────
function NotificationsSection({ userId }) {
  const [supported]  = useState(() => isPushSupported());
  const [permission, setPermission] = useState(() => (supported ? getPermission() : 'unsupported'));
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    const { error } = await subscribeToPush(userId);
    setBusy(false);
    setPermission(getPermission());
    if (error) { notify.error('Could not enable push', error.message); return; }
    notify.success('Push notifications enabled');
  };

  const disable = async () => {
    setBusy(true);
    await unsubscribeFromPush(userId);
    setBusy(false);
    setPermission(getPermission());
    notify.success('Push notifications disabled');
  };

  return (
    <Card title="Browser push notifications">
      {!supported && (
        <p className="text-sm text-ink-500">Your browser doesn't support push notifications.</p>
      )}
      {supported && permission === 'denied' && (
        <p className="text-sm text-amber-700 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          You blocked notifications. Re-enable them in your browser site settings, then come back here.
        </p>
      )}
      {supported && permission !== 'denied' && (
        <div className="space-y-3">
          <p className="text-sm text-ink-600">
            Get order updates even when QuickKart is closed — directly to your device.
          </p>
          {permission === 'granted' ? (
            <button onClick={disable} disabled={busy}
              className={SECONDARY_BTN + ' inline-flex items-center gap-2'}>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {busy ? 'Disabling…' : 'Enabled — turn off'}
            </button>
          ) : (
            <button onClick={enable} disabled={busy} className={PRIMARY_BTN}>
              {busy ? 'Enabling…' : 'Enable push notifications'}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Address book ───────────────────────────────────────────────────────────
function AddressBookSection({ userId }) {
  const [addresses, setAddresses] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await fetchAddresses();
    setAddresses(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    const op = editing
      ? updateAddress(editing.id, form, userId)
      : createAddress({ ...form, user_id: userId });
    const { error } = await op;
    if (error) { alert(error.message); return false; }
    setModalOpen(false); setEditing(null);
    await load();
    return true;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this address?')) return;
    await deleteAddress(id);
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const handleSetDefault = async (id) => {
    await setDefaultAddress(id, userId);
    await load();
  };

  return (
    <Card
      title="Saved addresses"
      action={
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className={`${SECONDARY_BTN} text-xs`}>
          + Add
        </button>
      }
    >
      {loading && <div className="h-12 animate-pulse rounded-lg bg-gray-100" />}
      {!loading && addresses.length === 0 && (
        <p className="text-sm text-gray-500">No saved addresses yet. Adding one makes checkout faster.</p>
      )}
      {!loading && addresses.length > 0 && (
        <ul className="space-y-2">
          {addresses.map(a => (
            <li key={a.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                    {a.is_default && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">Default</span>}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-gray-600">{a.address}</p>
                  {a.phone && <p className="mt-0.5 text-xs text-gray-500">📞 {a.phone}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  {!a.is_default && (
                    <button onClick={() => handleSetDefault(a.id)} className="text-[10px] font-medium text-orange-600 hover:underline">Make default</button>
                  )}
                  <button onClick={() => { setEditing(a); setModalOpen(true); }} className="text-[10px] font-medium text-gray-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(a.id)} className="text-[10px] font-medium text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {modalOpen && <AddressModal initial={editing} onCancel={() => { setModalOpen(false); setEditing(null); }} onSave={handleSave} />}
    </Card>
  );
}

function AddressModal({ initial, onCancel, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    label:      initial?.label      ?? '',
    address:    initial?.address    ?? '',
    phone:      initial?.phone      ?? '',
    is_default: initial?.is_default ?? false,
  });
  const [submitting, setSubmitting] = useState(false);
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await onSave(form);
    if (!ok) setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit address' : 'New address'}</h2>
        <Field label="Label" required><input className={INPUT} value={form.label} onChange={update('label')} required placeholder="Home, Office, …" /></Field>
        <Field label="Full address" required><textarea className={INPUT} rows={3} value={form.address} onChange={update('address')} required /></Field>
        <Field label="Phone for this address"><input className={INPUT} value={form.phone} onChange={update('phone')} placeholder="Optional" /></Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_default} onChange={update('is_default')} className="h-4 w-4 rounded text-orange-500" />
          Set as default
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className={SECONDARY_BTN}>Cancel</button>
          <button type="submit" disabled={submitting} className={PRIMARY_BTN}>{submitting ? 'Saving…' : (isEdit ? 'Save' : 'Add address')}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Bits ───────────────────────────────────────────────────────────────────
function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
      {children}
      {hint && <p className="mt-0.5 text-[10px] text-gray-500">{hint}</p>}
    </div>
  );
}

function RoleBadge({ role, email }) {
  return (
    <p className="text-center text-xs text-gray-400">
      Signed in as <code className="rounded bg-gray-200 px-1 font-mono">{role}</code> · {email}
    </p>
  );
}

const INPUT = `w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
  disabled:bg-gray-100 disabled:text-gray-500`;
const NAV_BTN = 'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all';
const PRIMARY_BTN = 'rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 active:scale-95 disabled:opacity-60 transition-all';
const SECONDARY_BTN = 'rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:scale-95 transition-all';
