-- =============================================================
--  Migration 024 — Product variants (sizes / weights / packs)
--  ──────────────────────────────────────────────────────────────
--  One product can have many variants (500g / 1kg / 5kg, Small / Large).
--  Each variant has its own label + price. If the variants array is
--  empty, the product is a single-SKU as before.
--
--  Stored as JSONB to avoid a separate table — variants don't have FKs
--  pointing in, only the order_items.variant_label snapshot.
--
--  Variant shape inside the JSON array:
--    { id: "uuid", label: "1 kg", price: 95.00, is_available: true, sort_order: 0 }
--
--  Idempotent.
-- =============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id    TEXT,
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

COMMENT ON COLUMN public.products.variants IS
  'Optional array of {id, label, price, is_available, sort_order}. Empty = single SKU.';

COMMENT ON COLUMN public.order_items.variant_label IS
  'Snapshot of variant label at purchase time. NULL for single-SKU products.';

-- =============================================================
-- Verify:
--   SELECT name, jsonb_array_length(variants) AS variant_count
--   FROM   public.products LIMIT 5;
-- =============================================================
