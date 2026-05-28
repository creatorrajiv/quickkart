-- =============================================================
--  Migration 005 — Shopkeeper Order Access
--  ──────────────────────────────────────────────────────────────
--  Shopkeepers need to see orders assigned to a shop they own and
--  update their status (placed → preparing). Today RLS on orders
--  only covers customer / agent / admin, so a shopkeeper sees an
--  empty list. This migration adds the two policies they need.
--
--  Also: when the order RPC needs to write a shop assignment, the
--  client uses anon → authenticated grants; we already cover those.
--
--  Idempotent.
-- =============================================================

-- Helper: is the calling user a shopkeeper who owns this order's shop?
CREATE OR REPLACE FUNCTION public.owns_order_shop(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.shops  s ON s.id = o.shop_id
    WHERE o.id = p_order_id
      AND s.owner_id = auth.uid()
  );
$$;
REVOKE  ALL  ON FUNCTION public.owns_order_shop(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_order_shop(UUID) TO authenticated;


-- SELECT: shopkeeper can view any order whose shop they own.
DROP POLICY IF EXISTS "Shopkeepers can view own shop orders" ON public.orders;
CREATE POLICY "Shopkeepers can view own shop orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.owner_id = auth.uid()
    )
  );

-- UPDATE: shopkeeper can change status of own shop orders.
-- We don't restrict which columns they can change at policy level
-- (Postgres RLS can't); the service layer (updateMyShop, etc.)
-- enforces the allowed-field whitelist.
DROP POLICY IF EXISTS "Shopkeepers can update own shop orders" ON public.orders;
CREATE POLICY "Shopkeepers can update own shop orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.owner_id = auth.uid()
    )
  );

-- Also: shopkeepers need to see the order_items rows for those orders.
DROP POLICY IF EXISTS "Shopkeepers can view own shop order_items" ON public.order_items;
CREATE POLICY "Shopkeepers can view own shop order_items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.shops  s ON s.id = o.shop_id
      WHERE o.id = order_id AND s.owner_id = auth.uid()
    )
  );

-- Customer profile lookup so the shopkeeper sees the customer name/phone
-- on each order. Without this they get just an id.
DROP POLICY IF EXISTS "Shopkeepers can view customers of own orders" ON public.profiles;
CREATE POLICY "Shopkeepers can view customers of own orders"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.shops  s ON s.id = o.shop_id
      WHERE o.customer_id = profiles.id
        AND s.owner_id    = auth.uid()
    )
  );


-- =============================================================
-- Verification:
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'public.orders'::regclass;
-- =============================================================
