/**
 * useAuthGuard — Centralised auth guard with intended-URL preservation
 * ──────────────────────────────────────────────────────────────────────────
 *  Drop into any page that requires authentication:
 *
 *    const { ready, isAuthed } = useAuthGuard();
 *    if (!ready) return <FullPageSpinner />;
 *
 *  Behavior:
 *   • Waits for auth state to finish loading before doing ANYTHING.
 *   • If not authed, saves the current URL in sessionStorage and redirects
 *     to /login.
 *   • LoginPage's redirect-after-success picks the saved URL up and sends
 *     the user right back to where they were trying to go.
 *
 *  This solves the "refresh on /orders/123 → white screen → URL changed"
 *  bug, because the previous pattern raced between session load and the
 *  page's own data fetch.
 */

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const INTENDED_KEY = 'quickkart.intendedUrl';

export function useAuthGuard({ requireRole } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    // Critical: do NOTHING until auth resolves.
    if (loading) return;

    if (!session) {
      // Save the URL we wanted so LoginPage can restore it after sign-in.
      // Skip auth/legal pages — no point coming back to them.
      const here = location.pathname + location.search;
      if (here && !['/login','/register','/'].includes(here)
              && !here.startsWith('/terms') && !here.startsWith('/privacy')) {
        try { sessionStorage.setItem(INTENDED_KEY, here); } catch {}
      }
      navigate('/login', { replace: true });
      return;
    }

    // Role guard (optional). If a role is required and doesn't match,
    // send the user to THEIR role's home rather than thrashing.
    if (requireRole && profile && profile.role !== requireRole) {
      const ROLE_HOMES = {
        admin:      '/admin',
        agent:      '/agent/active-orders',
        customer:   '/shop',
        shopkeeper: '/shopkeeper/dashboard',
      };
      navigate(ROLE_HOMES[profile.role] ?? '/login', { replace: true });
    }
  }, [loading, session, profile, requireRole, navigate, location]);

  return {
    ready:    !loading,
    isAuthed: !!session,
    profile,
    session,
  };
}

/** Read + clear the saved intended URL — used by LoginPage. */
export function consumeIntendedUrl() {
  try {
    const url = sessionStorage.getItem(INTENDED_KEY);
    sessionStorage.removeItem(INTENDED_KEY);
    return url;
  } catch { return null; }
}
