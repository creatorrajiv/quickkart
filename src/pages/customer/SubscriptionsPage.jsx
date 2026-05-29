/**
 * Customer SubscriptionsPage — Recurring order templates
 * ──────────────────────────────────────────────────────────────────────────
 *  Route: /subscriptions
 *   • List of saved templates
 *   • One-tap "Order now" creates an order with the same items
 *   • Pause / Resume / Delete
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchMySubscriptions, updateSubscription, deleteSubscription, runSubscription,
} from '../../services/subscriptionsService';
import { notify } from '../../lib/notify';
import { NotificationBell } from '../../components/common';
import { BottomNav } from '../../components/customer';
import { Button, EmptyState, Skeleton, Badge } from '../../ui';

const FREQ_LABEL = {
  1:  'Daily',
  7:  'Weekly',
  14: 'Every 2 weeks',
  30: 'Monthly',
};

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [subs,    setSubs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [acting,  setActing]  = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) navigate('/login', { replace: true });
  }, [authLoading, session, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchMySubscriptions();
    if (err) setError(err); else setSubs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (session) load(); }, [session]);

  const handleRun = async (sub) => {
    if (!window.confirm(`Place an order for "${sub.name}" using current prices?`)) return;
    setActing(sub.id);
    const { data: orderId, error } = await runSubscription(sub.id);
    setActing(null);
    if (error) { notify.error('Could not place order', error.message); return; }
    notify.success('Order placed!', 'Track it from My Orders.');
    if (orderId) navigate(`/orders/${orderId}`);
  };

  const handleTogglePause = async (sub) => {
    setActing(sub.id);
    const { error } = await updateSubscription(sub.id, { is_paused: !sub.is_paused });
    setActing(null);
    if (error) { notify.error('Update failed', error.message); return; }
    setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, is_paused: !sub.is_paused } : s));
  };

  const handleDelete = async (sub) => {
    if (!window.confirm(`Delete "${sub.name}"?`)) return;
    setActing(sub.id);
    const { error } = await deleteSubscription(sub.id);
    setActing(null);
    if (error) { notify.error('Delete failed', error.message); return; }
    setSubs(prev => prev.filter(s => s.id !== sub.id));
    notify.success('Subscription deleted');
  };

  return (
    <div className="min-h-screen bg-ink-50 pb-32 sm:pb-10">

      <header className="bg-brand-gradient text-white px-4 pt-5 pb-10 sm:px-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="mx-auto max-w-3xl flex items-center gap-3 relative">
          <Link to="/shop"
            className="rounded-full p-2 bg-white/15 hover:bg-white/25 active:scale-95 transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-white/85 font-bold">Save once, order anytime</p>
            <h1 className="font-display text-xl font-extrabold leading-tight">🔁 Subscriptions</h1>
          </div>
          <div className="[&_button]:!bg-white/15 [&_button]:!border-white/20 [&_button]:!text-white [&_button:hover]:!bg-white/25">
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 -mt-4 relative z-10">
        {loading && <ul className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32" rounded="rounded-2xl" />)}</ul>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && subs.length === 0 && (
          <EmptyState
            icon="🔁"
            title="No subscriptions yet"
            description="Save a cart as a subscription to re-order in one tap. Look for the dashed orange button on the cart."
            action={<Link to="/shop"><Button>Go shopping</Button></Link>}
          />
        )}

        {!loading && !error && subs.length > 0 && (
          <ul className="space-y-3">
            {subs.map(s => {
              const itemCount = (s.items ?? []).reduce((n, i) => n + (i.quantity || 0), 0);
              return (
                <li key={s.id} className={`rounded-2xl border bg-white shadow-card p-4 ${s.is_paused ? 'border-ink-200 opacity-70' : 'border-ink-100'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-display text-base font-bold text-ink-900 truncate">{s.name}</h3>
                        <Badge tone={s.is_paused ? 'warning' : 'success'} size="sm">
                          {s.is_paused ? '⏸ Paused' : '● Active'}
                        </Badge>
                      </div>
                      <p className="text-xs text-ink-500">
                        {itemCount} item{itemCount === 1 ? '' : 's'} · {FREQ_LABEL[s.frequency_days] ?? `Every ${s.frequency_days}d`}
                      </p>
                      {s.last_run_at && (
                        <p className="text-[11px] text-ink-500 mt-0.5">
                          Last ordered {new Date(s.last_run_at).toLocaleDateString()}
                        </p>
                      )}
                      {s.delivery_address && (
                        <p className="mt-2 text-[11px] text-ink-500 line-clamp-1">📍 {s.delivery_address}</p>
                      )}
                    </div>
                  </div>

                  {/* Item preview chips */}
                  {s.items?.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {s.items.slice(0, 4).map((it, i) => (
                        <li key={i} className="rounded-full bg-ink-100 text-ink-700 px-2 py-0.5 text-[11px] font-medium">
                          {it.name ?? 'Item'} {it.variant_label && `(${it.variant_label})`} ×{it.quantity}
                        </li>
                      ))}
                      {s.items.length > 4 && (
                        <li className="rounded-full bg-ink-100 text-ink-500 px-2 py-0.5 text-[11px]">+{s.items.length - 4} more</li>
                      )}
                    </ul>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                    <Button onClick={() => handleRun(s)} size="sm" disabled={acting === s.id || s.is_paused}>
                      🛒 Order now
                    </Button>
                    <Button onClick={() => handleTogglePause(s)} variant="outline" size="sm" disabled={acting === s.id}>
                      {s.is_paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button onClick={() => handleDelete(s)} variant="danger" size="sm" disabled={acting === s.id} className="ml-auto">
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
