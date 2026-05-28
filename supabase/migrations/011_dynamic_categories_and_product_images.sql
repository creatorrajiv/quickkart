-- =============================================================
--  Migration 011 — Dynamic categories + product images storage
--  ──────────────────────────────────────────────────────────────
--  Replaces the fixed product_category enum with a flexible
--  product_categories table so admins can add/edit/delete
--  categories freely.
--
--  Strategy:
--    1. Create product_categories table
--    2. Seed it with the 4 existing enum values
--    3. Add products.category_id (FK → product_categories.id)
--    4. Back-fill products.category_id from the existing enum
--    5. Keep the old products.category enum column (legacy) for
--       backward compat — flagged for removal later
--    6. Add products.image_path so we can delete the storage file
--       on product deletion
--    7. Create 'products' storage bucket (public read, admin write)
--
--  Idempotent. Safe to re-run.
-- =============================================================

-- 1. Categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT         NOT NULL UNIQUE,
  slug         TEXT         NOT NULL UNIQUE,
  icon         TEXT,                                  -- emoji or short text icon
  description  TEXT,
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_categories_active
  ON public.product_categories(sort_order) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_product_categories_updated_at ON public.product_categories;
CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT                         ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins manage categories"          ON public.product_categories;

CREATE POLICY "Anyone can view active categories"
  ON public.product_categories FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins manage categories"
  ON public.product_categories FOR ALL
  USING (public.is_admin());


-- 2. Seed legacy enum values into the table (idempotent)
INSERT INTO public.product_categories (name, slug, icon, sort_order)
VALUES
  ('Grocery', 'grocery', '🥦', 10),
  ('Meat',    'meat',    '🥩', 20),
  ('Eggs',    'egg',     '🥚', 30),
  ('Food',    'food',    '🍱', 40)
ON CONFLICT (slug) DO NOTHING;


-- 3. Add FK column to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id  UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS image_path   TEXT;

CREATE INDEX IF NOT EXISTS idx_products_category_id  ON public.products(category_id);


-- 4. Back-fill category_id from existing enum value (slug-matched)
-- One pass: each product's enum string matches a seeded category slug.
UPDATE public.products p
SET    category_id = pc.id
FROM   public.product_categories pc
WHERE  p.category_id IS NULL
  AND  pc.slug = p.category::text;


-- 5. We keep the legacy `category` enum column around so old code
--    doesn't break mid-deploy. New code reads category_id + joins.
--    A future migration can drop it once nothing reads it anymore.


-- 6. Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Admins manage product images" ON storage.objects;
CREATE POLICY "Admins manage product images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'products' AND public.is_admin())
  WITH CHECK (bucket_id = 'products' AND public.is_admin());


-- =============================================================
-- Verification:
--   SELECT name, slug, sort_order FROM public.product_categories ORDER BY sort_order;
--   SELECT id, name, category_id FROM public.products LIMIT 5;
--   SELECT id FROM storage.buckets WHERE id = 'products';
-- =============================================================
