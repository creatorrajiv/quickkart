-- =============================================================
--  Migration 014 — Auto-dispatch web push when notification fires
--  ──────────────────────────────────────────────────────────────
--  When a row lands in public.notifications, this trigger calls
--  the send-push Edge Function via pg_net so the user gets an OS-
--  level push (in addition to the in-app bell + toast that the
--  existing realtime subscription already handles).
--
--  Pre-requisites set in Supabase project:
--    1. The send-push Edge Function is deployed and has VAPID secrets
--    2. The user has subscribed at least one device (push_subscriptions)
--
--  Configuration: this trigger reads the project URL and service-role
--  key from app.settings — values that Supabase sets automatically on
--  every project. No additional env wiring is needed.
--
--  Idempotent.
-- =============================================================

-- pg_net is Supabase's HTTP client extension. Already enabled on most
-- Supabase projects; CREATE EXTENSION ... IF NOT EXISTS is safe.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_project_url   TEXT;
  v_service_key   TEXT;
  v_url           TEXT;
  v_payload       JSONB;
  v_click_url     TEXT;
BEGIN
  -- Supabase populates these settings on every project automatically.
  -- If absent (running locally without Studio), we silently skip — the
  -- in-app notification still works because it lives in the same row.
  BEGIN
    v_project_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_project_url := NULL; v_service_key := NULL;
  END;

  IF v_project_url IS NULL OR v_service_key IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := v_project_url || '/functions/v1/send-push';

  -- Pick a sensible click destination based on type.
  v_click_url := CASE
    WHEN NEW.order_id IS NOT NULL THEN
      CASE NEW.type
        WHEN 'shop_new_order'        THEN '/shopkeeper/dashboard'
        WHEN 'agent_new_assignment'  THEN '/agent/active-orders'
        ELSE                              '/orders/' || NEW.order_id::text
      END
    ELSE '/'
  END;

  v_payload := jsonb_build_object(
    'user_id', NEW.user_id,
    'title',   NEW.title,
    'body',    NEW.body,
    'url',     v_click_url,
    'tag',     NEW.id::text
  );

  -- Fire and forget. pg_net.http_post is async — failures don't roll back
  -- the notification insert.
  PERFORM extensions.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    body    := v_payload
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_push ON public.notifications;
CREATE TRIGGER trg_dispatch_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_push_for_notification();

-- =============================================================
-- Verification:
--   • Insert a notification row → check supabase functions logs for send-push
--   • If push doesn't fire, confirm:
--     SELECT current_setting('app.settings.supabase_url',    true);
--     SELECT current_setting('app.settings.service_role_key', true);
-- =============================================================
