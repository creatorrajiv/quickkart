-- =============================================================
--  Migration 001 — Marketplace Foundation
--  ──────────────────────────────────────────────────────────────
--  Turns the single-tenant catalog into a multi-shop marketplace.
--
--  Adds:
--    • 'shopkeeper' role
--    • shops table              (one row per kirana)
--    • shop_inventory table     (per-shop stock toggle)
--    • platform_settings table  (global key/value config)
--    • orders.shop_id column    (nullable for legacy rows)
--    • pick_shop_for_order()    (fair round-robin allocator)
--    • RLS policies + indexes
--
--  Safety:
--    Idempotent. Additive only. Existing data is preserved.
--    Run once in Supabase → SQL Editor. Safe to re-run.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Extend user_role with 'shopkeeper'
-- -------------------------------------------------------------
-- Postgres requires ALTER TYPE to add an enum value; this is
-- idempotent via IF NOT EXISTS (Postgres 14+).
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'shopkeeper';


-- -------------------------------------------------------------
-- 2. shops
-- -------------------------------------------------------------
-- Every kirana that joins the platform gets one row here.
-- owner_id links to the shopkeeper's profile (role='shopkeeper').
-- Location stored as separate lat/lng for now; PostGIS upgrade
-- (POINT geometry, ST_DWithin) lands in Phase E (live tracking).
CREATE TABLE IF NOT EXISTS public.shops (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  name              TEXT            NOT NULL,
  phone             TEXT,
  address           TEXT            NOT NULL,
  lat               NUMERIC(10, 7),
  lng               NUMERIC(10, 7),
  is_open           BOOLEAN         NOT NULL DEFAULT TRUE,
  accepts_cod       BOOLEAN         NOT NULL DEFAULT TRUE,
  -- 'pending'   → admin approved but kirana not active yet
  -- 'active'    → live; eligible for order assignment
  -- 'paused'    → temporarily off (vacation, low stock); skipped by allocator
  -- 'suspended' → disabled by admin (policy violation, KYC issue)
  status            TEXT            NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending', 'active', 'paused', 'suspended')),
  rating            NUMERIC(2, 1)   DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5),
  opens_at          TIME,
  closes_at         TIME,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shops_status   ON public.shops(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_shops_is_open  ON public.shops(is_open) WHERE is_open = TRUE;
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_shops_geo      ON public.shops(lat, lng);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS trg_shops_updated_at ON public.shops;
CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();   -- reuses existing trigger fn


-- -------------------------------------------------------------
-- 3. shop_inventory
-- -------------------------------------------------------------
-- Composite primary key (shop_id, product_id). A shop's stock for
-- a given SKU is one row; absence of a row means "not stocked".
--
-- Why a separate table rather than a JSONB column on shops:
--  • Each row is independently indexable (fast availability joins)
--  • Realtime subscribes per-shop, per-product (Phase E)
--  • Bulk imports map naturally to row inserts
CREATE TABLE IF NOT EXISTS public.shop_inventory (
  shop_id      UUID           NOT NULL REFERENCES public.shops(id)    ON DELETE CASCADE,
  product_id   UUID           NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  available    BOOLEAN        NOT NULL DEFAULT TRUE,
  -- stock_qty is informational for the shopkeeper. The platform
  -- treats `available = TRUE` as the sole gate for assignment.
  -- Quantity-aware allocation (decrement on order) lands in Phase C
  -- when the shop acceptance flow is built.
  stock_qty    INT            NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (shop_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_shop_inventory_product_avail
  ON public.shop_inventory(product_id) WHERE available = TRUE;

DROP TRIGGER IF EXISTS trg_shop_inventory_updated_at ON public.shop_inventory;
CREATE TRIGGER trg_shop_inventory_updated_at
  BEFORE UPDATE ON public.shop_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- -------------------------------------------------------------
-- 4. platform_settings
-- -------------------------------------------------------------
-- Single-row-per-key store for admin-tunable platform behaviour.
-- Today we use it for the order assignment mode toggle; future
-- settings (surge pricing %, support phone, etc.) slot in without
-- schema changes.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         TEXT         PRIMARY KEY,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  UUID         REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed the assignment mode. 'auto' = pick_shop_for_order picks the shop.
-- 'manual' = orders are created with shop_id NULL; admin assigns.
INSERT INTO public.platform_settings (key, value)
VALUES ('order_assignment_mode', '"auto"'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- -------------------------------------------------------------
-- 5. orders.shop_id
-- -------------------------------------------------------------
-- Nullable so legacy rows survive. Once the platform has at least
-- one shop and assignment is 'auto', new orders will always have it.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders(shop_id);

-- Composite index that the fairness allocator uses to count
-- "orders this shop received this month" cheaply.
CREATE INDEX IF NOT EXISTS idx_orders_shop_created_at
  ON public.orders(shop_id, created_at DESC);


-- -------------------------------------------------------------
-- 6. pick_shop_for_order() — fair allocator
-- -------------------------------------------------------------
-- Returns the shop_id that should fulfill an order containing
-- the given product_ids, or NULL if no eligible shop exists.
--
-- Algorithm:
--   1. Filter shops that are active, open, and stock EVERY requested
--      product (no partial fulfilment in MVP).
--   2. Among those, pick the one with the FEWEST orders this calendar
--      month. Ties broken randomly so two shops at the same count
--      don't always lose to the same alphabetically-earlier id.
--
-- Why "fewest this month" rather than "all time":
--   New shops joining mid-month would otherwise win every order until
--   they catch up, starving older shops. Resetting per month keeps the
--   distribution fair on a rolling basis.
--
-- Why SECURITY DEFINER:
--   The function reads from public.shops and public.shop_inventory.
--   Customers placing orders need to invoke it but don't (and shouldn't)
--   have direct SELECT on those tables under all conditions. Running as
--   the function owner sidesteps the RLS while keeping the function
--   itself the only path that returns a shop assignment.
CREATE OR REPLACE FUNCTION public.pick_shop_for_order(p_product_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_count INT := COALESCE(array_length(p_product_ids, 1), 0);
  v_shop_id        UUID;
BEGIN
  IF v_required_count = 0 THEN
    RETURN NULL;
  END IF;

  WITH eligible_shops AS (
    -- Shops that stock and have marked available EVERY requested product.
    SELECT s.id
    FROM public.shops s
    JOIN public.shop_inventory si ON si.shop_id = s.id
    WHERE s.status  = 'active'
      AND s.is_open = TRUE
      AND si.available = TRUE
      AND si.product_id = ANY(p_product_ids)
    GROUP BY s.id
    HAVING COUNT(DISTINCT si.product_id) = v_required_count
  ),
  monthly_load AS (
    -- How many orders has each eligible shop received this month?
    SELECT
      es.id AS shop_id,
      COUNT(o.id) AS orders_this_month
    FROM eligible_shops es
    LEFT JOIN public.orders o
      ON o.shop_id    = es.id
      AND o.created_at >= date_trunc('month', NOW())
    GROUP BY es.id
  )
  SELECT shop_id
  INTO v_shop_id
  FROM monthly_load
  ORDER BY orders_this_month ASC, RANDOM()
  LIMIT 1;

  RETURN v_shop_id;
END;
$$;

REVOKE  ALL  ON FUNCTION public.pick_shop_for_order(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pick_shop_for_order(UUID[]) TO authenticated;


-- =============================================================
-- Table-level GRANTS
-- =============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_inventory    TO authenticated;
GRANT SELECT                         ON public.shops             TO anon;
GRANT SELECT                         ON public.shop_inventory    TO anon;
GRANT SELECT, INSERT, UPDATE         ON public.platform_settings TO authenticated;


-- =============================================================
-- Row-Level Security
-- =============================================================

-- ── shops ─────────────────────────────────────────────────────
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view open active shops" ON public.shops;
DROP POLICY IF EXISTS "Shopkeepers can view own shop"     ON public.shops;
DROP POLICY IF EXISTS "Shopkeepers can update own shop"   ON public.shops;
DROP POLICY IF EXISTS "Admins can manage all shops"       ON public.shops;

-- Public-facing: customers and unauthenticated visitors can see active+open shops
-- (needed for the "shops near you" view in Phase B).
CREATE POLICY "Anyone can view open active shops"
  ON public.shops FOR SELECT
  USING (status = 'active' AND is_open = TRUE);

-- Shopkeepers see their own shop regardless of open/active state
-- so they can flip it back on after a pause.
CREATE POLICY "Shopkeepers can view own shop"
  ON public.shops FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Shopkeepers can update own shop"
  ON public.shops FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Admins can manage all shops"
  ON public.shops FOR ALL
  USING (public.is_admin());


-- ── shop_inventory ────────────────────────────────────────────
ALTER TABLE public.shop_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view inventory of open shops" ON public.shop_inventory;
DROP POLICY IF EXISTS "Shopkeepers can view own inventory"      ON public.shop_inventory;
DROP POLICY IF EXISTS "Shopkeepers can manage own inventory"    ON public.shop_inventory;
DROP POLICY IF EXISTS "Admins can manage all inventory"         ON public.shop_inventory;

-- Public: inventory rows are visible if the parent shop is visible.
-- This lets the customer-facing app show "in stock at 3 nearby shops".
CREATE POLICY "Anyone can view inventory of open shops"
  ON public.shop_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id
        AND s.status = 'active'
        AND s.is_open = TRUE
    )
  );

CREATE POLICY "Shopkeepers can view own inventory"
  ON public.shop_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Shopkeepers can manage own inventory"
  ON public.shop_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all inventory"
  ON public.shop_inventory FOR ALL
  USING (public.is_admin());


-- ── platform_settings ─────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Admins can write platform settings" ON public.platform_settings;

-- Settings are read by every role (customers need to know if COD is
-- enabled, shopkeepers need their global SLA, etc.). Writes are admin-only.
CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can write platform settings"
  ON public.platform_settings FOR ALL
  USING (public.is_admin());


-- =============================================================
-- Verification queries (run these in SQL editor after applying):
-- =============================================================
-- 1. Confirm enum value:
--    SELECT unnest(enum_range(NULL::user_role));
--
-- 2. Confirm tables:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name IN ('shops','shop_inventory','platform_settings');
--
-- 3. Confirm shop_id column on orders:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name='orders' AND column_name='shop_id';
--
-- 4. Confirm allocator function:
--    SELECT proname FROM pg_proc WHERE proname='pick_shop_for_order';
--
-- 5. Confirm setting seeded:
--    SELECT * FROM public.platform_settings WHERE key='order_assignment_mode';
-- =============================================================
