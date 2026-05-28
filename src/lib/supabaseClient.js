import { createClient } from '@supabase/supabase-js';

// ─── Environment validation ───────────────────────────────────────────────────
// Vite exposes only variables prefixed with VITE_ to the browser bundle.
// These are read from .env (never committed to source control).
const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabaseClient] Missing environment variables.\n' +
    'Copy .env.example → .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

// ─── Singleton client ─────────────────────────────────────────────────────────
// Import { supabase } from '@/lib/supabaseClient' anywhere in the app.
// Do NOT call createClient() more than once — it creates duplicate socket connections.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Namespaced storage key prevents collision if multiple Supabase projects
    // ever share the same origin (e.g. local dev with multiple apps).
    storageKey: 'hyperlocal-auth',

    // Keep the session alive across browser refreshes and CapacitorJS
    // app backgrounding / foregrounding on Android.
    persistSession:   true,
    autoRefreshToken: true,

    // Required for the magic-link / OAuth redirect flow.
    // Safe to leave enabled even if you only use email+password.
    detectSessionInUrl: true,
  },

  // Realtime is used later for live order status updates.
  // Channels are created on demand via supabase.channel(...).
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});
