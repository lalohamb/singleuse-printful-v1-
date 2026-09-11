# Body & Sleeves — Operations Runbook

> Day-to-day operational procedures for the admin panel and production server.

---

## Table of Contents

1. [Stripe Mode Switching](#1-stripe-mode-switching)
2. [Shipping Profiles — Printify Sync](#2-shipping-profiles--printify-sync)
3. [Orders — Status & Printify Sync](#3-orders--status--printify-sync)
4. [Deploying to Production (Droplet)](#4-deploying-to-production-droplet)
5. [Environment Files](#5-environment-files)

---

## 1. Stripe Mode Switching

### What "mode" means
- **LIVE** — real cards, real money. `STRIPE_SECRET_KEY` starts with `sk_live_`.
- **TEST / Sandbox** — fake cards, no real money. `STRIPE_SECRET_KEY` starts with `sk_test_`.

The current mode is shown on the **Admin Dashboard** (top badge) and on the **Stripe admin page** (banner).

---

### Switching via the Admin Panel (recommended)

1. Go to `/admin/stripe`
2. The banner at the top shows the current mode.
3. Click the banner to expand it.
4. Click **→ Switch to Test** or **→ Switch to Live**.
5. A log panel shows each step as it runs:
   - ✅ `.env.local` updated
   - ✅ Supabase secrets updated
   - ✅ Edge functions redeployed
   - ✅ pm2 restarted
6. Wait ~60–90 seconds for the edge function deploy to complete.
7. The dashboard badge updates automatically after pm2 restarts.

> The button handles everything in one click — no SSH required.

---

### Switching via Terminal (local dev)

```bash
# Switch to test/sandbox
./switch-to-test.sh

# Switch back to live
./switch-to-live.sh
```

Then restart your local dev server (`npm run dev`).

---

### What gets updated on a mode switch

| Step | What changes |
|---|---|
| `.env.local` | `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` swapped |
| Supabase secrets | Same two keys pushed to edge function environment |
| Edge functions | `stripe-webhook` and `stripe-checkout` redeployed with new secrets |
| pm2 | `bodyandsleeves` process restarted so Next.js picks up new `.env.local` |

> All other env vars (Supabase, Printify, Resend, MailerLite) are untouched.

---

### Stripe keys reference

| Mode | Key prefix | Webhook secret |
|---|---|---|
| Live | `sk_live_51UCAn7...` | `whsec_08V5JvZ6...` |
| Test | `sk_test_51UCAnK...` | `whsec_j0pXblTz...` |

Webhook endpoint (both modes): `https://SUPABASE_PROJECT_REF_REDACTED.supabase.co/functions/v1/stripe-webhook`

---

### Stripe webhook events to enable
- `checkout.session.completed`
- `payment_intent.payment_failed`

---

## 2. Shipping Profiles — Printify Sync

### How shipping works
During a product sync, the shipping rate profile for each product's **blueprint + print provider** combination is fetched from Printify's catalog API and stored in the `shipping_info` JSONB column on the `products` table. At checkout, rates are calculated from these stored profiles — no live Printify API call is needed.

### Shipping modes (visible on `/admin/shipping`)

| Mode | Meaning |
|---|---|
| 🟢 Live Printify Rates | All active products have stored profiles. Customers see real rates. |
| 🟡 Partial — Mixed Rates | Some products have profiles, others use the $6.99 fallback. |
| 🔴 Fallback Rate ($6.99) | No profiles stored. All items use the flat fallback. |

### Syncing shipping profiles

Shipping profiles are fetched **automatically during a product sync**. To update them:

1. Go to `/admin/products`
2. Click **Sync Printify**
3. Wait for the sync to complete
4. Go to `/admin/shipping` and click **Refresh** — all products should show ✅ Stored

> Profiles are cached by `blueprint_id:print_provider_id` during the sync, so products sharing the same blueprint (e.g. all Bella+Canvas tees) only make one API call instead of one per product.

### After changing rates in Printify
If you update shipping rates in your Printify dashboard, run a product sync to pull the updated profiles into the database.

### Shipping rate calculation at checkout
```
total_shipping = Σ (first_item_rate + (qty - 1) × additional_item_rate) per product
```
- Rates are looked up by customer's country code.
- If no profile exists for a product, **$6.99 flat rate** is used as fallback.
- `REST_OF_THE_WORLD` profile is used for countries not explicitly listed.

---

## 3. Orders — Status & Printify Sync

### Order status sources

| Field | Owned by | Set by |
|---|---|---|
| `status` | Your store | Stripe webhook (`paid`), or manual change in admin |
| `fulfillment_status` | Printify | Synced via Check Printify button |

These are **two separate fields**. Changing `status` in the admin does not push anything to Printify (except cancellation — see below).

---

### Order status values

| Status | Meaning |
|---|---|
| `pending` | Order placed, payment not confirmed |
| `paid` | Stripe webhook confirmed payment |
| `fulfilled` | In production at Printify |
| `partially-fulfilled` | Some items shipped, others still in production |
| `shipped` | All items shipped by carrier |
| `delivered` | Delivered to customer |
| `cancelled` | Order cancelled |

---

### Printify status → your store status mapping

| Printify status | Maps to | Badge label |
|---|---|---|
| `pending` | `paid` | queued for production |
| `on-hold` | `paid` | awaiting payment confirmation |
| `payment-not-received` | `pending` | payment failed |
| `in-production` | `fulfilled` | being printed |
| `fulfilled` | `fulfilled` | — |
| `partially-fulfilled` | `fulfilled` | partially shipped |
| `shipped` | `shipped` | on its way |
| `delivered` | `delivered` | delivered |
| `canceled` | `cancelled` | cancelled |

---

### Checking live Printify status

1. Open an order from `/admin/orders`
2. Scroll to the **Fulfillment** section
3. Click **Check Printify** — fetches live status from Printify API
4. Review the live status and tracking info
5. Click **Sync to Order** to write Printify's status into your DB

> Sync to Order writes directly to the DB — it does **not** call the Printify cancel API, even if the status is `cancelled`.

---

### Cancelling an order

Cancellation is the **only** status change that pushes back to Printify.

1. Open the order detail modal
2. Change the status dropdown to `Cancelled`
3. The system calls Printify's cancellation API first:
   - **Printify confirms** → DB updated to `cancelled` ✅
   - **Printify rejects** (order in production) → alert shown, DB **not** changed ❌
4. If Printify rejects, the dropdown reverts to the previous status automatically.

> Cancellation only works in Printify if the order has not yet entered production. Once printing has started, it cannot be cancelled.

---

### Real-time order updates

The orders page subscribes to Supabase Realtime on the `orders` table. New orders from Stripe webhooks appear automatically without a page refresh. A **Refresh** button is also available in the toolbar.

---

## 4. Deploying to Production (Droplet)

### Standard deployment

```bash
cd /var/www/bodyandsleeves
git pull --rebase
npm run build
pm2 restart bodyandsleeves
```

### pm2 process info

| Field | Value |
|---|---|
| Process name | `bodyandsleeves` |
| pm2 binary | `/usr/bin/pm2` |
| Mode | fork |

### Useful pm2 commands

```bash
pm2 list                        # show all processes and status
pm2 logs bodyandsleeves         # tail live logs
pm2 logs bodyandsleeves --lines 100  # last 100 log lines
pm2 restart bodyandsleeves      # restart without rebuild
pm2 stop bodyandsleeves         # stop the app
pm2 start bodyandsleeves        # start the app
```

### Supabase edge functions

Edge functions are deployed from your local machine (or via the admin Switch Mode button). They are **not** part of the git repo or the droplet build.

```bash
# Deploy all edge functions manually
npx supabase functions deploy printify-proxy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED
```

---

## 5. Environment Files

### Files

| File | Purpose |
|---|---|
| `.env.local` | **Active config** — what Next.js reads. Never commit. |
| `.env.live` | Saved live Stripe keys. Copy to `.env.local` to go live. |
| `.env.test` | Saved test Stripe keys. Copy to `.env.local` for sandbox. |

All three are gitignored.

### Switching locally

```bash
cp .env.live .env.local   # go live
cp .env.test .env.local   # go to sandbox
# restart dev server
```

### Key variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_` or `sk_test_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_`) |
| `PRINTIFY_API_TOKEN` | Printify API token |
| `NEXT_PUBLIC_PRINTIFY_SHOP_ID` | Printify shop ID (`27284348`) |
| `RESEND_API_KEY` | Resend transactional email key |
| `MAILER_LITE_API_KEY` | MailerLite email marketing key |

### Supabase project reference
- **Project ref:** `SUPABASE_PROJECT_REF_REDACTED`
- **Printify shop ID:** `27284348`

---

*Last updated: Body & Sleeves Operations Runbook*
