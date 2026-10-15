/**
 * Admin PayoutsPage — Money owed + payouts ledger
 * ──────────────────────────────────────────────────────────────────────────
 *  Route: /admin/payouts
 *
 *   • Shops table: gross revenue from delivered orders, paid out, net owed
 *   • Agents table: deliveries × per-job rate, paid out, net owed
 *   • Per row: "Record payout" → modal to enter amount/method/reference
 *   • Per row: drill into payout history for that shop/agent
 */

import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchPayoutsSummary,
  fetchShopPayouts, fetchAgentPayouts,
  recordShopPayout, recordAgentPayout,
} from '../../services/payoutsService';
import { formatPrice, DELIVERY } from '../../config/business';
import { notify } from '../../lib/notify';
import { Button, Card, Input, Textarea, Field, Select, Modal, Badge, Skeleton } from '../../ui';

export default function PayoutsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [payoutTarget, setPayoutTarget] = useState(null);  // { type: 'shop'|'agent', row }
  const [historyTarget, setHistoryTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const { data: d, error: err } = await fetchPayoutsSummary();
    if (err) setError(err); else setData(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    if (!data) return { shopsOwed: 0, agentsOwed: 0 };
    const shopsOwed  = (data.shops  ?? []).reduce((s, r) => s + Math.max(0, r.gross_delivered - r.total_paid_out), 0);
    const agentsOwed = (data.agents ?? []).reduce((s, r) => s + Math.max(0, r.gross_earned    - r.total_paid_out), 0);
    return { shopsOwed, agentsOwed };
  }, [data]);

  return (
    <AdminShell
      title="Payouts"
      subtitle={data ? `${formatPrice(totals.shopsOwed)} owed to shops · ${formatPrice(totals.agentsOwed)} owed to agents` : '…'}
    >
      {loading && <ul className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" rounded="rounded-2xl" />)}</ul>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* Shops */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink-900 px-1">🏪 Shops</h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Shop</th>
                      <th className="px-4 py-2 text-right">Delivered</th>
                      <th className="px-4 py-2 text-right">Gross revenue</th>
                      <th className="px-4 py-2 text-right">Paid out</th>
                      <th className="px-4 py-2 text-right">Net owed</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.shops.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">No shops yet.</td></tr>
                    )}
                    {data.shops.map(s => {
                      const owed = Math.max(0, s.gross_delivered - s.total_paid_out);
                      return (
                        <tr key={s.id} className="border-t border-ink-100 hover:bg-ink-50">
                          <td className="px-4 py-3 font-bold text-ink-900">{s.name}</td>
                          <td className="px-4 py-3 text-right text-ink-700">{s.delivered_count}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatPrice(s.gross_delivered)}</td>
                          <td className="px-4 py-3 text-right font-mono text-ink-500">{formatPrice(s.total_paid_out)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-display font-extrabold ${owed > 0 ? 'text-brand-600' : 'text-ink-400'}`}>
                              {formatPrice(owed)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => setHistoryTarget({ type: 'shop', row: s })}>History</Button>
                            <Button size="sm" onClick={() => setPayoutTarget({ type: 'shop', row: s })} className="ml-2">+ Pay</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* Agents */}
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-ink-900 px-1">
              🛵 Agents <span className="text-xs font-medium text-ink-500">· {formatPrice(DELIVERY.agentEarningsPerJob)} per delivery</span>
            </h2>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Agent</th>
                      <th className="px-4 py-2 text-right">Deliveries</th>
                      <th className="px-4 py-2 text-right">Earned</th>
                      <th className="px-4 py-2 text-right">Paid out</th>
                      <th className="px-4 py-2 text-right">Net owed</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agents.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">No agents yet.</td></tr>
                    )}
                    {data.agents.map(a => {
                      const owed = Math.max(0, a.gross_earned - a.total_paid_out);
                      return (
                        <tr key={a.id} className="border-t border-ink-100 hover:bg-ink-50">
                          <td className="px-4 py-3 font-bold text-ink-900">{a.full_name || '(no name)'}</td>
                          <td className="px-4 py-3 text-right text-ink-700">{a.delivered_count}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatPrice(a.gross_earned)}</td>
                          <td className="px-4 py-3 text-right font-mono text-ink-500">{formatPrice(a.total_paid_out)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-display font-extrabold ${owed > 0 ? 'text-brand-600' : 'text-ink-400'}`}>
                              {formatPrice(owed)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button size="sm" variant="outline" onClick={() => setHistoryTarget({ type: 'agent', row: a })}>History</Button>
                            <Button size="sm" onClick={() => setPayoutTarget({ type: 'agent', row: a })} className="ml-2">+ Pay</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </div>
      )}

      {payoutTarget && (
        <PayoutModal
          target={payoutTarget}
          onClose={() => setPayoutTarget(null)}
          onSaved={async () => { setPayoutTarget(null); await load(); }}
        />
      )}

      {historyTarget && (
        <HistoryModal
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </AdminShell>
  );
}

function PayoutModal({ target, onClose, onSaved }) {
  const { type, row } = target;
  const [form, setForm] = useState({ amount: '', method: 'upi', reference: '', note: '' });
  const [saving, setSaving] = useState(false);
  const update = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) { notify.error('Enter a valid amount'); return; }
    setSaving(true);
    const fn = type === 'shop' ? recordShopPayout : recordAgentPayout;
    const args = type === 'shop'
      ? { shopId:  row.id, amount: amt, method: form.method, reference: form.reference, note: form.note }
      : { agentId: row.id, amount: amt, method: form.method, reference: form.reference, note: form.note };
    const { error } = await fn(args);
    setSaving(false);
    if (error) { notify.error('Save failed', error.message); return; }
    notify.success('Payout recorded');
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Record payout · ${type === 'shop' ? row.name : row.full_name}`} size="md">
      <form onSubmit={submit} className="px-5 py-4 space-y-4">
        <Field label="Amount (₹)" required>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={update('amount')} required autoFocus />
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={update('method')}>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Reference / UTR" hint="Transaction reference for your records.">
          <Input value={form.reference} onChange={update('reference')} placeholder="e.g. UTR12345" />
        </Field>
        <Field label="Note">
          <Textarea rows={2} value={form.note} onChange={update('note')} placeholder="Optional" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Record payout</Button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ target, onClose }) {
  const { type, row } = target;
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const fn = type === 'shop' ? fetchShopPayouts : fetchAgentPayouts;
      const { data } = await fn(row.id);
      setList(data ?? []);
      setLoading(false);
    })();
  }, [type, row.id]);

  return (
    <Modal open onClose={onClose} title={`Payout history · ${type === 'shop' ? row.name : row.full_name}`} size="lg">
      <div className="px-5 py-4">
        {loading && <Skeleton className="h-32" rounded="rounded-xl" />}
        {!loading && list.length === 0 && <p className="text-sm text-ink-500 py-6 text-center">No payouts recorded yet.</p>}
        {!loading && list.length > 0 && (
          <ul className="divide-y divide-ink-100">
            {list.map(p => (
              <li key={p.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-extrabold text-ink-900">{formatPrice(p.amount)}</p>
                  <p className="text-xs text-ink-500">
                    {new Date(p.created_at).toLocaleString()} · {p.method ?? '—'}
                    {p.reference && <> · ref {p.reference}</>}
                  </p>
                  {p.note && <p className="text-xs text-ink-600 mt-0.5 italic">{p.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
