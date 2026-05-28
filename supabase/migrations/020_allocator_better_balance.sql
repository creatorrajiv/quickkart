-- =============================================================
--  Migration 020 — Better-balanced shop allocator
--  ──────────────────────────────────────────────────────────────
--  Previous formula gave too much weight to rating — on a brand-new
--  platform with 0 monthly orders, the best-rated shop won 100% of
--  the time. Mathematically correct but practically unfair.
--
--  Updated weights:
--     monthly_orders  × 1.0   (fairness — load received this month)
--     active_orders   × 2.0   (capacity — penalize busy shops)
--     (5 − rating)    × 1.0   (quality bias — gentle, not dominant)
--   + RANDOM()        × 0.8   (jitter — breaks near-ties for variety)
--
--  Behaviour:
--    • Day 1 (0 orders): scores cluster within ~1.1 + 0.8 random jitter
--      → multiple shops win throughout the day, weighted toward higher
--        ratings but never deterministic.
--    • Over time, monthly_orders dominates → fairness wins.
--    • A shop with 5 active deliveries gets a +10 score hit → naturally
--      stops getting more orders until they're cleared.
--
--  Idempotent — replaces the existing pick_shop_for_order function.
-- =============================================================

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
  IF v_required_count = 0 THEN RETURN NULL; END IF;

  WITH eligible_shops AS (
    SELECT s.id, s.rating, s.opens_at, s.closes_at
    FROM   public.shops s
    JOIN   public.shop_inventory si ON si.shop_id = s.id
    WHERE  s.status   = 'active'
      AND  s.is_open  = TRUE
      AND  si.available = TRUE
      AND  si.product_id = ANY(p_product_ids)
      AND ( (s.opens_at IS NULL OR s.closes_at IS NULL)
            OR (s.opens_at <= v_now_time AND v_now_time <= s.closes_at)
            OR (s.opens_at > s.closes_at
                AND (v_now_time >= s.opens_at OR v_now_time <= s.closes_at)) )
    GROUP BY s.id
    HAVING COUNT(DISTINCT si.product_id) = v_required_count
  ),
  scored AS (
    SELECT
      es.id,
      COALESCE((
        SELECT COUNT(*) FROM public.orders o
        WHERE o.shop_id = es.id
          AND o.created_at >= date_trunc('month', NOW())
          AND o.status <> 'cancelled'
      ), 0) AS monthly_orders,
      COALESCE((
        SELECT COUNT(*) FROM public.orders o
        WHERE o.shop_id = es.id
          AND o.status IN ('placed', 'preparing', 'out_for_delivery')
      ), 0) AS active_orders,
      COALESCE(es.rating, 4.0) AS rating
    FROM eligible_shops es
  )
  SELECT id
  INTO   v_shop_id
  FROM   scored
  ORDER  BY
    (monthly_orders * 1.0
     + active_orders * 2.0
     + (5.0 - rating) * 1.0
     + RANDOM() * 0.8) ASC
  LIMIT 1;

  RETURN v_shop_id;
END;
$$;

REVOKE  ALL  ON FUNCTION public.pick_shop_for_order(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pick_shop_for_order(UUID[]) TO authenticated;

-- =============================================================
-- Test after applying:
--   SELECT s.name FROM (
--     SELECT public.pick_shop_for_order(
--       ARRAY(SELECT id FROM public.products WHERE is_available LIMIT 3)
--     ) AS sid FROM generate_series(1, 20)
--   ) p JOIN public.shops s ON s.id = p.sid;
--
-- Expected: several different TEST_SHOP_* names appear,
--           higher-rated shops slightly more often.
-- =============================================================
