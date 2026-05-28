-- =============================================================
--  Migration 022 — Delivery slots + review moderation
--  ──────────────────────────────────────────────────────────────
--  Adds:
--    • orders.delivery_slot       — when the customer wants delivery
--    • orders.delivery_slot_label — human-friendly label saved at order time
--    • reviews.is_hidden          — admin can hide abusive / fake reviews
--    • Admin policy for managing all reviews
-- =============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_slot       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_slot_label TEXT;

COMMENT ON COLUMN public.orders.delivery_slot IS
  'When customer wants delivery. NULL means ASAP (handle immediately).';

CREATE INDEX IF NOT EXISTS idx_orders_delivery_slot
  ON public.orders(delivery_slot)
  WHERE delivery_slot IS NOT NULL AND status IN ('placed','preparing');


-- Review moderation
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;

-- Customer-visible reviews remain readable; admins can read all + write
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (is_hidden = FALSE OR public.is_admin() OR auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admins moderate reviews" ON public.reviews;
CREATE POLICY "Admins moderate reviews"
  ON public.reviews FOR ALL
  USING (public.is_admin());
