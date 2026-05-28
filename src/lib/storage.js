/**
 * Storage Abstraction
 * ──────────────────────────────────────────────────────────────────────────
 * One small wrapper around localStorage so every persistence call in the
 * codebase goes through THIS file and only this file.
 *
 * Why bother?
 *  • Today: web → window.localStorage (synchronous, JSON-serialised)
 *  • Tomorrow: CapacitorJS → @capacitor/preferences (async, native vault)
 *  • You will change THIS file, not the 20 places that read/write storage.
 *
 * The API is async-by-design even though localStorage is synchronous —
 * this lets us migrate to Capacitor's async API without touching consumers.
 *
 * Usage:
 *   import { storage } from '@/lib/storage';
 *   await storage.set('cart', { items: [...] });
 *   const cart = await storage.get('cart');
 */

const NAMESPACE = 'hyperlocal:';

const isBrowser = typeof window !== 'undefined' && !!window.localStorage;

export const storage = {
  /**
   * Read a value. Returns `null` if missing or corrupted.
   * @template T
   * @param {string} key
   * @returns {Promise<T | null>}
   */
  async get(key) {
    if (!isBrowser) return null;
    try {
      const raw = window.localStorage.getItem(NAMESPACE + key);
      return raw == null ? null : JSON.parse(raw);
    } catch (err) {
      console.warn(`[storage] get(${key}) failed:`, err);
      return null;
    }
  },

  /**
   * Persist a value (serialised as JSON).
   * @param {string} key
   * @param {*} value
   */
  async set(key, value) {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(NAMESPACE + key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[storage] set(${key}) failed:`, err);
    }
  },

  /**
   * Remove a key entirely.
   * @param {string} key
   */
  async remove(key) {
    if (!isBrowser) return;
    try {
      window.localStorage.removeItem(NAMESPACE + key);
    } catch (err) {
      console.warn(`[storage] remove(${key}) failed:`, err);
    }
  },
};

// ─── Known storage keys ──────────────────────────────────────────────────────
// Centralised so renames are one-line changes and typos are impossible.
export const STORAGE_KEYS = {
  CART: 'cart',
};
