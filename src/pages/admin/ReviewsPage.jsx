/**
 * Admin ReviewsPage — Moderate customer reviews
 * ──────────────────────────────────────────────────────────────────────────
 * Route: /admin/reviews
 *  • See every review with star ratings, customer, shop, agent, comment
 *  • Hide / unhide (with optional reason)
 *  • Delete permanently
 *  • Filter: all / visible / hidden
 */

import { useEffect, useState } from 'react';

import { AdminShell } from '../../components/admin';
import {
  fetchAllReviews, hideReview, unhideReview, deleteReview,
} from '../../services/adminReviewsService';
import { notify } from '../../lib/notify';
import { Badge, EmptyState, Button, Skeleton } from '../../ui';

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'visible', label: 'Visible' },
  { key: 'hidden',  label: 'Hidden' },
];

export default function ReviewsPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');
  const [acting, setActing]   = useState(null);

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchAllReviews({ filter });
    if (err) setError(err); else setList(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const handleHide = async (r) => {
    const reason = window.prompt('Reason for hiding this review? (optional)') ?? '';
    setActing(r.id);
    const { error } = await hideReview(r.id, reason || null);
    setActing(null);
    if (error) { notify.error('Could not hide', error.message); return; }
    setList(prev => prev.map(x => x.id === r.id ? { ...x, is_hidden: true, hidden_reason: reason || null } : x));
    notify.success('Review hidden');
  };

  const handleUnhide = async (r) => {
    setActing(r.id);
    const { error } = await unhideReview(r.id);
    setActing(null);
    if (error) { notify.error('Could not unhide', error.message); return; }
    setList(prev => prev.map(x => x.id === r.id ? { ...x, is_hidden: false, hidden_reason: null } : x));
    notify.success('Review restored');
  };

  const handleDelete = async (r) => {
    if (!window.confirm('Permanently delete this review? Cannot be undone.')) return;
    setActing(r.id);
    const { error } = await deleteReview(r.id);
    setActing(null);
    if (error) { notify.error('Delete failed', error.message); return; }
    setList(prev => prev.filter(x => x.id !== r.id));
    notify.success('Review deleted');
  };

  return (
    <AdminShell
      title="Reviews"
      subtitle={`${list.length} ${filter === 'all' ? 'total' : filter}`}
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-white shadow-card p-1.5 flex gap-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all
                ${filter === f.key ? 'bg-brand-500 text-white shadow-brand' : 'text-ink-600 hover:bg-ink-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <ul className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32" rounded="rounded-2xl" />)}</ul>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && list.length === 0 && (
          <EmptyState icon="⭐" title="No reviews yet" description="As customers complete deliveries and rate them, they'll show up here." />
        )}

        {!loading && !error && list.length > 0 && (
          <ul className="space-y-3">
            {list.map(r => (
              <ReviewCard key={r.id} review={r} acting={acting === r.id}
                onHide={() => handleHide(r)}
                onUnhide={() => handleUnhide(r)}
                onDelete={() => handleDelete(r)} />
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}

function ReviewCard({ review: r, acting, onHide, onUnhide, onDelete }) {
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-card ${r.is_hidden ? 'opacity-60 border-ink-200' : 'border-ink-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-bold text-ink-900">
              {r.customer?.full_name || r.customer?.email || 'Customer'}
            </p>
            <Badge tone={r.is_hidden ? 'danger' : 'success'} size="sm">
              {r.is_hidden ? 'Hidden' : 'Visible'}
            </Badge>
            <span className="text-[10px] text-ink-500 font-mono">
              {new Date(r.created_at).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            {r.shop_rating && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-2 py-1">
                <span className="font-bold text-ink-700">🏪 {r.shop?.name ?? 'Shop'}: </span>
                <span className="text-amber-700">{'★'.repeat(r.shop_rating)}{'☆'.repeat(5 - r.shop_rating)}</span>
              </div>
            )}
            {r.agent_rating && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-1">
                <span className="font-bold text-ink-700">🛵 {r.agent?.full_name ?? 'Agent'}: </span>
                <span className="text-blue-700">{'★'.repeat(r.agent_rating)}{'☆'.repeat(5 - r.agent_rating)}</span>
              </div>
            )}
          </div>

          {r.comment && (
            <p className="mt-2 text-sm text-ink-700 italic line-clamp-3">"{r.comment}"</p>
          )}

          {r.is_hidden && r.hidden_reason && (
            <p className="mt-2 text-[11px] text-red-600">Reason: {r.hidden_reason}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {r.is_hidden ? (
            <Button variant="secondary" size="sm" onClick={onUnhide} disabled={acting}>Restore</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onHide} disabled={acting}>Hide</Button>
          )}
          <Button variant="danger" size="sm" onClick={onDelete} disabled={acting}>Delete</Button>
        </div>
      </div>
    </li>
  );
}
