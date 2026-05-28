import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  // `loading` stays true until BOTH the initial session AND the profile row
  // have been resolved. Components that read role-sensitive data must wait
  // for loading === false before rendering or redirecting.
  const [session,  setSession]  = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // ── Internal helper: fetch the profiles row for a given user id ─────────────
  // Wrapped with a 5s timeout so a hanging query (e.g. recursive RLS) never
  // blocks the whole app indefinitely.
  const fetchProfile = useCallback(async (userId) => {
    console.log('[AuthProvider] Fetching profile for', userId);
    const startTime = Date.now();

    try {
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout (5s)')), 5000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;

      if (error) {
        console.error(`[AuthProvider] Profile fetch failed (${elapsed}ms):`, error);
        setProfile(null);
      } else {
        console.log(`[AuthProvider] Profile fetched (${elapsed}ms):`, data);
        setProfile(data);
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error(`[AuthProvider] Profile fetch threw (${elapsed}ms):`, err);
      setProfile(null);
    }
  }, []);

  // ── Bootstrap: resolve session once on mount, then subscribe ────────────────
  useEffect(() => {
    let mounted = true;

    // ─── IMPORTANT: Supabase deadlock avoidance ────────────────────────────────
    // The onAuthStateChange callback runs WHILE the Supabase auth client
    // holds an internal lock (especially during TOKEN_REFRESHED).
    // Calling any Supabase function (like supabase.from()) inside the callback
    // will deadlock: the query waits for the lock, the lock waits for the
    // callback to finish.
    //
    // FIX: keep the callback synchronous AND defer any Supabase calls via
    //      setTimeout(..., 0). This lets the auth client release its lock
    //      before our query runs.
    //
    // Also: TOKEN_REFRESHED fires periodically (~1 hour). The profile row
    // does NOT change on token refresh, so we only re-fetch on events that
    // actually mean "user identity changed".
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        console.log('[AuthProvider] Event:', event, '| session:', newSession ? 'present' : 'none');

        setSession(newSession);

        // No session → clear profile, release loading
        if (!newSession?.user) {
          setProfile(null);
          if (mounted) setLoading(false);
          return;
        }

        // Identity-changing events → refetch profile (deferred)
        const isIdentityEvent =
          event === 'INITIAL_SESSION' ||
          event === 'SIGNED_IN' ||
          event === 'USER_UPDATED';

        if (isIdentityEvent) {
          setTimeout(async () => {
            if (!mounted) return;
            await fetchProfile(newSession.user.id);
            if (mounted) setLoading(false);
          }, 0);
        } else {
          // TOKEN_REFRESHED, PASSWORD_RECOVERY, etc. — session refreshed, profile unchanged.
          if (mounted) setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ── Public auth actions ──────────────────────────────────────────────────────

  /** Sign in with email + password. Returns { error } */
  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  /**
   * Register a new account. The DB trigger auto-creates the profiles row.
   * fullName and phone are stored in auth.users.raw_user_meta_data and
   * mirrored into the profiles row by the handle_new_user trigger.
   * Returns { error }
   */
  const signUp = useCallback(async ({ email, password, fullName = '', phone = '' }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
      },
    });
    return { error };
  }, []);

  /** Sign out and clear local state immediately. */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  /**
   * Patch the profiles row for the currently authenticated user.
   * Accepted fields: full_name, phone, saved_address.
   * Returns { error }
   */
  const updateProfile = useCallback(async (updates) => {
    if (!session?.user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (!error && data) setProfile(data);
    return { error };
  }, [session]);

  /**
   * Force a fresh profile fetch (e.g., after an admin changes your role).
   */
  const refreshProfile = useCallback(async () => {
    if (session?.user) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  // ── Context value ────────────────────────────────────────────────────────────
  const value = {
    // State
    session,
    profile,
    loading,

    // Auth actions
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,

    // Derived role flags (safe to use in JSX without optional-chaining)
    isAdmin:    profile?.role === 'admin',
    isAgent:    profile?.role === 'agent',
    isCustomer: profile?.role === 'customer',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>.');
  return ctx;
}
