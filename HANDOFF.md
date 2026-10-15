# QuickKart — Developer Handover

**Prepared:** 2026-10-15 · **Handed over by:** creatorrajiv (info@prabhabi.com)

QuickKart is a hyperlocal grocery/essentials delivery platform. One React web app (installable as a PWA) serves four roles: **customer, shopkeeper, delivery agent, and admin**. Supabase is the entire backend.

> **Important:** the new developer sets this up on the **company's own Supabase and Vercel accounts**. Do not use, link to, or copy data from the previous owner's personal Supabase project or Vercel project. Everything needed to rebuild the backend from zero is in this repo: the database schema, security rules, RPC functions, storage buckets, and Edge Functions.

---

## 1. Requirements (what the product does)

### Customer
- Register and log in with email and password, with forgot/reset password.
- Browse products by category, search with history, and view a multi-image gallery. Products can have variants (size, weight, pack).
- Cart with delivery fee (₹30, free above ₹499; see `src/config/business.js`), tax, and coupon codes.
- Saved addresses with GPS autofill; delivery slot selection.
- Place an order. The system auto-assigns the best nearby shop (the "allocator").
- Live order tracking: status, ETA, the agent's live location, and WhatsApp chat.
- Order history, reorder, cancel, and rate/review.
- Wishlist, loyalty points (earn and redeem), referral codes.
- Subscriptions: recurring order templates.
- In-app and browser push notifications. English and Hindi.

### Shopkeeper
- Dashboard showing incoming orders (accept/prepare), inventory management with stock and out-of-stock handling, and the shop profile.

### Delivery agent
- KYC and availability toggle, active orders with a sticky "Delivered" button and vibration alerts, live location sharing, and delivery history and earnings (₹25 per delivery by default).

### Admin
- Dashboard metrics, and management of orders, products, shops, agents, shopkeepers, banners, categories, coupons and review moderation.
- Admin users are created through the `admin-create-user` Edge Function.
- App settings: rename the app and upload a logo.
- **In progress:** refunds, audit log, payouts (see §7).

---

## 2. Tech stack

- React 18 + Vite 5 + Tailwind 3, react-router-dom 6, `sonner`, `lucide-react`. Plain JavaScript.
- Supabase: Postgres + RLS + RPC, Auth, Realtime, Storage, Edge Functions (Deno), `pg_net`.
- Web Push using VAPID keys.
- Hosting: Vercel (`vercel.json` holds the SPA rewrites and security headers).
- Capacitor scripts exist for an Android build, but the Android build has not been generated yet.
- There are no automated tests and no CI.

---

## 3. Fresh setup on company accounts (step by step)

### 3.1 Code
Get the repo from https://github.com/creatorrajiv/quickkart and move it into the company GitHub. Two ways:
- the owner **transfers** the repository to the company GitHub org (Settings → Transfer), or
- the developer creates a new company repo and pushes this code into it:

```bash
git clone https://github.com/creatorrajiv/quickkart.git
```
```bash
git remote set-url origin https://github.com/<company-org>/quickkart.git
```
```bash
git push -u origin main
```

### 3.2 Create the Supabase project (company account)
1. Go to supabase.com → New project. Choose a region close to your users (India users → Mumbai `ap-south-1`).
2. Save the **Project URL**, **anon key** and **service_role key** (Settings → API).

### 3.3 Build the database
Run **every file in `supabase/migrations/` in numeric order, 001 → 030**. Either:
- paste each file into the SQL Editor and run them one by one, or
- use the Supabase CLI:

```bash
npx supabase login
```
```bash
npx supabase link --project-ref <NEW_PROJECT_REF>
```
```bash
npx supabase db push
```

Notes:
- The files are idempotent, so re-running one is safe.
- These migrations also create the storage buckets `banners` and `products`.
- `018_seed_dummy_shops.sql` inserts **10 fake shops** for testing. Skip it, or delete those rows before going live.

### 3.4 Edge Functions and secrets
Generate VAPID keys for push notifications:

```bash
npx web-push generate-vapid-keys
```
```bash
npx supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<company-email>
```
```bash
npx supabase functions deploy admin-create-user --no-verify-jwt
```
```bash
npx supabase functions deploy send-push
```

### 3.5 Auth settings (Supabase → Authentication)
- **URL Configuration:**
  - Site URL = your production domain.
  - Redirect URLs: add `https://<domain>/reset-password` and `http://localhost:5173/reset-password`. Password reset depends on these.
