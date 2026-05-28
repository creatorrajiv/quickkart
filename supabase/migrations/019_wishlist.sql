-- =============================================================
--  Migration 019 — Customer wishlist
--  ──────────────────────────────────────────────────────────────
--  Lets customers favourite products to come back to later. Unique
--  per (user, product) so toggling is idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id  UUID         NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user
  ON public.wishlist_items(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO service_role;

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wishlist" ON public.wishlist_items;
CREATE POLICY "Users manage own wishlist"
  ON public.wishlist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
