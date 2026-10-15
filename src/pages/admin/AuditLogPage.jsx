/**
 * Admin AuditLogPage — Who did what, when
 * ──────────────────────────────────────────────────────────────────────────
 *  Route: /admin/audit
 *
 *   • Reverse-chronological feed of every admin action
 *   • Filter by action key or target type
 *   • Metadata expanded inline (JSON viewer)
 */

import { useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin';
import { fetchAuditLog } from '../../services/auditLogService';
import { EmptyState, Skeleton, Badge, Select } from '../../ui';

const ACTION_META = {
  'order.refund':  { icon: '💸', label: 'Refunded order',   tone: 'warning' },
  'review.hide':   { icon: '🙈', label: 'Hid review',        tone: 'neutral' },
  'review.unhide': { icon: '👁', label: 'Restored review',   tone: 'neutral' },
  'review.delete': { icon: '🗑',  label: 'Deleted review',    tone: 'danger'  },
  default:         { icon: '⚙️',  label: 'Admin action',      tone: 'info'    },
};

export default function AuditLogPage() {
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [actionFilter, setActionFilter] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await fetchAuditLog({ action: actionFilter || undefined, limit: 200 });
    if (err) setError(err); else setList(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [actionFilter]);

  return (
    <AdminShell title="Audit log" subtitle={`${list.length} actions`}>
      <div className="space-y-4">
        <div className="rounded-2xl bg-white shadow-card p-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-ink-700">Filter:</span>
          <Select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="!w-56"
          >
            <option value="">All actions</option>
            <option value="order.refund">Refunds</option>
            <option value="review.hide">Reviews hidden</option>
            <option value="review.unhide">Reviews restored</option>
            <option value="review.delete">Reviews deleted</option>
          </Select>
        </div>

        {loading && <ul className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" rounded="rounded-2xl" />)}</ul>}
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</div>}

        {!loading && !error && list.length === 0 && (
          <EmptyState icon="🕵️" title="No admin actions yet" description="Refunds, review moderation, and other admin actions will show up here." />
        )}

        {!loading && !error && list.length > 0 && (
          <ul className="space-y-2">
            {list.map(row => {
              const meta = ACTION_META[row.action] ?? ACTION_META.default;
              return (
                <li key={row.id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-2xl">{meta.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone} size="sm">{meta.label}</Badge>
                          <code className="text-[10px] text-ink-500">{row.action}</code>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-ink-900">
                          {row.admin?.full_name || row.admin?.email || 'Unknown admin'}
                        </p>
                        {row.target_type && (
                          <p className="text-xs text-ink-500">
                            Target: <span className="font-mono">{row.target_type}</span> #{(row.target_id ?? '').slice(0, 8)}
                          </p>
                        )}
                        {row.metadata && (
                          <pre className="mt-2 rounded-lg bg-ink-50 px-2 py-1.5 text-[11px] text-ink-700 overflow-x-auto">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
