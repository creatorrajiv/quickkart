/**
 * Admin CouponsPage — Promo code management
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/coupons
 *
 *  • List every coupon with usage stats, validity, status
 *  • Add / edit / delete
 *  • Toggle active
 *  • Two discount types: percent or fixed
 */

import { useEffect, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchAllCoupons, createCoupon, updateCoupon, deleteCoupon,
} from '../../services/couponsService';
import { notify } from '../../lib/notify';
import { formatPrice } from '../../config/business';
import { Button, Card, Input, Textarea, Field, Select, Modal, Badge, EmptyState, Skeleton } from '../../ui';

export default function CouponsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [acting,    setActing]    = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchAllCoupons();
    if (err) setError(err); else setList(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    const op = editing ? updateCoupon(editing.id, form) : createCoupon(form);
    const { error } = await op;
    if (error) { notify.error('Save failed', error.message); return false; }
    notify.success(editing ? 'Coupon updated' : 'Coupon created');
    setModalOpen(false); setEditing(null);
    await load();
    return true;
  };

  const handleToggle = async (c) => {
    setActing(c.id);
    const { error } = await updateCoupon(c.id, { is_active: !c.is_active });
    setActing(null);
    if (error) { notify.error('Update failed', error.message); return; }
    setList(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    setActing(c.id);
    const { error } = await deleteCoupon(c.id);
    setActing(null);
    if (error) { notify.error('Delete failed', error.message); return; }
    setList(prev => prev.filter(x => x.id !== c.id));
    notify.success('Coupon deleted');
  };

  return (
    <AdminShell
      title="Coupons"
      subtitle={`${list.length} total · ${list.filter(c => c.is_active).length} active`}
      actions={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ New coupon</Button>}
    >
      {loading && <ul className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" rounded="rounded-2xl" />)}</ul>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

      {!loading && !error && list.length === 0 && (
        <EmptyState
          icon="🎟️"
          title="No coupons yet"
          description="Promo codes drive signups and repeat orders. Create one to get started."
          action={<Button onClick={() => setModalOpen(true)}>+ Create first coupon</Button>}
        />
      )}

      {!loading && !error && list.length > 0 && (
        <ul className="space-y-3">
          {list.map(c => (
            <CouponCard key={c.id} coupon={c} acting={acting === c.id}
              onEdit={() => { setEditing(c); setModalOpen(true); }}
              onToggle={() => handleToggle(c)}
              onDelete={() => handleDelete(c)} />
          ))}
        </ul>
      )}

      {modalOpen && (
        <CouponModal
          initial={editing}
          existingCodes={list.map(c => c.code).filter(code => code !== editing?.code)}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </AdminShell>
  );
}

function CouponCard({ coupon, acting, onEdit, onToggle, onDelete }) {
  const expired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
  const usagePct = coupon.usage_limit ? Math.round((coupon.used_count / coupon.usage_limit) * 100) : null;

  return (
    <Card>
      <div className="p-4 flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-accent-50 text-3xl">
            🎟️
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-extrabold tracking-wider text-ink-900">{coupon.code}</h3>
              <Badge tone={coupon.is_active && !expired ? 'success' : 'neutral'} size="sm">
                {expired ? '● Expired' : (coupon.is_active ? '● Active' : '○ Disabled')}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm font-bold text-brand-600">
              {coupon.discount_type === 'percent'
                ? `${coupon.discount_value}% off${coupon.max_discount ? ` (up to ${formatPrice(coupon.max_discount)})` : ''}`
                : `${formatPrice(coupon.discount_value)} off`}
              {coupon.min_order_amount > 0 && (
                <span className="text-ink-500 font-medium"> · Min {formatPrice(coupon.min_order_amount)}</span>
              )}
            </p>
            {coupon.description && <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{coupon.description}</p>}
            <p className="text-[11px] text-ink-500 mt-1">
              Used {coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ' times'} · {coupon.per_user_limit}× per user
              {coupon.valid_until && <> · until {new Date(coupon.valid_until).toLocaleDateString()}</>}
            </p>
            {usagePct !== null && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-brand-gradient transition-all" style={{ width: `${Math.min(100, usagePct)}%` }} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={acting}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={onToggle} disabled={acting}>
            {coupon.is_active ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={acting}>Delete</Button>
        </div>
      </div>
    </Card>
  );
}

function CouponModal({ initial, existingCodes, onClose, onSave }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    code:             initial?.code             ?? '',
    description:      initial?.description      ?? '',
    discount_type:    initial?.discount_type    ?? 'fixed',
    discount_value:   initial?.discount_value   ?? '',
    min_order_amount: initial?.min_order_amount ?? 0,
    max_discount:     initial?.max_discount     ?? '',
    usage_limit:      initial?.usage_limit      ?? '',
    per_user_limit:   initial?.per_user_limit   ?? 1,
    valid_until:      initial?.valid_until      ? initial.valid_until.slice(0, 10) : '',
    is_active:        initial?.is_active        ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked
      : e.target.type === 'number' ? e.target.value
      : k === 'code' ? e.target.value.toUpperCase().replace(/\s/g, '')
      : e.target.value;
    setForm(f => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const code = form.code.trim();
    if (!code) { notify.error('Code is required'); return; }
    if (existingCodes.includes(code)) { notify.error('Code already exists', 'Pick a different one.'); return; }
    if (Number(form.discount_value) <= 0) { notify.error('Discount must be greater than zero'); return; }

    setSubmitting(true);
    const payload = {
      code,
      description:      form.description.trim() || null,
      discount_type:    form.discount_type,
      discount_value:   Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_discount:     form.max_discount === '' ? null : Number(form.max_discount),
      usage_limit:      form.usage_limit  === '' ? null : Number(form.usage_limit),
      per_user_limit:   Number(form.per_user_limit) || 1,
      valid_until:      form.valid_until || null,
      is_active:        form.is_active,
    };
    const ok = await onSave(payload);
    if (!ok) setSubmitting(false);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit ${initial.code}` : 'New coupon'} size="md">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <Field label="Code" required hint="Uppercase, no spaces. Customers type this on the cart.">
          <Input value={form.code} onChange={update('code')} placeholder="WELCOME50" required disabled={isEdit} />
        </Field>

        <Field label="Description (optional)">
          <Textarea rows={2} value={form.description} onChange={update('description')} placeholder="₹50 off your first order" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount type" required>
            <Select value={form.discount_type} onChange={update('discount_type')}>
              <option value="fixed">Fixed (₹)</option>
              <option value="percent">Percent (%)</option>
            </Select>
          </Field>
          <Field label={form.discount_type === 'percent' ? 'Percent off' : 'Amount off (₹)'} required>
            <Input type="number" min="0" step="0.01" value={form.discount_value} onChange={update('discount_value')} required />
          </Field>
        </div>

        {form.discount_type === 'percent' && (
          <Field label="Max discount (₹)" hint="Optional cap for percent coupons">
            <Input type="number" min="0" step="0.01" value={form.max_discount} onChange={update('max_discount')} placeholder="e.g. 200" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min order amount (₹)">
            <Input type="number" min="0" step="0.01" value={form.min_order_amount} onChange={update('min_order_amount')} />
          </Field>
          <Field label="Valid until">
            <Input type="date" value={form.valid_until} onChange={update('valid_until')} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Total usage limit" hint="Blank = unlimited">
            <Input type="number" min="0" value={form.usage_limit} onChange={update('usage_limit')} placeholder="Unlimited" />
          </Field>
          <Field label="Per-user limit" required>
            <Input type="number" min="1" value={form.per_user_limit} onChange={update('per_user_limit')} required />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={update('is_active')} className="h-5 w-5 rounded text-brand-500" />
          Active (customers can use it)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={submitting}>{isEdit ? 'Save changes' : 'Create coupon'}</Button>
        </div>
      </form>
    </Modal>
  );
}
