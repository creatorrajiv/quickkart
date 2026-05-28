-- =============================================================
--  Migration 006 — In-App Notifications
--  ──────────────────────────────────────────────────────────────
--  Adds a generic notifications table fed by DB triggers so every
--  relevant user (customer, shopkeeper, agent) gets a bell-icon
--  notification when an order changes state.
--
--  Why DB-level triggers (not client-side fan-out):
--    • Single source of truth — even if a status is changed via SQL
--      console or a future admin tool, the notification still fires.
--    • Atomic with the order update — no risk of a "status changed"
--      bell pinging while the order_items insert rolled back.
--    • Realtime channels stream INSERTs to subscribers for free.
--
--  Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1. notifications table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- type buckets help the UI pick an icon and group items
  type        TEXT         NOT NULL CHECK (type IN (
    'order_placed',         -- customer's own order accepted
    'order_status',         -- order moved to a new status
    'shop_new_order',       -- shopkeeper: a new order landed
    'agent_new_assignment', -- agent: you got assigned a delivery
    'system'                -- generic catch-all
  )),
  title       TEXT         NOT NULL,
  body        TEXT,
  -- denormalised so the bell can link without a join
  order_id    UUID         REFERENCES public.orders(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Most queries are "give me my unread, newest first" — this index covers it.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);


-- -------------------------------------------------------------
-- 2. Grants + RLS
-- -------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;

-- Users can only see/modify their own row.
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT happens from the trigger as SECURITY DEFINER — clients shouldn't
-- write notifications directly, so no INSERT policy is added.


-- -------------------------------------------------------------
-- 3. Trigger: emit notifications when an order is created or its
--    status changes.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_owner_id UUID;
  v_short_id      TEXT;
  v_status_label  TEXT;
BEGIN
  v_short_id := substr(NEW.id::text, 1, 8);

  -- ── INSERT: order was just placed ─────────────────────────────
  IF TG_OP = 'INSERT' THEN
    -- Customer: "your order is placed"
    INSERT INTO public.notifications (user_id, type, title, body, order_id)
    VALUES (
      NEW.customer_id,
      'order_placed',
      'Order placed',
      'Your order #' || v_short_id || ' has been received.',
      NEW.id
    );

    -- Shopkeeper: "new order"
    IF NEW.shop_id IS NOT NULL THEN
      SELECT owner_id INTO v_shop_owner_id FROM public.shops WHERE id = NEW.shop_id;
      IF v_shop_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, order_id)
        VALUES (
          v_shop_owner_id,
          'shop_new_order',
          'New order received',
          'Order #' || v_short_id || ' was assigned to your shop.',
          NEW.id
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- ── UPDATE: status flip or new agent assignment ───────────────
  IF TG_OP = 'UPDATE' THEN
    -- Status changed
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_status_label := CASE NEW.status
        WHEN 'placed'           THEN 'placed'
        WHEN 'preparing'        THEN 'being prepared'
        WHEN 'out_for_delivery' THEN 'out for delivery'
        WHEN 'delivered'        THEN 'delivered'
        ELSE NEW.status::text
      END;

      -- Customer always cares about every status change
      INSERT INTO public.notifications (user_id, type, title, body, order_id)
      VALUES (
        NEW.customer_id,
        'order_status',
        'Order ' || v_status_label,
        'Your order #' || v_short_id || ' is now ' || v_status_label || '.',
        NEW.id
      );

      -- Agent: notify on transitions that matter to them
      IF NEW.agent_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, order_id)
        VALUES (
          NEW.agent_id,
          'order_status',
          'Order ' || v_status_label,
          'Order #' || v_short_id || ' is now ' || v_status_label || '.',
          NEW.id
        );
      END IF;
    END IF;

    -- Agent newly assigned (or reassigned)
    IF NEW.agent_id IS DISTINCT FROM OLD.agent_id AND NEW.agent_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, order_id)
      VALUES (
        NEW.agent_id,
        'agent_new_assignment',
        'New delivery assigned',
        'You have been assigned order #' || v_short_id || '.',
        NEW.id
      );
    END IF;

    -- Shop newly assigned (manual mode override or first-time assignment)
    IF NEW.shop_id IS DISTINCT FROM OLD.shop_id AND NEW.shop_id IS NOT NULL THEN
      SELECT owner_id INTO v_shop_owner_id FROM public.shops WHERE id = NEW.shop_id;
      IF v_shop_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, order_id)
        VALUES (
          v_shop_owner_id,
          'shop_new_order',
          'New order received',
          'Order #' || v_short_id || ' was assigned to your shop.',
          NEW.id
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emit_order_notifications ON public.orders;
CREATE TRIGGER trg_emit_order_notifications
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_order_notifications();


-- -------------------------------------------------------------
-- 4. Realtime publication
-- -------------------------------------------------------------
-- Add notifications to the realtime publication so the bell can
-- subscribe to INSERTs scoped to user_id. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;


-- =============================================================
-- Verification:
--   SELECT polname FROM pg_policy
--   WHERE polrelid='public.notifications'::regclass;
--   SELECT tgname FROM pg_trigger WHERE tgrelid='public.orders'::regclass;
-- =============================================================
