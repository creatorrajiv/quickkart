# QuickKart — Developer Handover

**Prepared:** 2026-10-15 · **Owner:** creatorrajiv (info@prabhabi.com)
**Status:** Paused since 2026-06-28. Being handed to a new developer.

QuickKart is a hyperlocal grocery/essentials delivery platform with four roles (customer, shopkeeper, delivery agent, and admin), all served from one React SPA/PWA backed by Supabase.

---

## 1. Where everything lives

| Thing | Location |
|---|---|
| Source code | GitHub: https://github.com/creatorrajiv/quickkart (branch `main`) |
| Local copy (owner's PC) | `C:\Users\itsra\Desktop\hyperlocal-delivery-app` |
| Backend | Supabase project `wdjsckjpoqigupaqjcmu` (https://wdjsckjpoqigupaqjcmu.supabase.co) |
| Frontend hosting | Vercel (`vercel.json` holds the SPA rewrites and security headers) |
| Deploy guide | [DEPLOY.md](DEPLOY.md), the full Vercel/Supabase setup walkthrough |

### Access the owner must grant (this cannot be done from the code)
- [ ] **GitHub:** add the developer as a collaborator on `creatorrajiv/quickkart`.
- [ ] **Supabase:** Dashboard → Organization → Members → invite (Developer role is enough).
- [ ] **Vercel:** add them to the team/project, or transfer the project.
- [ ] **Secrets:** share these privately (password manager, not chat or email):
  - `.env` values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_BUSINESS_NUMBER`, `VITE_VAPID_PUBLIC_KEY`
  - Edge Function secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` (`SUPABASE_*` are injected automatically)
  - At least one admin login for the live app
- [ ] After handover, rotate the Supabase service-role key and any shared passwords if access is ever revoked.

`.env` is git-ignored. [.env.example](.env.example) lists every variable and explains each one.

---

## 2. Tech stack

- **Frontend:** React 18 + Vite 5 + Tailwind 3, react-router-dom 6, `sonner` toasts, `lucide-react` icons. JavaScript only (no TypeScript).
- **i18n:** English and Hindi in `src/i18n/translations.js`.
- **Backend:** Supabase (Postgres, Auth, RLS, RPC functions, Realtime, Storage, Edge Functions).
- **Push:** Web Push using VAPID keys (`src/lib/push.js` and the `send-push` Edge Function).
- **Mobile:** Capacitor scripts exist (`cap:add:android`, `cap:sync`), but no `android/` folder has been generated yet.
- **Tests:** none. There is no test suite or CI.

## 3. Running it locally

```bash
npm install
```
```bash
npm run dev
```
Copy `.env.example` to `.env` first and fill it in. `npm run build` outputs to `dist/`.

## 4. Code map

```
src/
  App.jsx            all routes; "/" is role-aware via <RoleRouter/>
  pages/customer     Home, Cart, Orders, OrderDetail, Wishlist, Subscriptions
  pages/shopkeeper   Dashboard, Inventory, ShopProfile
  pages/agent        ActiveOrders, OrderHistory
  pages/admin        Dashboard, Orders, Products, Shops, Agents, Shopkeepers,
                     Banners, Categories, Coupons, Reviews, AppSettings
                     (+ AuditLog, Payouts: unfinished, see §6)
  pages/auth         Login, Register, ForgotPassword, ResetPassword
  services/*.js      one file per domain; all Supabase calls go through these
  context/           Auth, Cart, Wishlist, AppSettings providers
  lib/               supabaseClient, push, geolocation, whatsapp, csv, sound, notify
  config/            business.js (fees, rules), orderStatus.js (status machine)
  ui/                shared Button/Card/Modal/Input/Badge/Skeleton
supabase/
  migrations/001–030 run in numeric order; written to be idempotent
  functions/         admin-create-user, send-push (Deno Edge Functions)
```

Each page enforces its own role guard (`useAuthGuard`). The real security boundary is **RLS in the migrations**, so never rely on the UI guard alone.

## 5. Features built (commit history)

- **Tier 1:** marketplace foundation, shop assignment RPC, agent KYC, notifications, addresses, cancellation, reviews, banners, live agent location, push.
- **Tier 2:** reorder, search history, ETA, GPS address autofill, coupons, Hindi i18n, multi-image gallery.
- **Tier 3:** smarter shop allocator (020/021), 10 seeded dummy shops (018), wishlist, delivery slots, WhatsApp chat, loyalty points and referrals, product variants, subscriptions (recurring orders).
- **Tier 4 (partial):** review moderation, forgot/reset password, admin-editable app name and logo (028/029, with the logo stored as base64), fix for an order-placement crash (030).

## 6. ⚠️ Unfinished work (start here)

**Uncommitted files on the owner's PC.** These are not on GitHub yet, so the owner must commit and push them before handover:
- `supabase/migrations/027_refunds_audit_payouts.sql` adds refund columns on `orders`, `admin_audit_log`, `shop_payouts`, `agent_payouts`, and the RPCs `refund_order()` and `admin_payouts_summary()`.
- `src/services/refundsService.js`, `auditLogService.js`, `payoutsService.js`
- `src/pages/admin/AuditLogPage.jsx`, `PayoutsPage.jsx`
- `src/pages/admin/OrdersPage.jsx` (modified) adds a "💸 Refund" button on cancelled and delivered orders.

**To finish Tier 4:**
1. Check whether migration **027** has been applied to the live Supabase project. Migrations 028–030 were committed after it, so 027 may have been skipped. Until 027 is applied, the Refund button will fail.
2. Register `/admin/audit-log` and `/admin/payouts` in `src/App.jsx` and add them to the admin nav. They are **not routed** today.
3. Swap the `window.prompt` refund UI for a proper modal.
4. Remaining scope: customer-initiated refund requests, audit-log writes from every admin action, and payout reconciliation.

**Tier 5 ideas (not started):** multi-city/zone management, shopkeeper analytics, agent earnings dashboard, promo engine.

## 7. Known gotchas

- **Migration 013 was accidentally overwritten with the single character `x`** in the working copy. It was restored from git on 2026-10-15 and should be left alone.
- Migrations are only ever run by hand (SQL editor or `supabase db push`). Nothing records which ones have been applied to production, so check the schema before running any.
- `018_seed_dummy_shops.sql` inserts fake shops. Remove those rows before going live with real shops.
- The logo upload stores base64 in `app_settings` instead of Storage. That was deliberate (Storage uploads were failing), but keep logos small.
- Edge Function `admin-create-user` is deployed with `--no-verify-jwt` and checks the admin role itself. Keep that check if you edit it.
- `grep.exe.stackdump` in the repo root is junk and can be deleted.
