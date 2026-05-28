-- =============================================================
--  Migration 012 — Agent live location
--  ──────────────────────────────────────────────────────────────
--  Adds latitude / longitude / location_updated_at columns on
--  profiles so an agent's phone can broadcast GPS while delivering,
--  and the customer can see them moving in realtime.
--
--  Tradeoffs of this approach:
--    + Zero infrastructure beyond what's already there
--    + Realtime channel already in place (Supabase Realtime on profiles)
--    + Easy to query "agents near me"
--    − A single UPDATE per second per online agent adds DB write load
--      (fine for hundreds of concurrent agents; for thousands, switch
--      to a dedicated live-locations table with TTL).
--
--  Idempotent.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_lat         NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS current_lng         NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;

-- Index for "agents near a point" future queries.
CREATE INDEX IF NOT EXISTS idx_profiles_current_location
  ON public.profiles(current_lat, current_lng)
  WHERE current_lat IS NOT NULL AND current_lng IS NOT NULL;

-- =============================================================
-- Verification:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name='profiles' AND column_name LIKE 'current_%';
-- =============================================================
