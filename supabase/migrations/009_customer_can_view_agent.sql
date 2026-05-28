-- =============================================================
--  Migration 009 — Customer can view assigned agent's profile
--  ──────────────────────────────────────────────────────────────
--  So the customer's order detail page can show the delivery
--  agent's name + phone, we let the customer SELECT the profile
--  row of an agent currently assigned to one of their orders.
--
--  RLS policy. Safe to re-run.
-- =============================================================

DROP POLICY IF EXISTS "Customers can view their order agent" ON public.profiles;
CREATE POLICY "Customers can view their order agent"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.agent_id = profiles.id
        AND o.customer_id = auth.uid()
    )
  );

-- Same idea for the shopkeeper (so customer sees the shop's owner if needed).
-- Not strictly required for current UI (we already show shop name via the
-- shops table), but doesn't hurt to mirror the pattern.
DROP POLICY IF EXISTS "Customers can view their order shopkeeper" ON public.profiles;
CREATE POLICY "Customers can view their order shopkeeper"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.shops  s ON s.id = o.shop_id
      WHERE s.owner_id = profiles.id
        AND o.customer_id = auth.uid()
    )
  );
