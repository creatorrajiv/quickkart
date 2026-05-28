-- =============================================================
--  Migration 002 — Order RPC: shop assignment
--  ──────────────────────────────────────────────────────────────
--  Updates create_order_with_items() so every new order is
--  assigned to a shop at creation time, atomically.
--
--  Behaviour:
--    • platform_settings.order_assignment_mode = 'auto'
--        → call pick_shop_for_order(product_ids[]) and store the result
--    • platform_settings.order_assignment_mode = 'manual'
--        → leave shop_id NULL; admin assigns later from the dashboard
--    • If auto-mode finds NO eligible shop
--        → still create the order with shop_id NULL so the customer isn't
--          dead-ended. Admin sees an "unassigned" badge and can intervene.
--
--  Signature is unchanged. Existing client placeOrder() calls keep working.
--
--  Safe to re-run (CREATE OR REPLACE FUNCTION).
-- =============================================================

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items            JSONB,
  p_payment_method   payment_method,
  p_delivery_address TEXT,
  p_total_price      NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_item         JSONB;
  v_user_id      UUID  := auth.uid();
  v_mode         TEXT;
  v_product_ids  UUID[];
  v_shop_id      UUID  := NULL;
BEGIN
  -- ─── Argument validation ────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE = '22023';
  END IF;

  IF p_delivery_address IS NULL OR length(btrim(p_delivery_address)) = 0 THEN
    RAISE EXCEPTION 'Delivery address required' USING ERRCODE = '22023';
  END IF;

  IF p_total_price IS NULL OR p_total_price < 0 THEN
    RAISE EXCEPTION 'Total price must be >= 0' USING ERRCODE = '22023';
  END IF;

  -- ─── Determine assignment mode ──────────────────────────────────
  -- Default to 'auto' if the setting somehow isn't seeded (defensive).
  SELECT COALESCE(value #>> '{}', 'auto')
    INTO v_mode
    FROM public.platform_settings
   WHERE key = 'order_assignment_mode';

  IF v_mode IS NULL THEN
    v_mode := 'auto';
  END IF;

  -- ─── Auto mode → call the fairness allocator ────────────────────
  IF v_mode = 'auto' THEN
    -- Extract product_ids from the cart payload into a uuid[]
    SELECT array_agg(DISTINCT (elem->>'product_id')::UUID)
      INTO v_product_ids
      FROM jsonb_array_elements(p_items) AS elem;

    -- Returns NULL if no shop stocks all required items. We deliberately
    -- DO NOT raise here — leaving shop_id NULL lets admin handle the edge
    -- case ("expand to nearby villages" / "manually call a shopkeeper" / etc.).
    v_shop_id := public.pick_shop_for_order(v_product_ids);
  END IF;

  -- Manual mode → v_shop_id stays NULL, admin assigns in the dashboard.

  -- ─── Insert the order row ───────────────────────────────────────
  INSERT INTO public.orders (
    customer_id,
    shop_id,
    total_price,
    payment_method,
    delivery_address,
    status
  )
  VALUES (
    v_user_id,
    v_shop_id,
    p_total_price,
    p_payment_method,
    btrim(p_delivery_address),
    'placed'
  )
  RETURNING id INTO v_order_id;

  -- ─── Insert each cart line item ─────────────────────────────────
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'quantity')::INT <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be > 0' USING ERRCODE = '22023';
    END IF;
    IF (v_item->>'price_at_purchase')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Item price must be >= 0' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      quantity,
      price_at_purchase
    )
    VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INT,
      (v_item->>'price_at_purchase')::NUMERIC
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

-- Re-grant execute (CREATE OR REPLACE preserves grants, but we keep this
-- explicit so a future drop+create migration doesn't silently break clients).
REVOKE  ALL  ON FUNCTION public.create_order_with_items(JSONB, payment_method, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, payment_method, TEXT, NUMERIC) TO authenticated;


-- =============================================================
-- Verification:
-- =============================================================
-- 1. Confirm the function is updated:
--    SELECT pg_get_functiondef('public.create_order_with_items'::regproc);
--    Look for the call to pick_shop_for_order in the body.
--
-- 2. Smoke test (as a signed-in customer):
--    • Make sure platform_settings.order_assignment_mode is 'auto'
--    • If at least one active shop exists with all cart products in inventory,
--      the new order row should have a non-null shop_id.
--    • Flip the setting to '"manual"' and place another order — shop_id NULL.
-- =============================================================
