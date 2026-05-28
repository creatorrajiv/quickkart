-- =============================================================
--  FIX: Missing table-level GRANTS for the `authenticated` role
--
--  PROBLEM
--  Supabase tables created via raw SQL do NOT auto-grant
--  privileges to `authenticated` / `anon` roles (unlike tables
--  created via the dashboard). The result: every query returns
--  HTTP 403 with Postgres error 42501 "permission denied",
--  even when RLS policies would allow the row.
--
--  SOLUTION
--  Grant base table privileges to the right roles. RLS policies
--  then enforce row-level access on top.
--
--  Run this script once in Supabase → SQL Editor.
-- =============================================================


-- ── Schema usage ────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated, anon;


-- ── profiles ────────────────────────────────────────────────────
-- Authenticated users read/update via "Users can view/update own
-- profile" RLS policies. No anonymous access.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;


-- ── products ────────────────────────────────────────────────────
-- Customers (authenticated) and visitors (anon) can browse the
-- catalog. Admins INSERT/UPDATE/DELETE via RLS.
GRANT SELECT                         ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.products TO authenticated;


-- ── orders ──────────────────────────────────────────────────────
-- Customers place orders, agents update assigned orders, admins
-- manage everything. All access is authenticated.
GRANT SELECT, INSERT, UPDATE         ON public.orders TO authenticated;


-- ── order_items ─────────────────────────────────────────────────
-- Linked to orders. Customers insert on checkout, others read via RLS.
GRANT SELECT, INSERT, DELETE         ON public.order_items TO authenticated;


-- ── Sequences (if any auto-increment is added later) ────────────
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- ── Verification ────────────────────────────────────────────────
-- Run this after the script to confirm grants were applied:
--
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND grantee IN ('authenticated', 'anon')
--   ORDER BY table_name, grantee, privilege_type;
-- =============================================================
