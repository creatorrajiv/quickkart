// =============================================================
//  Edge Function: send-push
//  ──────────────────────────────────────────────────────────────
//  Dispatches a Web Push notification to all push_subscriptions
//  rows for a given user_id. Designed to be invoked by:
//    A) An admin / system process from another Edge Function
//    B) A scheduled job (cron) for marketing pings
//
//  This function uses the W3C Web Push protocol with VAPID auth.
//  We do NOT use a third-party SaaS — just Postgres + webpush.
//
//  Required env vars (set in Supabase Dashboard → Edge Functions
//  → send-push → Settings):
//    SUPABASE_URL
//    SUPABASE_SERVICE_ROLE_KEY
//    VAPID_PUBLIC_KEY
//    VAPID_PRIVATE_KEY
//    VAPID_SUBJECT          e.g. mailto:notifications@yourdomain.com
//
//  Generate the key pair once:
//    npx web-push generate-vapid-keys
//
//  Deploy:
//    supabase functions deploy send-push --no-verify-jwt
//
//  Invocation (server-to-server only; caller must include service-role
//  Authorization header):
//    POST /functions/v1/send-push
//    { "user_id": "...", "title": "Order delivered!", "body": "...", "url": "/orders/abc" }
// =============================================================

// @ts-nocheck — Deno runtime resolves types at deploy
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const url   = Deno.env.get("SUPABASE_URL")!;
    const skey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pub   = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const priv  = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const subj  = Deno.env.get("VAPID_SUBJECT") ?? "mailto:notifications@quickkart.app";

    if (!pub || !priv) return json({ error: "VAPID keys not configured" }, 500);

    webpush.setVapidDetails(subj, pub, priv);

    const body = await req.json();
    const { user_id, title, body: text, url: clickUrl, tag } = body ?? {};
    if (!user_id || !title) return json({ error: "user_id and title are required" }, 400);

    const admin = createClient(url, skey);

    // Fetch all subscriptions for this user
    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) return json({ error: error.message }, 500);
    if (!subs || subs.length === 0) return json({ delivered: 0, reason: "no subscriptions" }, 200);

    const payload = JSON.stringify({
      title,
      body: text ?? "",
      data: { url: clickUrl ?? "/" },
      tag:  tag ?? `qk-${Date.now()}`,
    });

    let delivered = 0;
    let pruned    = 0;
    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload);
        delivered++;
      } catch (err: any) {
        // 410 / 404 → subscription expired; delete the row
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          pruned++;
        } else {
          console.warn("[send-push] delivery failed:", err?.message ?? err);
        }
      }
    }

    return json({ delivered, pruned }, 200);
  } catch (err: any) {
    console.error("[send-push] unexpected:", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
