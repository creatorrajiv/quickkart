-- =============================================================
--  Hyperlocal Delivery App — Supabase Schema
--  Run this entire script once in the Supabase SQL Editor.
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- =============================================================


-- -------------------------------------------------------------
-- 0. Extensions
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- -------------------------------------------------------------
-- 1. Custom ENUMs
-- -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'customer', 'agent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'placed',
    'preparing',
    'out_for_delivery',
    'delivered'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('grocery', 'meat', 'egg', 'food');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('online', 'cod');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- -------------------------------------------------------------
-- 2. profiles  (extends auth.users 1-to-1)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID           PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      TEXT,
  email          TEXT,
  phone          TEXT,
  role           user_role      NOT NULL DEFAULT 'customer',
  saved_address  TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Automatically create a profile row whenever a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -------------------------------------------------------------
-- 3. products
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id            UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT              NOT NULL,
  category      product_category  NOT NULL,
  price         DECIMAL(10, 2)    NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  description   TEXT,
  is_available  BOOLEAN           NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Keep updated_at fresh on every UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- -------------------------------------------------------------
-- 4. orders
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id       UUID            NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agent_id          UUID            REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_price       DECIMAL(10, 2)  NOT NULL CHECK (total_price >= 0),
  payment_method    payment_method  NOT NULL,
  status            order_status    NOT NULL DEFAULT 'placed',
  delivery_address  TEXT            NOT NULL,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_agent_id    ON public.orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON public.orders(status);


-- -------------------------------------------------------------
-- 5. order_items
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id           UUID           NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id         UUID           NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity           INT            NOT NULL CHECK (quantity > 0),
  price_at_purchase  DECIMAL(10, 2) NOT NULL CHECK (price_at_purchase >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id   ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);


-- =============================================================
-- Table-level GRANTS
-- =============================================================
-- Tables created via raw SQL do NOT auto-grant privileges to the
-- `authenticated` / `anon` roles (unlike dashboard-created tables).
-- RLS policies only work AFTER these grants are in place.

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, UPDATE                 ON public.profiles    TO authenticated;
GRANT SELECT                         ON public.products    TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE         ON public.products    TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.orders      TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.order_items TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =============================================================
-- Row-Level Security (RLS)
-- =============================================================

-- ── SECURITY DEFINER helper: avoids recursion in profiles policies ──
-- This function runs with owner privileges, bypassing RLS, so it
-- can safely be called from policies on profiles itself.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE  ALL  ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;


-- profiles ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- products ---
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products"        ON public.products;

CREATE POLICY "Anyone can view available products"
  ON public.products FOR SELECT
  USING (is_available = TRUE);

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (public.is_admin());

-- orders ---
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view own orders"     ON public.orders;
DROP POLICY IF EXISTS "Customers can place orders"        ON public.orders;
DROP POLICY IF EXISTS "Agents can view assigned orders"   ON public.orders;
DROP POLICY IF EXISTS "Agents can update assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders"      ON public.orders;

CREATE POLICY "Customers can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = customer_id);

CREATE POLICY "Customers can place orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Agents can view assigned orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = agent_id);

CREATE POLICY "Agents can update assigned orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = agent_id);

CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

-- order_items ---
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order items visible to order owner"  ON public.order_items;
DROP POLICY IF EXISTS "Order items visible to order agent"  ON public.order_items;
DROP POLICY IF EXISTS "Admins can manage all order items"   ON public.order_items;
DROP POLICY IF EXISTS "Customers can insert own order items" ON public.order_items;

CREATE POLICY "Order items visible to order owner"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "Order items visible to order agent"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.agent_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all order items"
  ON public.order_items FOR ALL
  USING (public.is_admin());


-- =============================================================
-- Seed: one admin placeholder (replace values before running)
-- =============================================================
-- INSERT INTO auth.users ...  <-- handled by Supabase Auth UI / API
-- After creating the auth user, promote them to admin:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE email = 'admin@yourdomain.com';
--
-- =============================================================
