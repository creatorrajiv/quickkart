-- =============================================================
--  Migration 016 — Multi-image products
--  ──────────────────────────────────────────────────────────────
--  Adds image_urls JSONB array (in addition to image_url which
--  remains the "primary" image). Also tracks the underlying storage
--  paths so we can delete files when a product is removed/replaced.
--
--  image_urls and image_paths are parallel arrays — element N in
--  one matches element N in the other.
--
--  Existing single image_url is back-filled into image_urls[0] so
--  old products gain a gallery of size 1 automatically.
--
--  Idempotent.
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_urls   JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS image_paths  JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill: any product that has the legacy single image but an empty
-- image_urls array gets seeded with [image_url].
UPDATE public.products
SET    image_urls = jsonb_build_array(image_url),
       image_paths = CASE WHEN image_path IS NOT NULL
                          THEN jsonb_build_array(image_path)
                          ELSE '[]'::jsonb END
WHERE  image_url IS NOT NULL
   AND (image_urls IS NULL OR image_urls = '[]'::jsonb);

-- =============================================================
-- Verification:
--   SELECT id, name, image_url, jsonb_array_length(image_urls) AS gallery_count
--   FROM public.products
--   LIMIT 5;
-- =============================================================
