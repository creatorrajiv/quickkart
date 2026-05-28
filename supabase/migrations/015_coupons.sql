-- =============================================================
--  Migration 015 — Coupons / promo codes
--  ──────────────────────────────────────────────────────────────
--  Lets admin create promotional codes that customers can apply
--  at checkout. Two discount types:
--    • percent — e.g. 10% off (capped by max_discount)
--    • fixed   — e.g. ₹50 flat off
--
--  Includes minimum order amount, total usage limit, per-user limit,
--  and validity window.
--
--  Atomic redemption: validate_and_redeem_coupon() locks the coupon row,
--  re-checks all constraints, increments used_count, and inserts a
--  redemption record in a single transaction.
--
--  Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. coupons
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                TEXT         NOT NULL UNIQUE,           -- always uppercase
  description         TEXT,
  discount_type       TEXT         NOT NULL
                      CHECK (discount_type IN ('percent', 'fixed')),
  discount_value      NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_discount        NUMERIC(10,2),                            -- caps percent discounts
  usage_limit         INT,                                       -- NULL = unlimited
  used_count          INT          NOT NULL DEFAULT 0,
  per_user_limit      INT          NOT NULL DEFAULT 1,
  valid_from          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until         TIMESTAMPTZ,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(code) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT SELECT                         ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO service_role;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active coupons" ON public.coupons;
DROP POLICY IF EXISTS "Admins manage coupons"          ON public.coupons;

CREATE POLICY "Anyone can read active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (public.is_admin());


