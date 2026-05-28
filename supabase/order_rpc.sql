-- =============================================================
--  Atomic Order Placement RPC
--
--  WHY THIS EXISTS
--  Supabase's JavaScript SDK has NO client-side transactions.
--  Doing `insert orders` then `insert order_items` from the client
--  would leave dangling orphan orders if the second call failed.
--
--  This Postgres function performs both inserts inside a single
--  PL/pgSQL block. PL/pgSQL functions run inside an implicit
--  transaction — if ANY statement raises, the whole thing rolls back.
--  No orphan rows, ever.
--
--  SECURITY MODEL
--  • Runs as SECURITY INVOKER (the caller's role).
--  • Existing RLS policies on `orders` and `order_items` enforce that
--    customer_id = auth.uid() — same protection as direct INSERTs.
--  • We never trust `customer_id` from the client; the function uses
--    auth.uid() directly.
--
--  USAGE FROM JS
--    const { data: orderId, error } = await supabase.rpc(
--      'create_order_with_items',
--      {
--        p_items: [
--          { product_id: '...', quantity: 2, price_at_purchase: 99.50 },
--          ...
--        ],
--        p_payment_method:   'online',     -- or 'cod'
--        p_delivery_address: '12 Main St, …',
--        p_total_price:      299.55,
--      }
--    );
--
--  Run this script once in Supabase → SQL Editor.
-- =============================================================


CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items            JSONB,            -- [{ product_id uuid, quantity int, price_at_purchase numeric }]
  p_payment_method   payment_method,   -- 'online' | 'cod'
  p_delivery_address TEXT,
  p_total_price      NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER                      -- run as the calling user → RLS applies
SET search_path = public
AS $$
DECLARE
  v_order_id  UUID;
  v_item      JSONB;
  v_user_id   UUID := auth.uid();
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

  -- ─── Insert the order row ───────────────────────────────────────
  -- customer_id is set from auth.uid() so the RLS policy
  -- "Customers can place orders" (USING auth.uid() = customer_id) passes.
  INSERT INTO public.orders (
    customer_id,
    total_price,
    payment_method,
    delivery_address,
    status
  )
  VALUES (
    v_user_id,
    p_total_price,
    p_payment_method,
    btrim(p_delivery_address),
    'placed'
  )
  RETURNING id INTO v_order_id;

  -- ─── Insert each cart line item ─────────────────────────────────
  -- Loops through the JSON array and inserts one row per line.
  -- If any insert fails (RLS, FK violation, bad data), the entire
  -- function aborts and Postgres rolls back the order header above.
  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    -- Per-item validation
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


-- ─── Permissions ────────────────────────────────────────────────────
REVOKE  ALL  ON FUNCTION public.create_order_with_items(JSONB, payment_method, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, payment_method, TEXT, NUMERIC) TO authenticated;


-- ─── Verification ───────────────────────────────────────────────────
-- After running, confirm the function exists:
--
--   SELECT proname, prosecdef
--   FROM pg_proc
--   WHERE proname = 'create_order_with_items';
-- =============================================================