- Turn email confirmation on for production, and set up custom SMTP (the built-in mailer is rate-limited).

### 3.6 First admin user
Register normally in the app, then run this in the SQL Editor:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@company.com';
```

### 3.7 Run locally
Copy `.env.example` to `.env` and fill in the new project's values, then:
```bash
npm install
```
```bash
npm run dev
```

### 3.8 Deploy on Vercel (company account)
1. Vercel → Add New Project → import the company GitHub repo. Preset **Vite**, build `npm run build`, output `dist`.
2. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_VAPID_PUBLIC_KEY`
   - `VITE_WHATSAPP_BUSINESS_NUMBER` (format `91XXXXXXXXXX`)
3. Deploy, attach the company domain, and then update the Supabase Site URL and Redirect URLs (3.5) to that domain.

[DEPLOY.md](DEPLOY.md) has more detail on optional extras (Sentry, PostHog, CI, hardening).

---

## 4. Code map

```
src/
  App.jsx            all routes; "/" redirects by role via <RoleRouter/>
  pages/customer     Home, Cart, Orders, OrderDetail, Wishlist, Subscriptions
  pages/shopkeeper   Dashboard, Inventory, ShopProfile
  pages/agent        ActiveOrders, OrderHistory
  pages/admin        Dashboard, Orders, Products, Shops, Agents, Shopkeepers,
                     Banners, Categories, Coupons, Reviews, AppSettings,
                     AuditLog*, Payouts*   (*not routed yet)
  pages/auth         Login, Register, ForgotPassword, ResetPassword
  services/*.js      one file per domain; all Supabase calls go through these
  context/           Auth, Cart, Wishlist, AppSettings providers
  lib/               supabaseClient, push, geolocation, whatsapp, csv, sound, notify
  config/            business.js (fees, tax, rules), orderStatus.js (status flow)
  i18n/              English + Hindi strings
supabase/
  migrations/        001–030, the whole schema; run in order
  functions/         admin-create-user, send-push
```

The UI does role checks (`useAuthGuard`), but **RLS in the migrations is the real security boundary**.

---

## 5. Feature history

- **Tier 1:** marketplace foundation, shop assignment, agent KYC, notifications, addresses, cancellations, reviews, banners, live agent location, push.
- **Tier 2:** reorder, search history, ETA, GPS autofill, coupons, Hindi, image gallery.
- **Tier 3:** smarter allocator, wishlist, delivery slots, WhatsApp chat, loyalty and referrals, variants, subscriptions.
- **Tier 4 (partial):** review moderation, password reset, admin-editable app name and logo, fix for an order-placement crash.

---

## 6. Known issues and gotchas

- **Automatic push from the database may not fire.** Migration 014 reads `app.settings.supabase_url` and `app.settings.service_role_key`, which hosted Supabase does **not** set automatically. If they are missing, the trigger silently skips the push (in-app notifications still work). It also calls `extensions.http_post`, while pg_net normally exposes `net.http_post`. Test push end to end on the new project and fix this, ideally by storing the URL and key in Supabase Vault.
- **Subscriptions are not automated.** Recurring orders are not generated on a schedule yet. That needs a `pg_cron` job (see the comment in 026).
- The logo is stored as base64 in `app_settings`, not in Storage. That was deliberate, but keep logos small.
- `admin-create-user` runs with `--no-verify-jwt` and checks the admin role in code. Keep that check.
- Refunds and payouts are recorded only. No payment gateway is integrated, and cash on delivery is the assumed flow.

---

## 7. Unfinished work (next tasks)

1. **Tier 4 completion:**
   - Register `/admin/audit-log` and `/admin/payouts` routes in `src/App.jsx` and add them to the admin nav.
   - Replace the `window.prompt` refund UI in admin Orders with a modal.
   - Write audit-log entries from every admin action.
   - Add customer-initiated refund requests.
   - Add payout reconciliation screens.

   The backend for this is migration 027: refund columns, `admin_audit_log`, `shop_payouts`, `agent_payouts`, `refund_order()`, `admin_payouts_summary()`.
2. Fix push dispatch (see §6) and add a pg_cron job for subscriptions.
3. Remove the seed shops and test everything with real data.
4. **Tier 5 ideas:** multi-city/zones, shopkeeper analytics, agent earnings dashboard, promo engine, online payment (Razorpay), Android app via Capacitor.
