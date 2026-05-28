-- =============================================================
--  Migration 018 — Seed 10 dummy shops + their inventories
--  ──────────────────────────────────────────────────────────────
--  Creates 10 fictitious kirana shops scattered around Munger,
--  Bihar (lat 25.37°N, lng 86.47°E) for testing the auto-assign
--  allocator. Each shop gets:
--    • realistic name, address, phone
--    • opens_at / closes_at
--    • COD acceptance toggle
--    • initial rating (4.0–4.8, varied)
--  Then every product currently in the catalogue is marked
--  available at every seeded shop.
--
--  Safe to re-run — checks if the test shop names exist first.
--  To wipe seed data:
--    DELETE FROM public.shops WHERE name LIKE 'TEST_SHOP_%';
-- =============================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.shops WHERE name LIKE 'TEST_SHOP_%';
  IF v_count > 0 THEN
    RAISE NOTICE 'Test shops already seeded (% rows). Skipping.', v_count;
    RETURN;
  END IF;

  INSERT INTO public.shops
    (name, phone, address, lat, lng, status, is_open, accepts_cod, rating, opens_at, closes_at)
  VALUES
    ('TEST_SHOP_01 Sharma Kirana',     '9876510001',
     'Shop No. 12, Lallu Pokhar Road, Munger, Bihar 811201',           25.3768, 86.4712, 'active', TRUE, TRUE,  4.5, '07:00', '22:00'),
    ('TEST_SHOP_02 Raj General Store', '9876510002',
     'Plot 4, Maharaj Pul, Munger, Bihar 811201',                      25.3782, 86.4691, 'active', TRUE, TRUE,  4.2, '06:30', '21:30'),
    ('TEST_SHOP_03 Singh Provisions',  '9876510003',
     'Topkhana Bazar, Near Old Post Office, Munger, Bihar 811201',    25.3755, 86.4734, 'active', TRUE, FALSE, 4.7, '08:00', '23:00'),
    ('TEST_SHOP_04 Bhola Bazaar',      '9876510004',
     'Kasim Bazar Chowk, Munger, Bihar 811201',                        25.3791, 86.4673, 'active', TRUE, TRUE,  4.0, '09:00', '21:00'),
    ('TEST_SHOP_05 Verma Mart',        '9876510005',
     'Belabela Main Road, Munger, Bihar 811202',                       25.3812, 86.4655, 'active', TRUE, TRUE,  4.3, '07:30', '22:30'),
    ('TEST_SHOP_06 Krishna Fresh',     '9876510006',
     'Bara Bazar, Lane 3, Munger, Bihar 811201',                       25.3745, 86.4708, 'active', TRUE, TRUE,  4.8, '06:00', '23:00'),
    ('TEST_SHOP_07 Daily Needs',       '9876510007',
     'Bhagatpur Square, Munger, Bihar 811202',                         25.3804, 86.4729, 'active', TRUE, FALSE, 3.9, '08:30', '22:00'),
    ('TEST_SHOP_08 Anand Stores',      '9876510008',
     'Naya Bazar, Near Bus Stand, Munger, Bihar 811201',              25.3762, 86.4688, 'active', TRUE, TRUE,  4.4, '07:00', '21:30'),
    ('TEST_SHOP_09 Fort Grocers',      '9876510009',
     'Munger Fort Road, Near Karna Chaupar, Munger, Bihar 811201',    25.3823, 86.4742, 'active', TRUE, TRUE,  4.6, '09:00', '22:00'),
    ('TEST_SHOP_10 Civil Lines Mart',  '9876510010',
     'Civil Lines, Opp. Collectorate, Munger, Bihar 811201',          25.3778, 86.4665, 'active', TRUE, TRUE,  4.1, '08:00', '00:00');

  -- Seed inventory: every active product available at every test shop.
  INSERT INTO public.shop_inventory (shop_id, product_id, available, stock_qty)
  SELECT s.id, p.id, TRUE, 100
  FROM   public.shops s
  CROSS JOIN public.products p
  WHERE  s.name LIKE 'TEST_SHOP_%'
    AND  p.is_available = TRUE
  ON CONFLICT (shop_id, product_id) DO NOTHING;

  RAISE NOTICE 'Seeded 10 test shops + their inventories.';
END
$$;

-- =============================================================
-- Verify:
--   SELECT name, rating, is_open, opens_at, closes_at FROM shops
--   WHERE name LIKE 'TEST_SHOP_%' ORDER BY name;
--
--   SELECT s.name, COUNT(si.product_id) AS products_stocked
--   FROM   shops s
--   JOIN   shop_inventory si ON si.shop_id = s.id
--   WHERE  s.name LIKE 'TEST_SHOP_%'
--   GROUP BY s.name;
--
-- Test allocator:
--   SELECT public.pick_shop_for_order(
--     ARRAY(SELECT id FROM public.products WHERE is_available = TRUE LIMIT 3)
--   );
-- =============================================================
