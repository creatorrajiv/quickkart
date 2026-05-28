-- =============================================================
--  Migration 008 — Promo Banners
--  ──────────────────────────────────────────────────────────────
--  A simple table + storage bucket so admin can upload hero
--  banners that show in the customer storefront carousel.
--
--  Idempotent.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.banners (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT         NOT NULL,
  subtitle     TEXT,
  image_url    TEXT         NOT NULL,            -- public URL from Supabase storage
  link_url     TEXT,                             -- optional click destination
  -- 'storefront' shows on customer home; future surfaces can be added
  surface      TEXT         NOT NULL DEFAULT 'storefront'
               CHECK (surface IN ('storefront')),
  display_order INT         NOT NULL DEFAULT 0,
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active
  ON public.banners(surface, display_order) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_banners_updated_at ON public.banners;
CREATE TRIGGER trg_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT SELECT                         ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO service_role;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
DROP POLICY IF EXISTS "Admins manage banners"           ON public.banners;

CREATE POLICY "Anyone can view active banners"
  ON public.banners FOR SELECT
  USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at   IS NULL OR ends_at   >= NOW())
  );

CREATE POLICY "Admins manage banners"
  ON public.banners FOR ALL
  USING (public.is_admin());

-- -------------------------------------------------------------
-- Storage bucket: 'banners'
-- -------------------------------------------------------------
-- Public read so customers can <img src="...banners/xyz.jpg">.
-- Inserts/updates allowed only via admin (enforced below).
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Public can read
DROP POLICY IF EXISTS "Public can read banner images" ON storage.objects;
CREATE POLICY "Public can read banner images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

-- Admins can upload / update / delete
DROP POLICY IF EXISTS "Admins manage banner images" ON storage.objects;
CREATE POLICY "Admins manage banner images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'banners' AND public.is_admin())
  WITH CHECK (bucket_id = 'banners' AND public.is_admin());

-- =============================================================
-- Verification:
--   SELECT * FROM public.banners;
--   SELECT id, name, public FROM storage.buckets WHERE id='banners';
-- =============================================================
