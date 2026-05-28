/**
 * NotificationBell — In-App Notifications Dropdown
 * ──────────────────────────────────────────────────────────────────────────
 *  v2 — Portal-based dropdown that escapes ANY parent overflow:hidden.
 *  Previously the dropdown was clipped by gradient headers that have
 *  overflow-hidden for decorative blobs. Now we render to document.body
 *  and position the dropdown using the bell button's bounding rect.
 *
 *  Bonus: vibrates the phone when a new order assignment ping arrives
 *  for agents — important when they're driving.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

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

      // Toast + sound — heavier "order" tone for new-order pings
      const isOrderPing = ['shop_new_order', 'agent_new_assignment', 'order_placed'].includes(row.type);
      notify(row.title, {
        description: row.body,
        sound: isOrderPing ? 'order' : 'notification',
      });

      // Vibrate the phone for the agent's new-assignment pings.
      // Most relevant when they might be driving and can't look at the screen.
      if (row.type === 'agent_new_assignment' && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
      }
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [session?.user?.id]);

  // ── Position the dropdown relative to the bell button ───────────────────
  // We recompute on open + on scroll/resize while open so it tracks correctly.
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top:   rect.bottom + 8,                             // 8px gap
        right: window.innerWidth - rect.right,              // align right edge
      });
    };
    reposition();
    window.addEventListener('scroll',  reposition, true);
    window.addEventListener('resize',  reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      // Inside the button or inside the portaled dropdown? keep open.
      if (buttonRef.current?.contains(e.target)) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
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
    <>
      <button
        ref={buttonRef}
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

      {/* Portal: renders to document.body so parent overflow:hidden can't clip */}
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top:    `${position.top}px`,
            right:  `${position.right}px`,
            zIndex: 9999,
            maxWidth: 'calc(100vw - 1rem)',
          }}
          className="w-80 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-pop animate-slide-up"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5">
            <p className="text-sm font-bold text-ink-900">Notifications</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs font-bold text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <ul className="space-y-1 p-2">
                {[1,2,3].map(i => <li key={i} className="h-14 animate-pulse rounded-lg bg-ink-100" />)}
              </ul>
            )}

            {!loading && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-ink-500">No notifications yet.</p>
            )}

            {!loading && items.length > 0 && (
              <ul className="divide-y divide-ink-100">
                {items.map(n => {
                  const icon = TYPE_ICONS[n.type] ?? '🔔';
                  const isUnread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleClickItem(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                          ${isUnread ? 'bg-brand-50/40 hover:bg-brand-50' : 'hover:bg-ink-50'}`}
                      >
                        <span className="mt-0.5 text-lg">{icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm ${isUnread ? 'font-bold text-ink-900' : 'text-ink-700'}`}>
                            {n.title}
                          </p>
                          {n.body && <p className="mt-0.5 text-xs text-ink-500">{n.body}</p>}
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink-400">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {isUnread && <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
