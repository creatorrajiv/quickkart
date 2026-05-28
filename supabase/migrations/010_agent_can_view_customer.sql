-- =============================================================
--  Migration 010 — Agent can view assigned customer's profile
--  ──────────────────────────────────────────────────────────────
--  So an agent's order list can show the customer's name + phone
--  for calling. Limited strictly to orders currently assigned to
--  the calling agent.
-- =============================================================

DROP POLICY IF EXISTS "Agents can view their order customer" ON public.profiles;
CREATE POLICY "Agents can view their order customer"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.customer_id = profiles.id
        AND o.agent_id    = auth.uid()
    )
  );
