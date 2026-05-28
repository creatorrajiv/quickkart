/**
 * Notifications Service
 * ──────────────────────────────────────────────────────────────────────────
 * Reads, mutations, and realtime subscriptions for the in-app bell.
 *
 * Notifications are INSERTed by the DB trigger emit_order_notifications;
 * the client never writes them directly. We only read, mark-as-read, and
 * subscribe to new inserts via Supabase Realtime.
 */

import { supabase } from '../lib/supabaseClient';

/**
 * Fetch the latest N notifications for the signed-in user.
 * Includes both read and unread; the bell decides what to dim.
 */
export async function fetchNotifications(userId, limit = 30) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, order_id, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return { data, error };
}

/** Count of unread — used by the badge. */
export async function countUnread(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  return { count: count ?? 0, error };
}

export async function markRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  return { error };
}

export async function markAllRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  return { error };
}

/**
 * Subscribe to realtime INSERTs scoped to this user. Returns the channel
 * — caller must invoke `channel.unsubscribe()` on unmount.
 *
 * @param {string} userId
 * @param {(row: object) => void} onInsert
 */
export function subscribeToNotifications(userId, onInsert) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new),
    )
    .subscribe();
  return channel;
}
