# Body & Sleeves — Fresh Install Guide

---

## Overview --

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (standalone output) |
| Database / Auth | Supabase (PostgreSQL + RLS + Edge Functions) |
| Process manager | PM2 |
| Reverse proxy | Nginx + Let's Encrypt (HTTPS) |
| Payments | Stripe |
| Print fulfillment | Printify |
| Transactional email | Resend |
| Newsletter | MailerLite |

---

## 1. Prerequisites

- DigitalOcean Droplet (Ubuntu 22.04, 2 GB RAM minimum)
- Domain pointed to the droplet IP (A record)
- Supabase project created at [supabase.com](https://supabase.com)
- Stripe account at [stripe.com](https://stripe.com)
- Printify account + shop created at [printify.com](https://printify.com)
- Resend account + verified domain at [resend.com](https://resend.com)
- MailerLite account at [mailerlite.com](https://mailerlite.com)

---

## 2. Server Setup (run once on fresh droplet)

```bash
# SSH into droplet
ssh root@YOUR_SERVER_IP

# Run the setup script (installs Node 22, PM2, Nginx, Certbot, clones repo)
DOMAIN=bodyandsleeves.com REPO=git@github.com:YOUR_ORG/YOUR_REPO.git bash scripts/setup-droplet.sh
```

The script sets up:
- Node.js 22 + npm
- PM2 (process manager, auto-starts on reboot)
- Nginx (reverse proxy port 80/443 → 3000)
- Let's Encrypt SSL via Certbot
- App directory at `/var/www/bodyandsleeves`

---

## 3. Environment Files

Three files live at `/var/www/bodyandsleeves/` and are **never committed to git**.

### `.env.local` — main file loaded by Next.js at runtime

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_...        # Personal access token — needed for Stripe mode switch to push secrets to Supabase Edge Functions

# Printify
PRINTIFY_API_TOKEN=eyJ...
PRINTIFY_SHOP_ID=12345678
NEXT_PUBLIC_PRINTIFY_SHOP_ID=12345678

# Stripe (active keys — gets swapped by the Stripe mode switch in admin)
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... depending on active mode
STRIPE_WEBHOOK_SECRET=whsec_...

# Email
RESEND_API_KEY=re_...
MAILER_LITE_API_KEY=eyJ...

# Server
APP_ROOT=/var/www/bodyandsleeves
```

### `.env.live` — Stripe live keys only

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### `.env.test` — Stripe test keys only

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

> The admin panel → Stripe page reads/writes `.env.live` and `.env.test`.
> Switching modes patches `.env.local` and restarts PM2 with `--update-env`.

---

## 4. Where to Get Each Key

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role secret |
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `PRINTIFY_API_TOKEN` | Printify → My Profile → Connections → API Access |
| `PRINTIFY_SHOP_ID` | Printify dashboard URL: `printify.com/app/shop/XXXXXXXX/...` |
| `STRIPE_SECRET_KEY` (live) | Stripe → Developers → API keys → Secret key |
| `STRIPE_SECRET_KEY` (test) | Stripe → Developers → API keys → toggle Test mode |
| `STRIPE_WEBHOOK_SECRET` | Generated automatically by admin panel → Settings → Stripe |
| `RESEND_API_KEY` | Resend → API Keys → Create API Key |
| `MAILER_LITE_API_KEY` | MailerLite → Integrations → API → Generate new token |

---

## 5. Supabase Setup

### 5a. Run the database schema

Open Supabase → SQL Editor and run:

```
supabase/fresh_install.sql
```

This creates all tables, RLS policies, indexes, and seeds default data.

### 5b. Deploy Edge Functions

```bash
# From your local machine with Supabase CLI installed
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase functions deploy printify-proxy
supabase functions deploy printify-webhook
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

### 5c. Set Edge Function secrets

```bash
supabase secrets set \
  PRINTIFY_API_TOKEN=eyJ... \
  PRINTIFY_SHOP_ID=12345678 \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  RESEND_API_KEY=re_... \
  --project-ref YOUR_PROJECT_REF
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase — do not set them manually.

### 5d. Register webhooks

**Stripe webhook** — in Stripe dashboard → Developers → Webhooks → Add endpoint:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```
Events: `checkout.session.completed`, `payment_intent.payment_failed`

**Printify webhook** — in Printify dashboard → My Profile → Connections → Webhooks:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/printify-webhook
```

**Resend webhook** (for delivery events) — in Resend dashboard → Webhooks:
```
https://bodyandsleeves.com/api/resend/webhook
```

---

## 6. First Deploy

```bash
# On the server
cd /var/www/bodyandsleeves

# Create the three env files (see Section 3)
nano .env.local
nano .env.live
nano .env.test

# Secure them
chmod 600 .env.local .env.live .env.test

# Deploy
bash scripts/deploy.sh
```

The deploy script:
1. `git pull` latest code
2. `npm install`
3. `npm run build`
4. Copies static assets + env files into `.next/standalone/`
5. Writes `ecosystem.config.js` from `.env.local`
6. Restarts PM2
7. Reloads Nginx

---

## 7. Subsequent Deploys

```bash
bash scripts/deploy.sh
```

---

## 8. Create the First Admin Account

1. Go to `https://bodyandsleeves.com/admin`
2. Sign up with your email — this creates a Supabase Auth user
3. In Supabase → SQL Editor, promote that user to admin:

```sql
INSERT INTO admins (id, email, role)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'your@email.com'),
  'your@email.com',
  'super_admin'
);
```

---

## 9. Stripe Mode Switching

The admin panel → Stripe page handles this. Under the hood:

- **Save keys** → writes to `.env.live` or `.env.test` on the server
- **Switch to Live/Test** → patches `.env.local` + pushes secrets to Supabase Edge Functions via Management API + restarts PM2

For this to work, `SUPABASE_ACCESS_TOKEN` must be set in `.env.local`.

---

## 10. Verify Everything is Working

| Check | How |
|---|---|
| Site loads | Visit `https://bodyandsleeves.com` |
| Admin panel | Visit `https://bodyandsleeves.com/admin` |
| Stripe connected | Admin → Settings → Integrations → Stripe shows Connected |
| Printify connected | Admin → Orders → sync products |
| Resend connected | Admin → Settings → Integrations → Resend shows Connected |
| MailerLite connected | Admin → Settings → Integrations → MailerLite shows Connected |
| Test checkout | Admin → Stripe → switch to Test mode → place a test order |

---

## 11. Resetting for a New Store Owner

Run **Full Reset** in Admin → Danger Zone. This wipes all orders, products, categories, and resets all settings to defaults. Admin accounts are preserved.

Or run manually in Supabase SQL Editor:
```
supabase/reset_for_new_store.sql
```
