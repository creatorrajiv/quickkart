// =============================================================
//  Edge Function: admin-create-user
//  ──────────────────────────────────────────────────────────────
//  Lets a signed-in admin create a new auth user (agent OR
//  shopkeeper) and populate their profile row in one atomic call.
//
//  Why an Edge Function:
//    Creating users requires the Supabase SERVICE_ROLE key, which
//    must NEVER ship to the browser. The function runs on Supabase's
//    Deno runtime where the key is available as an env var.
//
//  Flow:
//    1. Client sends POST with the caller's JWT and a payload like:
//       { email, password, role, full_name, phone, vehicle_type?, vehicle_number? }
//    2. Function verifies the caller is an admin (profiles.role).
//    3. Creates the auth user via admin API (auto-confirms email).
//    4. Upserts the profile row with role + KYC fields.
//    5. Returns { user_id } or { error }.
//
//  Deploy:
//    supabase functions deploy admin-create-user --no-verify-jwt
//
//    Then in Supabase dashboard → Edge Functions → admin-create-user →
//    Settings, ensure these env vars are present (they are by default):
//      SUPABASE_URL
//      SUPABASE_SERVICE_ROLE_KEY
//      SUPABASE_ANON_KEY
//
//  NOTE: We pass --no-verify-jwt because we verify the JWT ourselves
//        below (via the user-scoped client). This lets us return clear
//        4xx errors instead of opaque 401s.
// =============================================================

// @ts-nocheck — Deno runtime, types resolve at deploy time
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_ROLES = new Set(["agent", "shopkeeper"]);
// Admin is intentionally excluded — admins are still promoted via SQL
// to prevent an admin account from being created without audit.

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // ── 1. Read env ─────────────────────────────────────────────
    const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 2. Verify caller is admin ───────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    // User-scoped client uses the caller's JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session" }, 401);

    const { data: callerProfile, error: profErr } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profErr || !callerProfile) {
      return json({ error: "Could not verify caller profile" }, 403);
    }
    if (callerProfile.role !== "admin") {
      return json({ error: "Only admins can create users" }, 403);
    }

    // ── 3. Parse + validate payload ─────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const {
      email,
      password,
      role,
      full_name = "",
      phone = "",
    } = body;

    // Normalize "" → null so CHECK constraints on optional fields pass.
    // (HTML <select> defaults to "" when no option is chosen; the DB
    //  constraint on vehicle_type allows NULL or one of the enum strings.)
    const vehicle_type   = body.vehicle_type   ? body.vehicle_type   : null;
    const vehicle_number = body.vehicle_number ? body.vehicle_number : null;

    if (!email || !password) return json({ error: "Email and password required" }, 400);
    if (!ALLOWED_ROLES.has(role)) {
      return json({ error: `Role must be one of: ${[...ALLOWED_ROLES].join(", ")}` }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // ── 4. Create the auth user (admin API, service role) ──────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,                  // skip confirmation email
      user_metadata: { full_name, phone },  // mirrored into profiles by trigger
    });

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "User creation failed" }, 400);
    }

    // ── 5. Upsert profile with role + KYC ──────────────────────
    // The handle_new_user trigger already inserted a row with role='customer'.
    // We update it to the correct role and attach KYC info.
    const profileUpdates: Record<string, unknown> = {
      role,
      full_name,
      phone,
      is_active: true,
    };
    if (role === "agent") {
      profileUpdates.vehicle_type   = vehicle_type;
      profileUpdates.vehicle_number = vehicle_number;
      profileUpdates.is_online      = false;       // start offline
    }

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update(profileUpdates)
      .eq("id", created.user.id);

    if (updateErr) {
      // Best-effort rollback: delete the auth user we just created.
      await adminClient.auth.admin.deleteUser(created.user.id);
      console.error("[admin-create-user] profile update failed:", updateErr);
      return json({
        error:   `Profile setup failed: ${updateErr.message}`,
        details: updateErr.details ?? null,
        hint:    updateErr.hint ?? null,
      }, 400);
    }

    return json({
      user_id: created.user.id,
      email:   created.user.email,
      role,
    }, 200);

  } catch (err) {
    console.error("[admin-create-user] unexpected error:", err);
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
