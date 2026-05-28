/**
 * NotificationBell — In-App Notifications Dropdown
 * ──────────────────────────────────────────────────────────────────────────
 * Drop into any page header:
 *
 *   import { NotificationBell } from '@/components/common';
 *   <NotificationBell />
 *
 * Behavior:
 *   • Shows a bell icon with an unread count badge.
 *   • Click → dropdown with the 30 most recent notifications.
 *   • Realtime: new notifications appear instantly via Supabase channel.
 *   • Clicking a notification marks it read and (if it has an order_id)
 *     navigates to the appropriate detail page based on the user's role.
 *
 * It silently does nothing for users that aren't signed in.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import {
  fetchNotifications,
  countUnread,
  markRead,
  markAllRead,
  subscribeToNotifications,
} from '../../services/notificationsService';
import { notify } from '../../lib/notify';

const TYPE_ICONS = {
  order_placed:         '🧾',
  order_status:         '📦',
  shop_new_order:       '🛎️',
  agent_new_assignment: '🛵',
  system:               '🔔',
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  const [open,     setOpen]     = useState(false);
  const [items,    setItems]    = useState([]);
  const [unread,   setUnread]   = useState(0);
  const [loading,  setLoading]  = useState(false);
  const wrapperRef = useRef(null);

  // ── Initial load + realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) {
      setItems([]); setUnread(0);
      return;
    }
    const userId = session.user.id;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const [{ data }, { count }] = await Promise.all([
        fetchNotifications(userId),
        countUnread(userId),
      ]);
      if (cancelled) return;
      setItems(data ?? []);
      setUnread(count);
      setLoading(false);
    })();

    const channel = subscribeToNotifications(userId, (row) => {
      setItems(prev => [row, ...prev].slice(0, 30));
      setUnread(prev => prev + 1);
      // Pop a toast + sound — sound is "order" for new-order pings,
      // "notification" for everything else.
      const isOrderPing = ['shop_new_order', 'agent_new_assignment', 'order_placed'].includes(row.type);
      notify(row.title, {
        description: row.body,
        sound: isOrderPing ? 'order' : 'notification',
      });
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [session?.user?.id]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!session) return null;

  const handleClickItem = async (n) => {
    if (!n.read_at) {
      await markRead(n.id);
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
      setUnread(u => Math.max(0, u - 1));
    }
    setOpen(false);

    if (!n.order_id) return;
    // Route based on role — customer goes to /orders/:id, agent/shopkeeper
    // see it in their dashboards. Admin goes to admin orders page.
    if (profile?.role === 'customer')        navigate(`/orders/${n.order_id}`);
    else if (profile?.role === 'agent')      navigate('/agent/active-orders');
    else if (profile?.role === 'shopkeeper') navigate('/shopkeeper/dashboard');
    else if (profile?.role === 'admin')      navigate('/admin/orders');
  };

  const handleMarkAll = async () => {
    if (!session?.user?.id || unread === 0) return;
    await markAllRead(session.user.id);
    const now = new Date().toISOString();
    setItems(prev => prev.map(x => x.read_at ? x : { ...x, read_at: now }));
    setUnread(0);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        type="button"
        aria-label="Notifications"
        className="relative rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-gray-700
          hover:bg-gray-50 active:scale-95 transition-all"
      >
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center
            rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden
          rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs font-medium text-orange-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <ul className="space-y-1 p-2">
                {[1,2,3].map(i => <li key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
              </ul>
            )}

            {!loading && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-500">No notifications yet.</p>
            )}

            {!loading && items.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {items.map(n => {
                  const icon = TYPE_ICONS[n.type] ?? '🔔';
                  const isUnread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickItem(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                          ${isUnread ? 'bg-orange-50/40 hover:bg-orange-50' : 'hover:bg-gray-50'}`}
                      >
                        <span className="mt-0.5 text-lg">{icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {n.title}
                          </p>
                          {n.body && <p className="mt-0.5 text-xs text-gray-500">{n.body}</p>}
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {isUnread && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tiny "x minutes ago" helper ────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
