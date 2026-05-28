/**
 * Shopkeeper ShopProfilePage — v2 redesign
 * ──────────────────────────────────────────────────────────────────────────
 * Editable subset of shop fields. Brand-gradient header, clean card form.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { fetchMyShop, updateMyShop } from '../../services/shopkeepersService';
import { notify } from '../../lib/notify';
import { NotificationBell } from '../../components/common';
import { Button, Input, Textarea, Field, Badge } from '../../ui';

export default function ShopkeeperShopProfilePage() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const [shop,    setShop]    = useState(null);
  const [form,    setForm]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const isShopkeeper = profile?.role === 'shopkeeper';

  useEffect(() => {
    if (!isShopkeeper || !profile?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await fetchMyShop(profile.id);
      if (cancelled) return;
      if (err) setError(err);
      else {
        setShop(data);
        if (data) setForm({
          name:        data.name        ?? '',
          phone:       data.phone       ?? '',
          address:     data.address     ?? '',
          is_open:     data.is_open     ?? true,
          accepts_cod: data.accepts_cod ?? true,
          opens_at:    data.opens_at?.slice(0, 5)  ?? '',
          closes_at:   data.closes_at?.slice(0, 5) ?? '',
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isShopkeeper, profile?.id]);

  const update = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!shop || !form) return;
    setSaving(true);
    const { data, error: err } = await updateMyShop(shop.id, form);
    setSaving(false);
    if (err) { notify.error('Save failed', err.message); return; }
    setShop(data);
    notify.success('Settings saved');
  };

  if (!loading && !shop && isShopkeeper) {
    return (
      <div className="min-h-screen bg-ink-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border border-amber-100 bg-white shadow-card p-8 text-center">
          <p className="text-5xl mb-3">⏳</p>
          <h2 className="font-display text-xl font-bold text-amber-900">No shop linked yet</h2>
          <Link to="/shopkeeper/dashboard" className="mt-4 inline-block text-sm font-bold text-brand-600 hover:underline">← Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 pb-10">

      <header className="bg-brand-gradient text-white px-4 pt-5 pb-12 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-2xl relative flex items-center gap-3">
          <Link to="/shopkeeper/dashboard"
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Shop settings</p>
            <h1 className="font-display text-xl font-extrabold leading-tight truncate">{shop?.name || 'Your shop'}</h1>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 -mt-8 relative z-10">
        {loading && <div className="h-96 animate-pulse rounded-3xl bg-white border border-ink-100" />}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>
        )}

        {!loading && form && (
          <form onSubmit={submit} className="rounded-3xl border border-ink-100 bg-white shadow-card overflow-hidden">

            {/* Status badge strip */}
            <div className="bg-gradient-to-r from-brand-50 to-accent-50 px-5 py-3 border-b border-ink-100 flex items-center justify-between">
              <span className="text-xs font-bold text-ink-700">Status</span>
              <Badge tone={shop.status === 'active' ? 'success' : 'warning'} variant="solid" size="md">
                {shop.status}
              </Badge>
            </div>

            <div className="p-5 space-y-4">
              <Field label="Shop name" required>
                <Input value={form.name} onChange={update('name')} required />
              </Field>

              <Field label="Phone">
                <Input value={form.phone} onChange={update('phone')} placeholder="10-digit" />
              </Field>

              <Field label="Address" required>
                <Textarea rows={2} value={form.address} onChange={update('address')} required />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Opens at">
                  <Input type="time" value={form.opens_at} onChange={update('opens_at')} />
                </Field>
                <Field label="Closes at">
                  <Input type="time" value={form.closes_at} onChange={update('closes_at')} />
                </Field>
              </div>

              <div className="rounded-2xl bg-ink-50 p-4 space-y-3 border border-ink-100">
                <ToggleRow
                  label="Currently open"
                  description="Show as open to customers — orders can be placed."
                  checked={form.is_open}
                  onChange={update('is_open')}
                />
                <ToggleRow
                  label="Accept Cash on Delivery"
                  description="Allow customers to pay agents in cash."
                  checked={form.accepts_cod}
                  onChange={update('accepts_cod')}
                />
              </div>

              <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                <strong>Note:</strong> shop status (active/paused/suspended) can only be changed by an admin.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-ink-100 bg-ink-50/50 flex justify-end">
              <Button type="submit" loading={saving}>Save changes</Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange}
        className="mt-0.5 h-5 w-5 rounded text-brand-500 focus:ring-brand-500 cursor-pointer" />
      <div className="flex-1">
        <p className="text-sm font-bold text-ink-900">{label}</p>
        <p className="text-xs text-ink-500 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
