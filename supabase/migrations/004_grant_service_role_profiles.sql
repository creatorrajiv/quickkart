-- =============================================================
--  Migration 004 — Grant service_role full access to profiles
--  ──────────────────────────────────────────────────────────────
--  The admin-create-user Edge Function runs with the service_role
--  key. It needs to UPDATE the profiles row after the auth user is
--  created (to set role='agent' + KYC fields).
--
--  service_role bypasses RLS but still needs table-level GRANTs.
--  By default Supabase only grants service_role on tables created
--  through the dashboard — tables created via SQL (like ours) need
--  an explicit grant.
--
--  Idempotent. Safe to re-run.
-- =============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_inventory  TO service_role;
GRANT SELECT, INSERT, UPDATE         ON public.platform_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders          TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items     TO service_role;

-- Sequences (autoincrement IDs) — service_role needs USAGE to insert.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Future-proof: any tables we add later inherit these grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

-- =============================================================
-- Verification:
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND table_name='profiles' AND grantee='service_role';
-- =============================================================