-- -------------------------------------------------------------
-- 2. coupon redemptions
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id   UUID         NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id    UUID         REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, order_id)  -- one redemption per coupon per order
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_coupon
  ON public.coupon_redemptions(user_id, coupon_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_redemptions TO service_role;

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own redemptions"  ON public.coupon_redemptions;
DROP POLICY IF EXISTS "Admins manage redemptions"  ON public.coupon_redemptions;

CREATE POLICY "Users see own redemptions"
  ON public.coupon_redemptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage redemptions"
  ON public.coupon_redemptions FOR ALL
  USING (public.is_admin());


-- -------------------------------------------------------------
-- 3. orders.coupon_id + discount_amount
-- -------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_id        UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;


-- -------------------------------------------------------------
-- 4. validate_coupon — preview the discount for a given cart
-- -------------------------------------------------------------
-- Read-only. Used by the customer's cart UI to preview the discount.
-- Returns:
--   { valid: true,  coupon_id, discount_amount, message }
--   { valid: false, message }
CREATE OR REPLACE FUNCTION public.validate_coupon(p_code TEXT, p_subtotal NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_user_redeems INT;
  v_discount NUMERIC;
BEGIN
  SELECT * INTO v_coupon FROM public.coupons WHERE code = UPPER(p_code);
  IF v_coupon.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Invalid code');
  END IF;
  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is no longer active');
  END IF;
  IF v_coupon.valid_from > NOW() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is not yet valid');
  END IF;
  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired');
  END IF;
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Coupon limit reached');
  END IF;
  IF p_subtotal < v_coupon.min_order_amount THEN
    RETURN jsonb_build_object(
      'valid',   false,
      'message', 'Minimum order ' || v_coupon.min_order_amount || ' required'
    );
  END IF;

  -- Per-user limit
  SELECT COUNT(*) INTO v_user_redeems
  FROM public.coupon_redemptions
  WHERE coupon_id = v_coupon.id AND user_id = auth.uid();
  IF v_user_redeems >= v_coupon.per_user_limit THEN
    RETURN jsonb_build_object('valid', false, 'message', 'You have already used this coupon');
  END IF;

  -- Compute discount
  IF v_coupon.discount_type = 'percent' THEN
    v_discount := ROUND(p_subtotal * v_coupon.discount_value / 100.0, 2);
    IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
      v_discount := v_coupon.max_discount;
    END IF;
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  -- Never let the discount exceed the subtotal
  IF v_discount > p_subtotal THEN v_discount := p_subtotal; END IF;

  RETURN jsonb_build_object(
    'valid',           true,
    'coupon_id',       v_coupon.id,
    'code',            v_coupon.code,
    'description',     v_coupon.description,
    'discount_amount', v_discount,
    'message',         'Applied ' || v_coupon.code
  );
END;
$$;
REVOKE  ALL  ON FUNCTION public.validate_coupon(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO authenticated;


-- -------------------------------------------------------------
-- 5. Extend create_order_with_items to accept an optional coupon
-- -------------------------------------------------------------
-- Re-creates the order RPC adding p_coupon_code. The function:
--   • Re-validates the coupon (preventing client tampering)
--   • Atomically locks the coupon row, increments used_count
--   • Records the redemption
--   • Saves coupon_id + discount_amount on the order
--   • Adjusts the order's total_price by subtracting the discount
--
-- Older callers (no coupon) keep working because the new param has a default.

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items            JSONB,
  p_payment_method   TEXT,
  p_delivery_address TEXT,
  p_total_price      NUMERIC,
  p_coupon_code      TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id        UUID;
  v_shop_id         UUID;
  v_assignment_mode TEXT;
  v_item            JSONB;
  v_subtotal        NUMERIC := 0;
  v_product_ids     UUID[]  := '{}';
  v_coupon          RECORD;
  v_user_redeems    INT;
  v_discount        NUMERIC := 0;
  v_final_total     NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Compute subtotal + collect product ids from the payload
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_subtotal := v_subtotal + ((v_item->>'price_at_purchase')::NUMERIC * (v_item->>'quantity')::INT);
    v_product_ids := array_append(v_product_ids, (v_item->>'product_id')::UUID);
  END LOOP;

  -- ── Coupon (optional) ────────────────────────────────────────
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    -- Lock the row so two concurrent orders can't both consume the last usage
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE code = UPPER(p_coupon_code)
    FOR UPDATE;

    IF v_coupon.id IS NULL                      THEN RAISE EXCEPTION 'invalid coupon';            END IF;
    IF NOT v_coupon.is_active                   THEN RAISE EXCEPTION 'coupon inactive';           END IF;
    IF v_coupon.valid_from > NOW()              THEN RAISE EXCEPTION 'coupon not yet valid';      END IF;
    IF v_coupon.valid_until IS NOT NULL
       AND v_coupon.valid_until < NOW()         THEN RAISE EXCEPTION 'coupon expired';            END IF;
    IF v_coupon.usage_limit IS NOT NULL
       AND v_coupon.used_count >= v_coupon.usage_limit
                                                THEN RAISE EXCEPTION 'coupon limit reached';      END IF;
    IF v_subtotal < v_coupon.min_order_amount   THEN RAISE EXCEPTION 'order below minimum';       END IF;

    SELECT COUNT(*) INTO v_user_redeems
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = auth.uid();
    IF v_user_redeems >= v_coupon.per_user_limit THEN RAISE EXCEPTION 'already used this coupon'; END IF;

    -- Compute the discount the same way validate_coupon does
    IF v_coupon.discount_type = 'percent' THEN
      v_discount := ROUND(v_subtotal * v_coupon.discount_value / 100.0, 2);
      IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
        v_discount := v_coupon.max_discount;
      END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    IF v_discount > v_subtotal THEN v_discount := v_subtotal; END IF;

    -- Atomically consume one usage
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- ── Apply discount to the client-computed total ─────────────
  v_final_total := GREATEST(p_total_price - v_discount, 0);

  -- ── Shop assignment (existing logic) ────────────────────────
  SELECT (value::TEXT)::JSONB->>0 INTO v_assignment_mode
  FROM public.platform_settings WHERE key = 'order_assignment_mode';
  IF v_assignment_mode IS NULL THEN v_assignment_mode := 'auto'; END IF;

  IF v_assignment_mode = 'auto' THEN
    v_shop_id := public.pick_shop_for_order(v_product_ids);
  END IF;

  -- ── Insert order ────────────────────────────────────────────
  INSERT INTO public.orders (
    customer_id, payment_method, delivery_address, total_price, status, shop_id,
    coupon_id, discount_amount
  )
  VALUES (
    auth.uid(), p_payment_method::payment_method, p_delivery_address,
    v_final_total, 'placed', v_shop_id,
    v_coupon.id, COALESCE(v_discount, 0)
  )
  RETURNING id INTO v_order_id;

  -- ── Items ───────────────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INT,
      (v_item->>'price_at_purchase')::NUMERIC
    );
  END LOOP;

  -- ── Redemption record ──────────────────────────────────────
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount)
    VALUES (v_coupon.id, auth.uid(), v_order_id, v_discount);
  END IF;

  RETURN v_order_id;
END;
$$;
REVOKE  ALL  ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

-- =============================================================
-- Verification:
--   • Create a test coupon:
--     INSERT INTO public.coupons (code, discount_type, discount_value, min_order_amount, per_user_limit)
--     VALUES ('WELCOME50', 'fixed', 50, 100, 1);
--   • Then in the app: cart with subtotal ≥ 100 → enter WELCOME50 → ₹50 off
-- =============================================================
