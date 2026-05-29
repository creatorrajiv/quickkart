-- =============================================================
--  Migration 026 — Recurring subscriptions
--  ──────────────────────────────────────────────────────────────
--  Lets customers save a cart as a recurring template ("every
--  Monday 9am, deliver 1L milk + 1 bread"). For v1 the customer
--  manually triggers each run — auto-generation via pg_cron lands
--  in a follow-up phase.
--
--  Schema:
--    subscriptions          one row per template
--    subscription_items     JSONB payload OR a separate child table
--                           (we use JSONB for simplicity — cart-shaped)
--
--  RPC:
--    run_subscription(id)   - clone template into a new order
--
--  Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id         UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL,                  -- e.g. "Weekly groceries"
  -- Items stored as JSONB so adding/removing variants doesn't need joins.
  -- Shape: [{ product_id, variant_id?, variant_label?, quantity, price_at_save }]
  items               JSONB        NOT NULL,
  delivery_address    TEXT,
  payment_method      TEXT         NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('online','cod')),
  -- Optional cadence — informational for now, used for auto-run later
  frequency_days      INT          NOT NULL DEFAULT 7 CHECK (frequency_days BETWEEN 1 AND 365),
  next_run_at         TIMESTAMPTZ,
  last_run_at         TIMESTAMPTZ,
  is_paused           BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer
  ON public.subscriptions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_next_run
  ON public.subscriptions(next_run_at)
  WHERE is_paused = FALSE;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.subscriptions;
CREATE POLICY "Users manage own subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);


-- -------------------------------------------------------------
-- run_subscription — clone template into a new order
-- -------------------------------------------------------------
-- Re-reads CURRENT product prices (subscription items only store the
-- product_id/variant + a snapshot price at save-time, which becomes
-- stale). For pricing we trust the current product/variant row.
--
-- Returns the created order_id.
CREATE OR REPLACE FUNCTION public.run_subscription(p_subscription_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub       RECORD;
  v_items     JSONB;
  v_rpc_items JSONB := '[]'::jsonb;
  v_item      JSONB;
  v_product   RECORD;
  v_variant   JSONB;
  v_subtotal  NUMERIC := 0;
  v_total     NUMERIC;
  v_order_id  UUID;
  v_unit_price NUMERIC;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL OR v_sub.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'subscription not found';
  END IF;
  IF v_sub.is_paused THEN RAISE EXCEPTION 'subscription is paused'; END IF;
  IF v_sub.items IS NULL OR jsonb_array_length(v_sub.items) = 0 THEN
    RAISE EXCEPTION 'subscription has no items';
  END IF;
  IF v_sub.delivery_address IS NULL OR length(trim(v_sub.delivery_address)) = 0 THEN
    RAISE EXCEPTION 'subscription has no delivery address';
  END IF;

  -- Build the items payload at CURRENT prices
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_sub.items)
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::UUID;
    IF v_product.id IS NULL OR NOT v_product.is_available THEN CONTINUE; END IF;

    v_unit_price := v_product.price;
    IF v_item->>'variant_id' IS NOT NULL AND v_product.variants IS NOT NULL THEN
      SELECT jsonb_array_elements(v_product.variants) INTO v_variant
      FROM   (SELECT 1) s
      WHERE  (v_variant->>'id') = (v_item->>'variant_id')
      LIMIT 1;
      -- Lookup variant price
      SELECT (val->>'price')::NUMERIC INTO v_unit_price
      FROM   jsonb_array_elements(v_product.variants) val
      WHERE  val->>'id' = (v_item->>'variant_id')
      LIMIT 1;
      IF v_unit_price IS NULL THEN v_unit_price := v_product.price; END IF;
    END IF;

    v_rpc_items := v_rpc_items || jsonb_build_object(
      'product_id',        v_item->>'product_id',
      'quantity',          (v_item->>'quantity')::INT,
      'price_at_purchase', v_unit_price,
      'variant_id',        v_item->>'variant_id',
      'variant_label',     v_item->>'variant_label'
    );
    v_subtotal := v_subtotal + v_unit_price * (v_item->>'quantity')::INT;
  END LOOP;

  IF jsonb_array_length(v_rpc_items) = 0 THEN
    RAISE EXCEPTION 'all subscription items are unavailable';
  END IF;

  -- Apply delivery + tax via approximate logic — match calculateOrderTotals
  v_total := v_subtotal
           + CASE WHEN v_subtotal >= 499 THEN 0 ELSE 30 END   -- delivery
           + ROUND((v_subtotal + CASE WHEN v_subtotal >= 499 THEN 0 ELSE 30 END) * 0.05, 2);  -- tax 5%

  -- Re-use the canonical RPC to place the order
  SELECT public.create_order_with_items(
    v_rpc_items,
    v_sub.payment_method,
    v_sub.delivery_address,
    v_total,
    NULL,
    0
  ) INTO v_order_id;

  -- Update run timestamps
  UPDATE public.subscriptions
  SET    last_run_at = NOW(),
         next_run_at = NOW() + (frequency_days || ' days')::INTERVAL
  WHERE  id = p_subscription_id;

  RETURN v_order_id;
END;
$$;

REVOKE  ALL  ON FUNCTION public.run_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_subscription(UUID) TO authenticated;
