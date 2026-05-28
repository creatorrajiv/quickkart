-- =============================================================
--  Migration 025 — Persist variant info on order_items
--  ──────────────────────────────────────────────────────────────
--  Updates create_order_with_items so each inserted order_item
--  captures the variant_id + variant_label (snapshot at purchase time).
--  Signature unchanged — variants live inside the p_items JSONB array.
-- =============================================================

CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_items            JSONB,
  p_payment_method   TEXT,
  p_delivery_address TEXT,
  p_total_price      NUMERIC,
  p_coupon_code      TEXT DEFAULT NULL,
  p_redeem_points    INT  DEFAULT 0
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
  v_balance         INT;
  v_max_redeem      INT;
  v_redeem_amount   NUMERIC := 0;
  v_final_total     NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + ((v_item->>'price_at_purchase')::NUMERIC * (v_item->>'quantity')::INT);
    v_product_ids := array_append(v_product_ids, (v_item->>'product_id')::UUID);
  END LOOP;

  -- Coupon
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = UPPER(p_coupon_code) FOR UPDATE;
    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'invalid coupon'; END IF;
    IF NOT v_coupon.is_active THEN RAISE EXCEPTION 'coupon inactive'; END IF;
    IF v_coupon.valid_from > NOW() THEN RAISE EXCEPTION 'coupon not yet valid'; END IF;
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN RAISE EXCEPTION 'coupon expired'; END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN RAISE EXCEPTION 'coupon limit reached'; END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN RAISE EXCEPTION 'order below minimum'; END IF;

    SELECT COUNT(*) INTO v_user_redeems FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND user_id = auth.uid();
    IF v_user_redeems >= v_coupon.per_user_limit THEN RAISE EXCEPTION 'already used this coupon'; END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount := ROUND(v_subtotal * v_coupon.discount_value / 100.0, 2);
      IF v_coupon.max_discount IS NOT NULL AND v_discount > v_coupon.max_discount THEN
        v_discount := v_coupon.max_discount;
      END IF;
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;
    IF v_discount > v_subtotal THEN v_discount := v_subtotal; END IF;
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- Loyalty redemption
  IF p_redeem_points > 0 THEN
    SELECT loyalty_points INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
    IF v_balance < p_redeem_points THEN RAISE EXCEPTION 'insufficient loyalty points'; END IF;
    v_max_redeem := FLOOR(GREATEST(v_subtotal - v_discount, 0) * 0.20)::INT;
    IF p_redeem_points > v_max_redeem THEN
      RAISE EXCEPTION 'cannot redeem more than 20%% of order — max %', v_max_redeem;
    END IF;
    v_redeem_amount := p_redeem_points;
    UPDATE public.profiles SET loyalty_points = loyalty_points - p_redeem_points WHERE id = auth.uid();
  END IF;

  v_final_total := GREATEST(p_total_price - v_discount - v_redeem_amount, 0);

  SELECT (value::TEXT)::JSONB->>0 INTO v_assignment_mode
  FROM public.platform_settings WHERE key = 'order_assignment_mode';
  IF v_assignment_mode IS NULL THEN v_assignment_mode := 'auto'; END IF;
  IF v_assignment_mode = 'auto' THEN
    v_shop_id := public.pick_shop_for_order(v_product_ids);
  END IF;

  INSERT INTO public.orders (
    customer_id, payment_method, delivery_address, total_price, status, shop_id,
    coupon_id, discount_amount, redeemed_points
  )
  VALUES (
    auth.uid(), p_payment_method::payment_method, p_delivery_address,
    v_final_total, 'placed', v_shop_id,
    v_coupon.id, COALESCE(v_discount, 0), COALESCE(p_redeem_points, 0)
  )
  RETURNING id INTO v_order_id;

  -- ★ Items now persist variant_id + variant_label snapshot
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, quantity, price_at_purchase, variant_id, variant_label
    )
    VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INT,
      (v_item->>'price_at_purchase')::NUMERIC,
      NULLIF(v_item->>'variant_id', ''),
      NULLIF(v_item->>'variant_label', '')
    );
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount)
    VALUES (v_coupon.id, auth.uid(), v_order_id, v_discount);
  END IF;

  IF p_redeem_points > 0 THEN
    INSERT INTO public.loyalty_transactions (user_id, type, points, reason, order_id, balance_after)
    SELECT auth.uid(), 'redeem', -p_redeem_points,
           'Redeemed on order', v_order_id, loyalty_points
    FROM public.profiles WHERE id = auth.uid();
  END IF;

  RETURN v_order_id;
END;
$$;
REVOKE  ALL  ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT, INT) TO authenticated;
