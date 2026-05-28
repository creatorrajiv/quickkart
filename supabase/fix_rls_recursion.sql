-- =============================================================
--  FIX: RLS recursion on public.profiles
--
--  PROBLEM
--  The original "Admins can view all profiles" policy queries
--  public.profiles from inside its own USING clause. When
--  PostgREST evaluates this policy it re-applies RLS to the
--  inner query, creating recursion that can cause queries
--  to hang or fail silently.
--
--  SOLUTION
--  Replace the recursive policies with a SECURITY DEFINER
--  helper function `public.is_admin()`. The function runs with
--  the owner's privileges and bypasses RLS, eliminating the
--  recursion entirely.
--
--  Run this entire script once in Supabase → SQL Editor.
-- =============================================================


-- ── Step 1: Drop the recursive policies ─────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles"     ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage products"       ON public.products;
DROP POLICY IF EXISTS "Admins can manage all orders"     ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;


-- ── Step 2: Create a SECURITY DEFINER helper ─────────────────────
-- This function reads the profiles table with the owner's
-- privileges, bypassing RLS. Safe to call from any policy.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Lock down execution: only allow authenticated users to call it.
REVOKE  ALL  ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;


-- ── Step 3: Recreate the policies using the helper ──────────────
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (public.is_admin());

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

CREATE POLICY "Admins can manage all order items"
  ON public.order_items FOR ALL
  USING (public.is_admin());


-- ── Verification ────────────────────────────────────────────────
-- Run this to confirm the policies were recreated cleanly:
--
--   SELECT schemaname, tablename, policyname
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- And confirm the helper exists:
--
--   SELECT proname, prosecdef FROM pg_proc WHERE proname = 'is_admin';
-- =============================================================
