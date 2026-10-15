-- =============================================================
--  Migration 027 — Refunds + audit log + payouts ledger
--  ──────────────────────────────────────────────────────────────
--  Tier 4 backbone for actually running the business.
--
--   1. orders.refund_*       — mark a paid/COD order refunded
--   2. admin_audit_log       — who did what, when (trust + debugging)
--   3. shop_payouts          — money sent to a shopkeeper
--   4. agent_payouts         — money sent to a delivery agent
--   5. shop_earnings_view    — convenience view: gross revenue + payouts + net owed
--   6. agent_earnings_view   — same for agents
--   7. refund_order()        — RPC: refund + notify + audit log
--
--  Idempotent.
-- =============================================================

-- 1. Order refund columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refund_status TEXT
       CHECK (refund_status IS NULL OR refund_status IN ('pending', 'completed')),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS refunded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_refund_pending
  ON public.orders(refund_status) WHERE refund_status = 'pending';


-- 2. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT         NOT NULL,   -- 'order.refund', 'review.hide', 'product.delete', etc.
  target_type TEXT,                    -- 'order', 'review', 'product', 'shop', 'user'
  target_id   TEXT,                    -- uuid or other identifier
  metadata    JSONB,                   -- arbitrary context
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_time ON public.admin_audit_log(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target     ON public.admin_audit_log(target_type, target_id);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL            ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log"  ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins write audit log" ON public.admin_audit_log;

CREATE POLICY "Admins read audit log"  ON public.admin_audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins write audit log" ON public.admin_audit_log FOR INSERT WITH CHECK (public.is_admin());


-- 3. Shop payouts
CREATE TABLE IF NOT EXISTS public.shop_payouts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID         NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method       TEXT,                    -- 'upi', 'bank_transfer', 'cash'
  reference    TEXT,                    -- transaction reference / UTR
  note         TEXT,
  recorded_by  UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_shop ON public.shop_payouts(shop_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_payouts TO authenticated;
GRANT ALL                             ON public.shop_payouts TO service_role;
ALTER TABLE public.shop_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage shop payouts" ON public.shop_payouts;
DROP POLICY IF EXISTS "Shopkeepers see own payouts" ON public.shop_payouts;
CREATE POLICY "Admins manage shop payouts" ON public.shop_payouts FOR ALL USING (public.is_admin());
CREATE POLICY "Shopkeepers see own payouts" ON public.shop_payouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_id = auth.uid()));


-- 4. Agent payouts
CREATE TABLE IF NOT EXISTS public.agent_payouts (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method       TEXT,
  reference    TEXT,
  note         TEXT,
  recorded_by  UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_agent ON public.agent_payouts(agent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_payouts TO authenticated;
GRANT ALL                             ON public.agent_payouts TO service_role;
ALTER TABLE public.agent_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage agent payouts" ON public.agent_payouts;
DROP POLICY IF EXISTS "Agents see own payouts"      ON public.agent_payouts;
CREATE POLICY "Admins manage agent payouts" ON public.agent_payouts FOR ALL USING (public.is_admin());
CREATE POLICY "Agents see own payouts"      ON public.agent_payouts FOR SELECT
  USING (auth.uid() = agent_id);


-- 5. Earnings ledger (admin RPC) — single round-trip
CREATE OR REPLACE FUNCTION public.admin_payouts_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT jsonb_build_object(
    'shops', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT
          s.id,
          s.name,
          COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_price ELSE 0 END), 0)::FLOAT AS gross_delivered,
          COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::INT                                  AS delivered_count,
          COALESCE((SELECT SUM(sp.amount) FROM public.shop_payouts sp WHERE sp.shop_id = s.id), 0)::FLOAT AS total_paid_out
        FROM   public.shops s
        LEFT JOIN public.orders o ON o.shop_id = s.id AND o.status <> 'cancelled'
        GROUP BY s.id, s.name
        ORDER BY s.name
      ) t
    ), '[]'::jsonb),
    'agents', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT
          p.id,
          p.full_name,
          COUNT(CASE WHEN o.status = 'delivered' THEN 1 END)::INT  AS delivered_count,
          -- Earnings = #delivered × per-job rate (₹25 default). Hard-coded
          -- here so the DB doesn't depend on frontend config; admin UI also
          -- shows this constant on the page so they match.
          (COUNT(CASE WHEN o.status = 'delivered' THEN 1 END) * 25)::FLOAT AS gross_earned,
          COALESCE((SELECT SUM(ap.amount) FROM public.agent_payouts ap WHERE ap.agent_id = p.id), 0)::FLOAT AS total_paid_out
        FROM   public.profiles p
        LEFT JOIN public.orders o ON o.agent_id = p.id
        WHERE  p.role = 'agent'
        GROUP BY p.id, p.full_name
        ORDER BY p.full_name
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE  ALL  ON FUNCTION public.admin_payouts_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_payouts_summary() TO authenticated;


-- 6. Refund RPC — refund + notify + audit
CREATE OR REPLACE FUNCTION public.refund_order(
  p_order_id UUID,
  p_amount   NUMERIC DEFAULT NULL,    -- NULL = full refund
  p_reason   TEXT    DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  public.orders;
  v_amount NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  IF v_order.refund_status = 'completed' THEN RAISE EXCEPTION 'already refunded'; END IF;

  v_amount := COALESCE(p_amount, v_order.total_price);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'refund amount must be positive'; END IF;
  IF v_amount > v_order.total_price THEN RAISE EXCEPTION 'refund exceeds order total'; END IF;

  UPDATE public.orders SET
    refund_status = 'completed',
    refund_amount = v_amount,
    refunded_at   = NOW(),
    refunded_by   = auth.uid()
  WHERE  id = p_order_id
  RETURNING * INTO v_order;

  -- Customer notification
  INSERT INTO public.notifications (user_id, type, title, body, order_id)
  VALUES (
    v_order.customer_id,
    'system',
    'Refund processed',
    'Refund of ₹' || v_amount || ' processed for order #' || substr(v_order.id::TEXT, 1, 8),
    v_order.id
  );

  -- Audit log
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(),
    'order.refund',
    'order',
    v_order.id::TEXT,
    jsonb_build_object('amount', v_amount, 'reason', p_reason)
  );

  RETURN v_order;
END;
$$;

REVOKE  ALL  ON FUNCTION public.refund_order(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_order(UUID, NUMERIC, TEXT) TO authenticated;
