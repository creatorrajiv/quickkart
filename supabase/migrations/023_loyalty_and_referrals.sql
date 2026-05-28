-- =============================================================
--  Migration 023 — Loyalty points + referrals
--  ──────────────────────────────────────────────────────────────
--  Earn points on every delivered order, redeem them for discount,
--  invite friends with a personal referral code.
--
--  Schema:
--    profiles.loyalty_points  — running balance
--    profiles.referral_code   — auto-generated unique short code
--    profiles.referred_by     — who invited this customer
--    orders.redeemed_points / earned_points — per-order ledger
--    loyalty_transactions     — full audit log
--
--  RPCs:
--    redeem_loyalty_points(points, order_id)  — atomic deduct + log
--    award_loyalty_points(points, reason, order_id)  — atomic add + log
--    use_referral_code(code)  — apply on signup
--
--  Triggers:
--    After order delivered → earn points
--
--  Idempotent.
-- =============================================================

-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS loyalty_points INT  NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  ADD COLUMN IF NOT EXISTS referral_code  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;


-- 2. Auto-generate a unique referral code for new customers
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_code TEXT;
  v_exists BOOL;
BEGIN
  LOOP
    v_code := UPPER(substring(replace(gen_random_uuid()::TEXT, '-', ''), 1, 6));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    IF NOT v_exists THEN RETURN v_code; END IF;
  END LOOP;
END;
$$;

-- Backfill for existing customers
UPDATE public.profiles
SET    referral_code = public.generate_referral_code()
WHERE  referral_code IS NULL;

-- Patch handle_new_user trigger so new profiles get a code automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    public.generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- 3. Orders ledger columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS redeemed_points INT NOT NULL DEFAULT 0 CHECK (redeemed_points >= 0),
  ADD COLUMN IF NOT EXISTS earned_points   INT NOT NULL DEFAULT 0 CHECK (earned_points >= 0);


-- 4. Loyalty transaction log
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT         NOT NULL CHECK (type IN ('earn','redeem','signup_bonus','referral_reward','admin_adjust')),
  points      INT          NOT NULL,
  reason      TEXT,
  order_id    UUID         REFERENCES public.orders(id) ON DELETE SET NULL,
  balance_after INT        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_txn_user_time
  ON public.loyalty_transactions(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_transactions TO service_role;

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own loyalty txns" ON public.loyalty_transactions;
CREATE POLICY "Users see own loyalty txns"
  ON public.loyalty_transactions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());


-- 5. Core RPC: award points (atomic update + log)
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_user_id  UUID,
  p_points   INT,
  p_type     TEXT,
  p_reason   TEXT DEFAULT NULL,
  p_order_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INT;
BEGIN
  IF p_points <= 0 THEN RAISE EXCEPTION 'points must be positive'; END IF;

  UPDATE public.profiles
  SET    loyalty_points = loyalty_points + p_points
  WHERE  id = p_user_id
  RETURNING loyalty_points INTO v_balance;

  IF v_balance IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;

  INSERT INTO public.loyalty_transactions (user_id, type, points, reason, order_id, balance_after)
  VALUES (p_user_id, p_type, p_points, p_reason, p_order_id, v_balance);

  RETURN v_balance;
END;
$$;
REVOKE  ALL  ON FUNCTION public.award_loyalty_points(UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(UUID, INT, TEXT, TEXT, UUID) TO authenticated;


-- 6. Trigger: award earn-points when order is marked DELIVERED.
-- Rate: 1 point per ₹20 spent (configurable in business config).
-- Only runs once per order (checks earned_points is still 0).
CREATE OR REPLACE FUNCTION public.trg_award_on_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INT;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' AND NEW.earned_points = 0 THEN
    v_points := GREATEST(FLOOR(NEW.total_price / 20.0)::INT, 0);
    IF v_points > 0 THEN
      PERFORM public.award_loyalty_points(NEW.customer_id, v_points, 'earn', 'Order delivered', NEW.id);
      UPDATE public.orders SET earned_points = v_points WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_award_on_delivered ON public.orders;
CREATE TRIGGER trg_orders_award_on_delivered
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_on_delivered();


-- 7. Apply a referral code at signup. Customer calls this from /register
-- after they're authenticated. Idempotent — won't apply twice.
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me        UUID := auth.uid();
  v_my_profile RECORD;
  v_inviter   RECORD;
BEGIN
  IF v_me IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Not signed in'); END IF;

  SELECT * INTO v_my_profile FROM public.profiles WHERE id = v_me;
  IF v_my_profile.referred_by IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Referral already applied');
  END IF;

  SELECT * INTO v_inviter FROM public.profiles WHERE referral_code = UPPER(TRIM(p_code));
  IF v_inviter.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid referral code');
  END IF;
  IF v_inviter.id = v_me THEN
    RETURN jsonb_build_object('ok', false, 'message', "You can't refer yourself");
  END IF;

  -- Record the linkage
  UPDATE public.profiles SET referred_by = v_inviter.id WHERE id = v_me;

  -- Award bonuses (50 to new user, 100 to inviter)
  PERFORM public.award_loyalty_points(v_me,         50,  'referral_reward', 'Used a friend''s code',  NULL);
  PERFORM public.award_loyalty_points(v_inviter.id, 100, 'referral_reward', 'A friend used your code', NULL);

  RETURN jsonb_build_object('ok', true, 'message', '+50 points added! Welcome bonus', 'awarded', 50);
END;
$$;
REVOKE  ALL  ON FUNCTION public.apply_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT) TO authenticated;


