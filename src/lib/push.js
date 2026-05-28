/**
 * Push notifications — register a service worker and manage push subscriptions.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Flow:
 *   1. `registerServiceWorker()`     → installs /sw.js (call once at app boot)
 *   2. `subscribeToPush(userId)`     → asks for Notification permission, gets a
 *                                      PushSubscription, saves it to the DB so
 *                                      a future server-side cron / function can
 *                                      push to this user.
 *   3. `unsubscribeFromPush(userId)` → revoke + delete the row.
 *
 * Server side: actually delivering pushes requires a Web Push server library
 * (e.g. web-push for Node, pywebpush for Python) running with the SAME VAPID
 * key pair. That's a Supabase Edge Function in production. This file only
 * handles the CLIENT-SIDE half: registration + subscription storage.
 *
 *   Generate a VAPID keypair once:
 *     npx web-push generate-vapid-keys
 *
 *   Set in .env:
 *     VITE_VAPID_PUBLIC_KEY=BIQy...
 *     (and the PRIVATE key in your Edge Function env, NEVER in client)
 */

import { supabase } from './supabaseClient';

export function isPushSupported() {
  return typeof window !== 'undefined' &&
         'serviceWorker' in navigator &&
         'PushManager' in window;
}

/** Register the service worker once at app boot. Safe to call repeatedly. */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.warn('[Push] SW registration failed:', err);
    return null;
  }
}

/** Returns 'default' | 'granted' | 'denied'. */
export function getPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/**
 * Ask for permission + subscribe + store the subscription in the DB.
 *
 * @param {string} userId
 * @returns {Promise<{ subscription: PushSubscription | null, error: Error | null }>}
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported())
    return { subscription: null, error: new Error('Push not supported on this browser') };

  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapid)
    return { subscription: null, error: new Error('VAPID public key not configured. Set VITE_VAPID_PUBLIC_KEY in .env.') };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    return { subscription: null, error: new Error('Permission denied') };

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid),
    });
  }

  // Save (upsert) on the server.
  const payload = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id:  userId,
    endpoint: payload.endpoint,
    p256dh:   payload.keys?.p256dh,
    auth:     payload.keys?.auth,
  }, { onConflict: 'endpoint' });

  if (error) return { subscription, error };
  return { subscription, error: null };
}

export async function unsubscribeFromPush(userId) {
  if (!isPushSupported()) return { error: null };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
  }
  return { error: null };
}

// ─── Helper: base64url → Uint8Array (Push API expects raw bytes) ──────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
