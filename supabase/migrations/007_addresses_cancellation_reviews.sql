-- =============================================================
--  Migration 007 — Addresses, Cancellation, Reviews
--  ──────────────────────────────────────────────────────────────
--  Three independent features bundled into one migration so we
--  ship them together.
--
--  1. customer_addresses     — saved address book
--  2. order_status += 'cancelled' + cancellation_reason/cancelled_at
--  3. reviews               — customer rates shop & agent after delivery
--
--  Idempotent.
-- =============================================================

-- =============================================================
-- 1. customer_addresses
-- =============================================================
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label       TEXT         NOT NULL,    -- "Home", "Office", "Mom's place"
  address     TEXT         NOT NULL,    -- full multi-line address
  phone       TEXT,                     -- optional alt contact for this addr
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user
  ON public.customer_addresses(user_id, is_default DESC, created_at DESC);

-- Only one default per user. Partial unique index — works regardless
-- of how many non-default rows a user has.
DROP INDEX IF EXISTS uniq_default_address_per_user;
CREATE UNIQUE INDEX uniq_default_address_per_user
  ON public.customer_addresses(user_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON public.customer_addresses;
CREATE POLICY "Users manage own addresses"
  ON public.customer_addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================
-- 2. Order cancellation
-- =============================================================
-- Add 'cancelled' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Track who cancelled, when, and why
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Emit notification when an order is cancelled. We re-use the
-- existing emit_order_notifications trigger — it already fires on
-- status changes, so adding 'cancelled' to the enum is enough.


-- =============================================================
-- 3. Reviews
-- =============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     UUID         NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id      UUID         REFERENCES public.shops(id) ON DELETE SET NULL,
  agent_id     UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  shop_rating  SMALLINT     CHECK (shop_rating  IS NULL OR (shop_rating  BETWEEN 1 AND 5)),
  agent_rating SMALLINT     CHECK (agent_rating IS NULL OR (agent_rating BETWEEN 1 AND 5)),
  comment      TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- One review per order
  CONSTRAINT uniq_review_per_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_shop   ON public.reviews(shop_id)  WHERE shop_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_agent  ON public.reviews(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON public.reviews(customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews"          ON public.reviews;
DROP POLICY IF EXISTS "Customers can write own review"   ON public.reviews;
DROP POLICY IF EXISTS "Customers can edit own review"    ON public.reviews;
DROP POLICY IF EXISTS "Customers can delete own review"  ON public.reviews;

-- Reviews are public — anyone can read (for "average rating" displays).
CREATE POLICY "Anyone can read reviews"
  ON public.reviews FOR SELECT
  USING (TRUE);

CREATE POLICY "Customers can write own review"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can edit own review"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete own review"
  ON public.reviews FOR DELETE
  USING (auth.uid() = customer_id);


-- =============================================================
-- 4. Admin metrics RPC
-- =============================================================
-- One query returns everything the admin dashboard needs.
-- Cheap to call — all aggregations are indexed.
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Only admins. (RPC runs as definer, so we must enforce ourselves.)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT json_build_object(
    'today', json_build_object(
      'orders',   COALESCE((SELECT COUNT(*)             FROM orders WHERE created_at >= date_trunc('day',  NOW())), 0),
      'revenue',  COALESCE((SELECT SUM(total_price)::FLOAT FROM orders WHERE created_at >= date_trunc('day',  NOW()) AND status <> 'cancelled'), 0)
    ),
    'week', json_build_object(
      'orders',   COALESCE((SELECT COUNT(*)             FROM orders WHERE created_at >= NOW() - INTERVAL '7 days'), 0),
      'revenue',  COALESCE((SELECT SUM(total_price)::FLOAT FROM orders WHERE created_at >= NOW() - INTERVAL '7 days' AND status <> 'cancelled'), 0)
    ),
    'month', json_build_object(
      'orders',   COALESCE((SELECT COUNT(*)             FROM orders WHERE created_at >= date_trunc('month', NOW())), 0),
      'revenue',  COALESCE((SELECT SUM(total_price)::FLOAT FROM orders WHERE created_at >= date_trunc('month', NOW()) AND status <> 'cancelled'), 0)
    ),
    'active_orders', COALESCE((SELECT COUNT(*) FROM orders WHERE status IN ('placed','preparing','out_for_delivery')), 0),
    'cancelled_today', COALESCE((SELECT COUNT(*) FROM orders WHERE status = 'cancelled' AND COALESCE(cancelled_at, created_at) >= date_trunc('day', NOW())), 0),
    'totals', json_build_object(
      'customers',   COALESCE((SELECT COUNT(*) FROM profiles WHERE role = 'customer'), 0),
      'agents',      COALESCE((SELECT COUNT(*) FROM profiles WHERE role = 'agent'    AND is_active = TRUE), 0),
      'shopkeepers', COALESCE((SELECT COUNT(*) FROM profiles WHERE role = 'shopkeeper' AND is_active = TRUE), 0),
      'shops',       COALESCE((SELECT COUNT(*) FROM shops    WHERE status = 'active'), 0)
    ),
    'top_shops', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT s.id, s.name,
               COUNT(o.id)::INT                          AS orders,
               COALESCE(SUM(o.total_price), 0)::FLOAT    AS revenue
        FROM shops s
        LEFT JOIN orders o
          ON o.shop_id = s.id
         AND o.created_at >= date_trunc('month', NOW())
         AND o.status <> 'cancelled'
        GROUP BY s.id, s.name
        ORDER BY orders DESC NULLS LAST
        LIMIT 5
      ) t
    ), '[]'::json),
    'top_agents', COALESCE((
      SELECT json_agg(row_to_json(t)) FROM (
        SELECT p.id, p.full_name,
               COUNT(o.id)::INT                          AS deliveries,
               COALESCE(SUM(o.total_price), 0)::FLOAT    AS handled_value
        FROM profiles p
        LEFT JOIN orders o
          ON o.agent_id = p.id
         AND o.status   = 'delivered'
         AND o.created_at >= date_trunc('month', NOW())
        WHERE p.role = 'agent'
        GROUP BY p.id, p.full_name
        ORDER BY deliveries DESC NULLS LAST
        LIMIT 5
      ) t
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE  ALL  ON FUNCTION public.admin_dashboard_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics() TO authenticated;


-- =============================================================
-- 5. Cancellation RPC (sets status + cancelled_at + reason atomically)
-- =============================================================
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;

  -- Auth rules:
  --   Customer: can cancel their OWN order if not yet out_for_delivery
  --   Admin:    can cancel any order in any state except already delivered
  IF v_caller_role = 'customer' THEN
    IF v_order.customer_id <> auth.uid() THEN RAISE EXCEPTION 'not your order'; END IF;
    IF v_order.status IN ('out_for_delivery','delivered','cancelled') THEN
      RAISE EXCEPTION 'order can no longer be cancelled (current status: %)', v_order.status;
    END IF;
  ELSIF v_caller_role = 'admin' THEN
    IF v_order.status IN ('delivered','cancelled') THEN
      RAISE EXCEPTION 'order can no longer be cancelled (current status: %)', v_order.status;
    END IF;
  ELSE
    RAISE EXCEPTION 'only customer or admin can cancel';
  END IF;

  UPDATE public.orders
  SET status              = 'cancelled',
      cancelled_at        = NOW(),
      cancellation_reason = p_reason,
      cancelled_by        = auth.uid()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

REVOKE  ALL  ON FUNCTION public.cancel_order(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_order(UUID, TEXT) TO authenticated;
