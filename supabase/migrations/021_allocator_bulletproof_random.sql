-- =============================================================
--  Migration 021 — Bulletproof random in shop allocator
--  ──────────────────────────────────────────────────────────────
--  Final allocator tune. Materialises RANDOM() per row inside the
--  CTE (so it definitely varies between shops), and increases the
--  jitter weight so it can overcome rating differences on a brand-
--  new platform with 0 orders.
--
--  Final weights:
--     monthly_orders × 1.5    — fairness dominates as platform matures
--     active_orders  × 2.0    — capacity / load shedding
--     (5 − rating)   × 1.0    — quality bias (smaller weight)
--     jitter         × 3.0    — random per-row, range [0, 3)
--
--  With 0 orders + jitter 3.0: rating gap of 0.9 (best vs worst)
--  is easily overcome by the random component → all shops get a fair
--  shot, biased toward higher rating.
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
    SELECT s.id, s.rating
    FROM   public.shops s
    JOIN   public.shop_inventory si ON si.shop_id = s.id
    WHERE  s.status     = 'active'
      AND  s.is_open    = TRUE
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
      ), 0)::NUMERIC AS monthly_orders,
      COALESCE((
        SELECT COUNT(*) FROM public.orders o
        WHERE o.shop_id = es.id
          AND o.status IN ('placed', 'preparing', 'out_for_delivery')
      ), 0)::NUMERIC AS active_orders,
      COALESCE(es.rating, 4.0)::NUMERIC AS rating,
      -- ★ Materialise the random per row so it's locked in before ORDER BY
      RANDOM() AS jitter
    FROM eligible_shops es
  )
  SELECT id
  INTO   v_shop_id
  FROM   scored
  ORDER  BY
    (monthly_orders * 1.5
     + active_orders * 2.0
     + (5.0 - rating) * 1.0
     + jitter * 3.0) ASC
  LIMIT 1;

  RETURN v_shop_id;
END;
$$;

REVOKE  ALL  ON FUNCTION public.pick_shop_for_order(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pick_shop_for_order(UUID[]) TO authenticated;