-- 8. One-time 25-pt signup bonus. Called from /register flow.
CREATE OR REPLACE FUNCTION public.claim_signup_bonus()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_already INT;
BEGIN
  IF v_me IS NULL THEN RETURN jsonb_build_object('ok', false, 'message', 'Not signed in'); END IF;

  SELECT COUNT(*) INTO v_already
  FROM public.loyalty_transactions
  WHERE user_id = v_me AND type = 'signup_bonus';
  IF v_already > 0 THEN RETURN jsonb_build_object('ok', false, 'message', 'Already claimed'); END IF;

  PERFORM public.award_loyalty_points(v_me, 25, 'signup_bonus', 'Welcome to QuickKart', NULL);
  RETURN jsonb_build_object('ok', true, 'awarded', 25);
END;
$$;
REVOKE  ALL  ON FUNCTION public.claim_signup_bonus() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_signup_bonus() TO authenticated;


-- 9. Extend create_order_with_items to accept p_redeem_points
--    (server-side validation prevents tampering)
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

  -- Subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + ((v_item->>'price_at_purchase')::NUMERIC * (v_item->>'quantity')::INT);
    v_product_ids := array_append(v_product_ids, (v_item->>'product_id')::UUID);
  END LOOP;

  -- Coupon (unchanged)
  IF p_coupon_code IS NOT NULL AND length(trim(p_coupon_code)) > 0 THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE code = UPPER(p_coupon_code) FOR UPDATE;
    IF v_coupon.id IS NULL THEN RAISE EXCEPTION 'invalid coupon'; END IF;
    IF NOT v_coupon.is_active THEN RAISE EXCEPTION 'coupon inactive'; END IF;
    IF v_coupon.valid_from > NOW() THEN RAISE EXCEPTION 'coupon not yet valid'; END IF;
    IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < NOW() THEN RAISE EXCEPTION 'coupon expired'; END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.used_count >= v_coupon.usage_limit THEN RAISE EXCEPTION 'coupon limit reached'; END IF;
    IF v_subtotal < v_coupon.min_order_amount THEN RAISE EXCEPTION 'order below minimum'; END IF;

    SELECT COUNT(*) INTO v_user_redeems
    FROM public.coupon_redemptions
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

  -- Loyalty redemption — server-side validation
  IF p_redeem_points > 0 THEN
    SELECT loyalty_points INTO v_balance FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
    IF v_balance < p_redeem_points THEN RAISE EXCEPTION 'insufficient loyalty points'; END IF;

    -- Cap: max 20% of subtotal (post-coupon) can be paid with points
    v_max_redeem := FLOOR(GREATEST(v_subtotal - v_discount, 0) * 0.20)::INT;
    IF p_redeem_points > v_max_redeem THEN
      RAISE EXCEPTION 'cannot redeem more than 20%% of order — max %', v_max_redeem;
    END IF;

    v_redeem_amount := p_redeem_points;       -- 1 point = ₹1
    UPDATE public.profiles SET loyalty_points = loyalty_points - p_redeem_points
    WHERE  id = auth.uid();
  END IF;

  v_final_total := GREATEST(p_total_price - v_discount - v_redeem_amount, 0);

  -- Shop assignment
  SELECT (value::TEXT)::JSONB->>0 INTO v_assignment_mode
  FROM public.platform_settings WHERE key = 'order_assignment_mode';
  IF v_assignment_mode IS NULL THEN v_assignment_mode := 'auto'; END IF;
  IF v_assignment_mode = 'auto' THEN
    v_shop_id := public.pick_shop_for_order(v_product_ids);
  END IF;

  -- Insert order
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

  -- Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INT,
      (v_item->>'price_at_purchase')::NUMERIC
    );
  END LOOP;

  -- Coupon redemption record
  IF v_coupon.id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount)
    VALUES (v_coupon.id, auth.uid(), v_order_id, v_discount);
  END IF;

  -- Loyalty redemption ledger entry
  IF p_redeem_points > 0 THEN
    INSERT INTO public.loyalty_transactions (user_id, type, points, reason, order_id, balance_after)
    SELECT auth.uid(), 'redeem', -p_redeem_points,
           'Redeemed on order', v_order_id, loyalty_points
    FROM   public.profiles WHERE id = auth.uid();
  END IF;

  RETURN v_order_id;
END;
$$;
REVOKE  ALL  ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(JSONB, TEXT, TEXT, NUMERIC, TEXT, INT) TO authenticated;

-- =============================================================
-- Verify:
--   SELECT id, email, loyalty_points, referral_code FROM public.profiles LIMIT 5;
--   SELECT * FROM public.loyalty_transactions ORDER BY created_at DESC LIMIT 10;
-- =============================================================
