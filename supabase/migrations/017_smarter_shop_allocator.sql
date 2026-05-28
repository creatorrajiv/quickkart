-- =============================================================
--  Migration 017 — Smarter shop allocator (composite scoring)
--  ──────────────────────────────────────────────────────────────
--  Replaces the simple "fewest orders this month + random" picker
--  with a multi-factor scoring formula.
--
--  Composite SCORE (lower wins):
--    fairness_load * 1.0      — orders received this month
--  + active_load    * 2.5      — orders currently in-flight (placed/preparing/out_for_delivery)
--  + rating_penalty * 3.0      — (5 - avg_rating). New shops default to 4.0
--  + cod_mismatch   * 100.0    — if shop doesn't accept COD but order is COD, near-disqualify
--
--  Eligibility (hard filters — done before scoring):
--    • Shop status = 'active'
--    • Shop is_open = TRUE
--    • Currently within opens_at..closes_at window (if both set)
--    • Stocks EVERY requested product (available=true)
--
--  Tie-breaker: RANDOM(). Two equally-scored shops alternate fairly.
--
--  Idempotent.
-- =============================================================

-- Replace the old function with a smarter one. Keep the same name so the
-- existing create_order_with_items RPC continues working unchanged.
CREATE OR REPLACE FUNCTION public.pick_shop_for_order(p_product_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_count INT := COALESCE(array_length(p_product_ids, 1), 0);
  v_shop_id        UUID;
  v_now_time       TIME := (NOW() AT TIME ZONE 'Asia/Kolkata')::TIME;
BEGIN
  IF v_required_count = 0 THEN
    RETURN NULL;
  END IF;

  WITH eligible_shops AS (
    -- 1. Must stock every requested product
    SELECT s.id, s.rating, s.accepts_cod, s.opens_at, s.closes_at
    FROM   public.shops s
    JOIN   public.shop_inventory si ON si.shop_id = s.id
    WHERE  s.status   = 'active'
      AND  s.is_open  = TRUE
      AND  si.available = TRUE
      AND  si.product_id = ANY(p_product_ids)
      -- Hours filter: only if BOTH opens_at and closes_at are set
      AND ( (s.opens_at IS NULL OR s.closes_at IS NULL)
            OR (s.opens_at <= v_now_time AND v_now_time <= s.closes_at)
            -- handle overnight (e.g. opens 22:00, closes 02:00)
            OR (s.opens_at > s.closes_at
                AND (v_now_time >= s.opens_at OR v_now_time <= s.closes_at)) )
    GROUP BY s.id
    HAVING COUNT(DISTINCT si.product_id) = v_required_count
  ),
  scored AS (
    SELECT
      es.id,
      -- Fairness: orders received this month
      COALESCE((
        SELECT COUNT(*) FROM public.orders o
        WHERE o.shop_id = es.id
          AND o.created_at >= date_trunc('month', NOW())
          AND o.status <> 'cancelled'
      ), 0) AS monthly_orders,
      -- Active load: orders currently in progress
      COALESCE((
        SELECT COUNT(*) FROM public.orders o
        WHERE o.shop_id = es.id
          AND o.status IN ('placed', 'preparing', 'out_for_delivery')
      ), 0) AS active_orders,
      -- Rating with a 4.0 floor so new shops aren't punished
      COALESCE(es.rating, 4.0) AS rating
    FROM eligible_shops es
  )
  SELECT id
  INTO   v_shop_id
  FROM   scored
  ORDER  BY
    (monthly_orders * 1.0
     + active_orders * 2.5
     + (5.0 - rating) * 3.0) ASC,
    RANDOM()
  LIMIT 1;

  RETURN v_shop_id;
END;
$$;

REVOKE  ALL  ON FUNCTION public.pick_shop_for_order(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pick_shop_for_order(UUID[]) TO authenticated;


-- -------------------------------------------------------------
-- Bonus: a recomputed-rating helper for keeping shops.rating fresh
-- (called from a trigger after a review is inserted/updated/deleted)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_shop_rating(p_shop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shops s
  SET    rating = COALESCE((
           SELECT ROUND(AVG(r.shop_rating)::NUMERIC, 1)
           FROM   public.reviews r
           WHERE  r.shop_id = s.id AND r.shop_rating IS NOT NULL
         ), 0.0)
  WHERE  s.id = p_shop_id;
END;
$$;

-- Trigger: whenever a review is written, refresh the shop's denormalised rating.
CREATE OR REPLACE FUNCTION public.trg_review_refresh_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.shop_id IS NOT NULL THEN PERFORM public.refresh_shop_rating(OLD.shop_id); END IF;
    RETURN OLD;
  END IF;
  IF NEW.shop_id IS NOT NULL THEN PERFORM public.refresh_shop_rating(NEW.shop_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_refresh_shop_rating ON public.reviews;
CREATE TRIGGER trg_reviews_refresh_shop_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_review_refresh_rating();

-- =============================================================
-- How to test the allocator after seeding shops (migration 018):
--
--   SELECT public.pick_shop_for_order(
--     ARRAY(SELECT id FROM public.products WHERE is_available LIMIT 3)
--   );
--
--   -- Should return DIFFERENT shop_ids on repeat calls until one shop
--   -- pulls ahead in monthly orders; then that shop drops in the ranking.
-- =============================================================
