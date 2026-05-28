-- =============================================================
--  Migration 003 — Agent KYC + Availability
--  ──────────────────────────────────────────────────────────────
--  Adds the fields the platform needs once admins can onboard
--  agents themselves (rather than via direct SQL role flips):
--
--    • profiles.is_online       — agent's "I'm taking deliveries"
--                                 switch. Future allocator skips
--                                 offline agents.
--    • profiles.vehicle_type    — bike / scooter / cycle / car
--    • profiles.vehicle_number  — registration plate (KYC)
--    • profiles.is_active       — admin can deactivate an agent
--                                 without deleting their row.
--
--  Idempotent. Safe to re-run.
-- =============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_online       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS vehicle_type    TEXT
    CHECK (vehicle_type IS NULL OR vehicle_type IN ('bike', 'scooter', 'cycle', 'car')),
  ADD COLUMN IF NOT EXISTS vehicle_number  TEXT;

-- Useful for the admin agents page: filter active agents quickly.
CREATE INDEX IF NOT EXISTS idx_profiles_role_active
  ON public.profiles(role) WHERE is_active = TRUE;

-- Allow the agent to update their own is_online flag.
-- (The existing "Users can update own profile" policy may already
--  cover this, but we add an explicit policy in case it doesn't.)
DROP POLICY IF EXISTS "Agents can toggle own availability" ON public.profiles;
CREATE POLICY "Agents can toggle own availability"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================
-- Verification:
--   SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name='profiles'
--     AND column_name IN ('is_online','is_active','vehicle_type','vehicle_number');
-- =============================================================
