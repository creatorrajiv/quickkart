# 🚀 QuickKart — Deployment Guide

This is a complete guide to take your QuickKart project from local development to a live, production-ready deployment.

---

## 📦 Architecture overview

QuickKart is a JAMstack app:

```
┌─────────────────┐      ┌──────────────────────────────────┐
│  React + Vite   │ ───► │ Supabase                         │
│  (frontend)     │      │  • Postgres database             │
│  hosted on:     │      │  • Auth                          │
│  Vercel/Netlify │      │  • Realtime                      │
└─────────────────┘      │  • Storage (banners + products)  │
                         │  • Edge Functions (admin-create-user) │
                         └──────────────────────────────────┘
```

The frontend is a static SPA. Supabase is your entire backend.

---

## ✅ Pre-launch checklist

Before you point a domain at your production deployment:

- [ ] All migrations 001–011 applied in production Supabase
- [ ] Edge Function `admin-create-user` deployed (`supabase functions deploy admin-create-user --no-verify-jwt`)
- [ ] At least one admin user promoted (`UPDATE profiles SET role='admin' WHERE email='you@example.com'`)
- [ ] Email confirmation configured in Supabase Auth settings (turn ON for production)
- [ ] At least one shop with seeded inventory exists
- [ ] WhatsApp business number set in `.env` (`VITE_WHATSAPP_BUSINESS_NUMBER`)
- [ ] Terms / Privacy pages reviewed by a lawyer
- [ ] Sentry/PostHog wired (optional — see below)

---

## 🌐 Frontend deployment

### Option A — Vercel (Recommended)

1. Push the repo to GitHub
2. Go to https://vercel.com → **Add New Project** → import your repo
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output dir: `dist`
6. **Environment Variables** — add these from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WHATSAPP_BUSINESS_NUMBER`
7. Deploy
8. Buy a custom domain in Vercel → DNS auto-configured

### Option B — Netlify

1. Push to GitHub
2. https://netlify.com → **Add new site** → import from Git
3. Build command: `npm run build` · Publish dir: `dist`
4. Add env vars (same as above)
5. Deploy

### SPA routing — IMPORTANT

The app uses client-side routing. Without a fallback, refreshing `/orders/123` will return 404.

**Vercel** handles this automatically (it detects Vite).

**Netlify** — create `public/_redirects`:
```
/*    /index.html   200
```

---

## 🗄 Production Supabase setup

### 1. Create a new Supabase project

- Go to https://supabase.com → **New Project**
- Pick a strong DB password (save it in a vault)
- Region: pick closest to your customers (e.g. ap-south-1 for India)

### 2. Run all migrations

In SQL Editor, run them in order:

```
supabase/schema.sql                                       (initial schema)
supabase/migrations/001_marketplace_foundation.sql
supabase/migrations/002_order_rpc_shop_assignment.sql
supabase/migrations/003_agent_kyc_and_availability.sql
supabase/migrations/004_grant_service_role_profiles.sql
supabase/migrations/005_shopkeeper_order_access.sql
supabase/migrations/006_notifications.sql
supabase/migrations/007_addresses_cancellation_reviews.sql
supabase/migrations/008_banners.sql
supabase/migrations/009_customer_can_view_agent.sql
supabase/migrations/010_agent_can_view_customer.sql
supabase/migrations/011_dynamic_categories_and_product_images.sql
```

### 3. Deploy Edge Functions

Install Supabase CLI (one time):
```powershell
npm install -g supabase
```

Then in your project folder:
```powershell
supabase login
supabase link --project-ref <YOUR-PROJECT-REF>
supabase functions deploy admin-create-user --no-verify-jwt
```

### 4. Auth settings

In Supabase Dashboard → **Authentication → Providers → Email**:
- **Confirm email**: ON for production (recommended)
- Add your production domain to **Site URL** and **Redirect URLs**

### 5. Storage CORS

The `banners` and `products` buckets are created as public — no CORS config needed for read. Uploads work via authenticated API calls.

---

## 🔐 Environment variables

Create a `.env` file (never commit). Vite reads `VITE_*` variables.

```env
# Required
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Optional — enables the "Order on WhatsApp" button
VITE_WHATSAPP_BUSINESS_NUMBER=919876543210

# Optional — Sentry error tracking (uncomment once installed)
# VITE_SENTRY_DSN=https://xxx@sentry.io/yyy

# Optional — PostHog analytics
# VITE_POSTHOG_KEY=phc_xxx
# VITE_POSTHOG_HOST=https://app.posthog.com
```

---

## 📊 Analytics & error tracking (optional)

### Sentry

```powershell
npm install @sentry/react
```

In `src/main.jsx` (top of file):
```js
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
  window.Sentry = Sentry;  // ErrorBoundary already auto-detects window.Sentry
}
```

### PostHog

```powershell
npm install posthog-js
```

In `src/main.jsx`:
```js
import posthog from 'posthog-js';

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
  });
}
```

---

## 🔄 CI/CD

A simple GitHub Actions workflow at `.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_WHATSAPP_BUSINESS_NUMBER: ${{ secrets.VITE_WHATSAPP_BUSINESS_NUMBER }}
```

Vercel/Netlify auto-deploy on push — you don't need this if you use them.

---

## 🛡 Production hardening

1. **Rate limiting** — Supabase Auth has built-in rate limits. For your own RPCs, consider edge functions with rate limit middleware.
2. **Backups** — Supabase Pro plan includes daily backups. Free plan: set up a cron job to `pg_dump`.
3. **RLS audit** — confirm every table has `ENABLE ROW LEVEL SECURITY` and a sensible policy.
4. **Service role key** — never expose it in client code. It's only in the Edge Function.

---

## 📱 PWA / Mobile

The app already works on mobile browsers. To make it installable as a PWA:

1. Add `public/manifest.json`:
   ```json
   {
     "name": "QuickKart",
     "short_name": "QuickKart",
     "icons": [
       { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ],
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#fc4a1a"
   }
   ```
2. Link it in `index.html`: `<link rel="manifest" href="/manifest.json">`
3. Add icons in `public/icon-192.png` and `public/icon-512.png`
4. (Browser push requires a service worker — see Phase 5b in the roadmap)

---

## 🆘 Troubleshooting

| Issue | Fix |
|-------|-----|
| `Failed to fetch` from edge function | Function not deployed — `supabase functions deploy admin-create-user --no-verify-jwt` |
| Customer can't see assigned agent | Migration 009 not applied |
| Shopkeeper sees no orders | Migration 005 not applied or shop owner_id not set |
| Storage upload fails | Check that `banners`/`products` buckets exist (migrations 008 + 011) |
| Realtime not firing | Tables are in `supabase_realtime` publication (migrations 006 etc) |

---

Good luck! 🚀
