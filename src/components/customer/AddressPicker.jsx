/**
 * AddressPicker — v2 saved-address selector for /cart
 * ──────────────────────────────────────────────────────────────────────────
 *   • Lists saved addresses as radio cards (Home / Office / …)
 *   • "+ Add new address" opens an inline form that saves to customer_addresses
 *     and selects it for this order
 *   • The selected address text is exposed via onChange (string)
 *
 * Props:
 *   userId      string                 — auth.uid()
 *   value       string                 — currently selected address text
 *   onChange    (addressText) => void  — called when selection changes
 */

import { useEffect, useState } from 'react';
import {
  fetchAddresses, createAddress, setDefaultAddress,
} from '../../services/addressesService';
import { notify } from '../../lib/notify';
import { Button, Input, Textarea, Field, Modal } from '../../ui';

export default function AddressPicker({ userId, value, onChange }) {
  const [addresses, setAddresses] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await fetchAddresses();
    const list = data ?? [];
    setAddresses(list);
    setLoading(false);

    // If no current value, auto-select default (or first)
    if (!value && list.length > 0) {
      const def = list.find(a => a.is_default) ?? list[0];
      setSelectedId(def.id);
      onChange?.(def.address);
    } else if (value) {
      // Match selected id by address text
      const matched = list.find(a => a.address === value);
      if (matched) setSelectedId(matched.id);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const pick = (addr) => { setSelectedId(addr.id); onChange?.(addr.address); };

  const handleAdded = async (newAddr) => {
    await load();
    setSelectedId(newAddr.id);
    onChange?.(newAddr.address);
    setModalOpen(false);
    notify.success('Address saved');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-base font-bold text-ink-900">Delivery address</h3>
        <button onClick={() => setModalOpen(true)}
          className="text-xs font-bold text-brand-600 hover:underline">
          + Add new
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white border border-ink-100" />)}
        </div>
      )}

      {!loading && addresses.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-ink-200 bg-white p-6 text-center">
          <p className="text-3xl mb-2">📍</p>
          <p className="text-sm font-semibold text-ink-900">No saved addresses</p>
          <p className="mt-1 text-xs text-ink-500">Add one so checkout is faster next time.</p>
          <Button onClick={() => setModalOpen(true)} variant="primary" size="md" className="mt-4">
            + Add address
          </Button>
        </div>
      )}

      {!loading && addresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {addresses.map(a => {
            const selected = selectedId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pick(a)}
                className={`relative text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.99]
                  ${selected
                    ? 'border-brand-500 bg-brand-50 shadow-brand'
                    : 'border-ink-100 bg-white hover:border-brand-200 hover:shadow-card'
                  }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{labelEmoji(a.label)}</span>
                  <p className="text-sm font-bold text-ink-900">{a.label}</p>
                  {a.is_default && (
                    <span className="ml-auto rounded-full bg-accent-400 text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">Default</span>
                  )}
                </div>
                <p className="text-xs text-ink-600 line-clamp-2 whitespace-pre-line">{a.address}</p>
                {a.phone && <p className="text-[11px] text-ink-500 mt-1">📞 {a.phone}</p>}
                {selected && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <NewAddressModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        userId={userId}
        onCreated={handleAdded}
      />
    </div>
  );
}

function labelEmoji(label) {
  const l = (label || '').toLowerCase();
  if (l.includes('home'))   return '🏠';
  if (l.includes('office') || l.includes('work')) return '🏢';
  if (l.includes('mom') || l.includes('dad') || l.includes('parent')) return '👨‍👩‍👧';
  if (l.includes('hostel') || l.includes('school') || l.includes('college')) return '🎓';
  return '📍';
}

function NewAddressModal({ open, onClose, userId, onCreated }) {
  const [form, setForm] = useState({ label: '', address: '', phone: '', is_default: false });
  const [saving, setSaving] = useState(false);
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await createAddress({ ...form, user_id: userId });
    setSaving(false);
    if (error) { notify.error('Could not save', error.message); return; }
    setForm({ label: '', address: '', phone: '', is_default: false });
    onCreated?.(data);
  };

  return (
    <Modal open={open} onClose={onClose} title="Add new address" size="md">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <Field label="Label" required>
          <Input value={form.label} onChange={update('label')} required placeholder="Home, Office, Mom's place…" />
        </Field>
        <Field label="Full address" required>
          <Textarea rows={3} value={form.address} onChange={update('address')} required placeholder="House no, street, area, city, PIN" />
        </Field>
        <Field label="Phone for this address" hint="Optional — used by delivery agent">
          <Input value={form.phone} onChange={update('phone')} placeholder="10-digit" />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" checked={form.is_default} onChange={update('is_default')} className="h-4 w-4 rounded text-brand-500 focus:ring-brand-500" />
          Set as default
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save address</Button>
        </div>
      </form>
    </Modal>
  );
}
