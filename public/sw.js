/**
 * QuickKart Service Worker
 * ──────────────────────────────────────────────────────────────────────────
 *  • Installable PWA shell
 *  • Receives `push` events when the app is closed and renders a Notification
 *  • Clicking a notification opens (or focuses) the QuickKart tab
 *
 * Browser push REQUIRES HTTPS in production (localhost is exempt for dev).
 */

const CACHE = 'quickkart-shell-v1';

self.addEventListener('install', (event) => {
  // Activate this SW as soon as install completes
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push handler ──────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'QuickKart', body: 'You have a new notification' };
  if (event.data) {
    try { payload = event.data.json(); }
    catch { payload.body = event.data.text(); }
  }

  const opts = {
    body:    payload.body,
    icon:    '/icon-192.svg',
    badge:   '/icon-192.svg',
    tag:     payload.tag || 'quickkart-default',
    data:    payload.data || {},
    actions: payload.actions || [],
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(payload.title, opts));
});

// ── Notification click — focus an existing tab or open a new one ─────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if (client.url.includes(self.location.origin)) {
        client.focus();
        return client.navigate(target);
      }
    }
    return self.clients.openWindow(target);
  })());
});
