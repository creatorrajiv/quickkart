/**
 * Geolocation — wrapper around browser GPS for agent broadcasting
 * ──────────────────────────────────────────────────────────────────────────
 *   startWatching(onUpdate, onError, opts) → stopHandle
 *
 * Uses navigator.geolocation.watchPosition under the hood. Returns a
 * cleanup function. Safely no-ops if the browser doesn't support GPS.
 *
 * Privacy note: only used by the agent app while they're online AND
 * have at least one active delivery. The customer's app receives the
 * location via Supabase Realtime, not directly from the agent's phone.
 */

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

export function startWatching(onUpdate, onError, { highAccuracy = true } = {}) {
  if (!isGeolocationSupported()) {
    onError?.(new Error('Geolocation not supported on this device'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onUpdate({
        lat:     pos.coords.latitude,
        lng:     pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed:   pos.coords.speed ?? null,
        heading: pos.coords.heading ?? null,
        ts:      pos.timestamp,
      });
    },
    onError ?? (() => {}),
    {
      enableHighAccuracy: highAccuracy,
      timeout: 15_000,
      maximumAge: 5_000,    // accept a 5s-old fix to save battery
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

/** One-shot — useful for "where am I right now" buttons. */
export function getCurrentPosition() {
  if (!isGeolocationSupported()) {
    return Promise.reject(new Error('Geolocation not supported'));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      reject,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  });
}
