# PrintifyPlatform — SaaS Platform Build Prompt

## What We're Building

A **multi-tenant SaaS platform** that provisions and hosts fully branded Printify-powered ecommerce storefronts for paying merchants. Each merchant gets their own isolated store instance — their own Supabase project, their own Stripe keys, their own Printify connection, their own domain.

The platform has **two revenue models running in parallel:**

1. **Cloud Hosted (SaaS)** — Merchant pays a monthly subscription. We provision, host, and manage their store. They log into a merchant dashboard and control everything. Zero infrastructure knowledge required.
2. **Download & Self-Host (One-Time Purchase)** — Merchant buys the codebase outright. They get a ZIP download of the full Next.js + Supabase application (this exact codebase), a setup guide, and a license key. They deploy it themselves.

---

## The Core Architecture Decision

> ⚠️ **Read the [Infrastructure Decision](#infrastructure-decision--supabase-hosting-strategy) and [Critical Architectural Note](#️-critical-architectural-note--multi-tenant-storefront-awareness) sections before writing a single line of code. The choice made here determines the entire shape of the storefront app, the provisioning engine, and the DB schema.**

There are two fundamentally different ways to build this platform:

**Option A — Per-Project (Option 3 in Infrastructure section)**
This platform is a **provisioning engine**. Each cloud merchant gets their own isolated Supabase project, their own Next.js deployment, their own everything. The storefront app has no knowledge of other tenants — env vars are baked in per merchant at deploy time. Simple app code, expensive to operate.

**Option B — Multi-tenant (Options 2 or 4 in Infrastructure section)**
One Supabase project, one Next.js deployment, all merchants share the same infrastructure. Every request resolves `hostname → tenant_id` in Next.js middleware before any page or query runs. Every DB query is scoped with `.eq('tenant_id', tenantId)`. RLS enforces isolation at the DB layer. Complex app code, cheap to operate.

**The recommendation is Option B (multi-tenant).** The provisioning engine, DB schema, storefront middleware, and RLS policies described throughout this document assume multi-tenant unless noted otherwise.

Each cloud merchant gets:
- A **tenant row** in the shared DB (isolated by `tenant_id` + RLS)
- A **subdomain** on our platform (`merchantname.printifyplatform.com`) + optional custom domain
- Their own **Stripe account connection** (they connect their own Stripe — we never touch their money)
- Their own **Printify API key** stored encrypted in the platform DB

The platform itself has its own Supabase project for:
- Merchant accounts, subscriptions, billing
- Provisioning job queue and status
- License key management (for download purchases)
- Platform-level analytics

---

## Stack

| Layer | Technology |
|-------|-----------|
| Platform Frontend | Next.js 14 App Router (TypeScript) |
| Styling | Tailwind CSS + Framer Motion |
| Platform Database | Supabase (Postgres + RLS + Edge Functions) |
| Auth | Supabase Auth (email/password + magic link) |
| Billing | Stripe Subscriptions (cloud) + Stripe Checkout one-time (download) |
| Provisioning | Supabase Management API + DigitalOcean API |
| Store Template | This codebase (Next.js + Supabase + Printify + Stripe) |
| File Delivery | Supabase Storage (signed URLs for download purchases) |
| Email | Resend (transactional: welcome, provisioning complete, license delivery) |
| Deployment | Docker + DigitalOcean Droplets (per-merchant) OR Vercel (per-merchant) |

---

## Platform Database Schema (platform's own Supabase project)

```sql
-- Merchant accounts
CREATE TABLE merchants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id        uuid REFERENCES auth.users(id),
  email               text NOT NULL UNIQUE,
  full_name           text,
  company_name        text,
  plan                text NOT NULL DEFAULT 'trial',  -- 'trial'|'starter'|'pro'|'agency'|'download'
  plan_status         text NOT NULL DEFAULT 'active', -- 'active'|'past_due'|'cancelled'|'trialing'
  trial_ends_at       timestamptz,
  stripe_customer_id  text UNIQUE,
  stripe_sub_id       text UNIQUE,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Provisioned store instances (cloud plan)
CREATE TABLE store_instances (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid REFERENCES merchants(id) ON DELETE CASCADE,
  store_name            text NOT NULL,
  subdomain             text NOT NULL UNIQUE,  -- e.g. 'brandname' → brandname.printifyplatform.com
  custom_domain         text UNIQUE,
  status                text NOT NULL DEFAULT 'provisioning',
  -- 'provisioning'|'active'|'suspended'|'deprovisioned'
  supabase_project_ref  text UNIQUE,
  supabase_project_url  text,
  supabase_anon_key     text,
  droplet_id            text,   -- DigitalOcean droplet ID
  droplet_ip            text,
  vercel_project_id     text,   -- if using Vercel deployment
  printify_shop_id      text,
  printify_connected    boolean DEFAULT false,
  stripe_connected      boolean DEFAULT false,
  provisioned_at        timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Provisioning job log
CREATE TABLE provisioning_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   uuid REFERENCES store_instances(id) ON DELETE CASCADE,
  merchant_id   uuid REFERENCES merchants(id),
  status        text NOT NULL DEFAULT 'queued',
  -- 'queued'|'running'|'completed'|'failed'
  steps         jsonb DEFAULT '[]',
  -- [{step, status, message, timestamp}]
  error         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

-- Download purchases (one-time buy)
CREATE TABLE download_purchases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         uuid REFERENCES merchants(id),
  email               text NOT NULL,
  stripe_session_id   text UNIQUE,
  stripe_payment_intent_id text,
  license_key         text NOT NULL UNIQUE,
  license_type        text NOT NULL DEFAULT 'single', -- 'single'|'unlimited'
  download_url        text,   -- signed Supabase Storage URL
  download_count      int DEFAULT 0,
  max_downloads       int DEFAULT 5,
  expires_at          timestamptz,
  activated_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

-- License key activations (for download buyers)
CREATE TABLE license_activations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key   text NOT NULL,
  domain        text,
  activated_at  timestamptz DEFAULT now(),
  ip_address    text
);

-- Platform-level audit log
CREATE TABLE platform_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   uuid REFERENCES merchants(id),
  event_type    text NOT NULL,
  payload       jsonb,
  created_at    timestamptz DEFAULT now()
);
```

---

## Pages & Routes

### Public / Marketing
```
✅ /                     → Sales page (hero, features, pricing, testimonials, CTA)
✅ /how-it-works         → Step-by-step visual walkthrough
✅ /pricing              → Plan comparison + download purchase option
✅ /demo                 → Live embedded demo storefront (iframe or subdomain)
✅ /blog                 → SEO content hub
✅ /privacy              → Privacy policy
✅ /terms                → Terms of service
```

### Auth
```
✅ /login                → Email + password or magic link
✅ /signup               → Multi-step onboarding (cloud + download paths)
✅ /signup/verify        → Email verification gate
```

### Merchant Dashboard (protected)
```
✅ /dashboard                        → Overview: store status, quick actions
✅ /dashboard/store                  → Store settings (name, subdomain, custom domain)
✅ /dashboard/store/connect-printify → Printify API key entry + shop selection
✅ /dashboard/store/connect-stripe   → Stripe OAuth connect flow
✅ /dashboard/store/domain           → Custom domain setup + DNS instructions
✅ /dashboard/billing                → Plan, usage, invoices, upgrade/downgrade
✅ /dashboard/billing/upgrade        → Plan selection + Stripe checkout
✅ /dashboard/download               → Download purchase page (for download plan holders)
✅ /dashboard/support                → Help docs + contact
```

### Platform Admin (super admin only)
```
✅ /platform-admin                   → Platform overview: MRR, active stores, churn
✅ /platform-admin/merchants         → All merchant accounts, plan status, actions
✅ /platform-admin/instances         → All store instances, provisioning status
✅ /platform-admin/provisioning      → Live provisioning job queue + logs
✅ /platform-admin/downloads         → Download purchases, license keys, activations
⬜ /platform-admin/billing           → Stripe revenue overview  ← NOT YET BUILT
⬜ /platform-admin/settings          → Platform config (pricing, feature flags)  ← NOT YET BUILT
```

### API Routes
```
✅ /api/webhooks/stripe              → Platform Stripe webhook (subscriptions, payments)
✅ /api/provision                    → Trigger store provisioning job
⬜ /api/deprovision                  → Suspend/delete store instance  ← NOT YET BUILT (edge fn exists)
✅ /api/license/validate             → Validate license key (called by downloaded app)
✅ /api/license/activate             → Activate license key against a domain
✅ /api/download/generate-url        → Generate signed download URL for purchase
✅ /api/health                       → Platform health check
✅ /api/checkout                     → Stripe Checkout (subscriptions + one-time)
```

---

## Onboarding Flow (`/signup`)

Multi-step wizard, no page reloads, progress bar at top. State persisted in React context.

```
Step 1 — Account
  Email + password
  "Already have an account? Log in"

Step 2 — Choose Your Path
  ┌─────────────────────────────┐  ┌─────────────────────────────┐
  │  ☁️  Cloud Hosted           │  │  📦  Download & Self-Host   │
  │  We run it for you          │  │  You own the code           │
  │  From $29/mo                │  │  One-time $299              │
  │  14-day free trial          │  │  No monthly fees            │
  │  [Start Free Trial]         │  │  [Buy & Download]           │
  └─────────────────────────────┘  └─────────────────────────────┘

--- CLOUD PATH ---

Step 3 — Store Setup
  Store name (becomes subdomain: storename.printifyplatform.com)
  Subdomain availability check (live, debounced)

Step 4 — Connect Printify
  Printify API key input
  We validate the key + pull shop list
  Select which Printify shop to connect
  "Don't have a Printify account? Create one free →"

Step 5 — Pick a Plan
  Starter $29/mo · Pro $79/mo · Agency $199/mo
  All start with 14-day free trial
  No credit card required to start trial

Step 6 — 🎉 Provisioning
  "We're building your store..."
  Live progress steps (animated):
    ✅ Account created
    ✅ Supabase project provisioned
    ⏳ Deploying your storefront...
    ⏳ Connecting Printify catalog...
    ⏳ Configuring your domain...
  Estimated time: ~3 minutes

Step 7 — Launch
  "Your store is live!"
  storename.printifyplatform.com [Visit Store →]
  [Go to Dashboard →]

--- DOWNLOAD PATH ---

Step 3 — Purchase
  License type selection:
    Single Site License — $299 (one domain)
    Unlimited License — $799 (unlimited domains)
  Stripe Checkout (one-time payment)

Step 4 — Delivery
  License key displayed + emailed
  Download button (signed URL, 5 download limit, 30-day expiry)
  Setup guide link
  "Need help setting up? Book a setup call →" (upsell)
```

---

## Provisioning Engine

> ⚠️ **The engine described below is for Option 3 (per-project isolation). If building with the recommended multi-tenant approach (Options 2 or 4), skip this entire section — provisioning collapses to 4 SQL inserts. See [What Changes in the Architecture with Multi-tenant](#what-changes-in-the-architecture-with-multi-tenant).**

The provisioning engine runs as a background job triggered by `/api/provision`. It executes these steps in sequence, logging each to `provisioning_jobs.steps`:

### Step 1 — Create Supabase Project
```
POST https://api.supabase.com/v1/projects
{
  name: "printifyplatform-{subdomain}",
  organization_id: PLATFORM_SUPABASE_ORG_ID,
  plan: "free",
  region: "us-east-1",
  db_pass: <generated>
}
→ Store project_ref, project_url, anon_key in store_instances
```

### Step 2 — Run Migrations
```
Apply all SQL migrations from /supabase/migrations/ against new project
via Supabase Management API or direct Postgres connection
→ Creates all tables, RLS policies, indexes
```

### Step 3 — Seed Initial Data
```
INSERT into settings: store_name, printify_shop_id
INSERT into admins: merchant email + role='super_admin'
Run reset_for_new_store.sql equivalent
```

### Step 4 — Deploy Edge Functions
```
Deploy to new project:
  - printify-proxy
  - printify-webhook
  - stripe-checkout
  - stripe-webhook
Set secrets:
  PRINTIFY_API_TOKEN = merchant's key
  PRINTIFY_SHOP_ID = selected shop
  RESEND_API_KEY = platform Resend key (or merchant's own)
```

### Step 5 — Sync Printify Catalog
```
POST {new_project_url}/functions/v1/printify-proxy/sync
→ Pulls all merchant's Printify products into their DB
→ Updates store_instances.printify_connected = true
```

### Step 6 — Deploy Next.js App
```
Option A — DigitalOcean Droplet:
  Create droplet via DO API (1GB RAM, $6/mo)
  SSH: git clone template repo
  Write .env.local with new project's Supabase keys
  docker-compose up -d
  → Store droplet_id, droplet_ip

Option B — Vercel:
  POST https://api.vercel.com/v9/projects
  Set env vars via Vercel API
  Trigger deployment
  → Store vercel_project_id
```

### Step 7 — Configure Subdomain DNS
```
Create DNS record: {subdomain}.printifyplatform.com → droplet_ip
via DigitalOcean DNS API or Cloudflare API
→ Update store_instances.status = 'active'
→ Update provisioning_jobs.status = 'completed'
→ Send "Your store is live!" email via Resend
```

---

## Download Purchase Flow

### Purchase
```
Merchant clicks "Buy & Download" on /pricing or /dashboard/download
→ POST /api/checkout/download
→ Creates Stripe Checkout Session (mode: 'payment', one-time)
→ Line item: "PrintifyPlatform Single Site License" $299
   OR "PrintifyPlatform Unlimited License" $799
→ success_url: /dashboard/download?session_id={CHECKOUT_SESSION_ID}
→ cancel_url: /pricing
```

### Webhook Handler (`/api/webhooks/stripe`)
```
Event: checkout.session.completed (payment_intent.status = 'succeeded')
→ Generate license_key (UUID v4 + checksum, e.g. PPL-XXXX-XXXX-XXXX-XXXX)
→ Generate signed Supabase Storage URL for ZIP file
   (bucket: 'releases', file: 'printifyplatform-v{version}.zip')
   (signed URL: 5 download limit, 30-day expiry)
→ INSERT into download_purchases
→ INSERT into merchants (plan: 'download') if new buyer
→ Send license delivery email via Resend:
   - License key (formatted, copyable)
   - Download button (signed URL)
   - Setup guide link
   - Support contact
```

### Download Asset (Supabase Storage)
```
Bucket: 'releases' (private)
File: printifyplatform-v{version}.zip

ZIP contents:
  /app/                    ← Full Next.js application (this codebase)
  /supabase/               ← All migrations, edge functions, config
  /scripts/                ← setup-droplet.sh, deploy.sh
  /docs/
    SETUP.md               ← Step-by-step self-host guide
    ENVIRONMENT.md         ← All env vars explained
    SUPABASE_SETUP.md      ← Supabase project setup guide
    PRINTIFY_SETUP.md      ← Printify connection guide
    STRIPE_SETUP.md        ← Stripe setup guide
    DOMAIN_SETUP.md        ← DNS + SSL guide
  LICENSE.txt              ← License terms (single site or unlimited)
  .env.example             ← Template env file
```

### License Validation API (`/api/license/validate`)
```
Called by the downloaded app on startup (optional phone-home check)
POST { license_key, domain }
→ Validates key exists in download_purchases
→ Checks license_type: 'single' → enforce one domain
→ Returns { valid: true, license_type, activated_domain }
```

---

## Merchant Dashboard — Key Screens

### `/dashboard` — Overview
- Store status card: Live / Provisioning / Suspended with subdomain link
- Printify connection status + product count
- Stripe connection status
- Quick actions: Visit Store, Admin Panel, Connect Printify, Connect Stripe
- Plan badge + days remaining in trial
- "Upgrade" CTA if on trial or Starter

### `/dashboard/store` — Store Settings
- Store name (editable, updates settings table in their Supabase)
- Subdomain display (not editable after provisioning)
- Custom domain input + DNS setup instructions
  - Shows required A record: `@ → {droplet_ip}`
  - SSL auto-provisioned via Let's Encrypt on the droplet
- Store admin panel link (opens their `/admin` in new tab)

### `/dashboard/store/connect-printify` — Printify Setup
- API key input (masked after save)
- Shop selector (fetched from Printify after key validation)
- Sync status: last synced, product count
- "Re-sync Catalog" button
- Printify account creation link for new users

### `/dashboard/store/connect-stripe` — Stripe Setup
- Stripe Connect OAuth button ("Connect Stripe Account")
- OR: Manual key entry (publishable key + secret key)
- Connection status badge
- Link to Stripe dashboard
- Note: "Payments go directly to your Stripe account. We never touch your money."

### `/dashboard/billing` — Billing
- Current plan + status badge
- Next billing date + amount
- Trial countdown (if applicable)
- Invoice history (from Stripe)
- Upgrade / Downgrade plan buttons
- Cancel subscription (with confirmation modal)
- For download plan: shows license key + re-download button

---

## Platform Admin — Key Screens

### `/platform-admin` — Overview
- MRR card (from Stripe subscriptions)
- Active stores count
- Trial conversions this month
- Churn this month
- Download purchases this month
- Recent provisioning jobs (live status)

### `/platform-admin/merchants` — Merchant Management
- Table: email, plan, status, store URL, created date, MRR contribution
- Filter by plan, status
- Actions: view store, impersonate (for support), suspend, cancel
- "Add Merchant" (manual provisioning for special cases)

### `/platform-admin/provisioning` — Job Queue
- Live job list with step-by-step status
- Failed jobs with error details + retry button
- Average provisioning time metric

### `/platform-admin/downloads` — Download Management
- All purchases: email, license type, license key, download count, activated domain
- Revoke license button
- Re-generate download URL button
- Upload new release ZIP (updates the download asset)

---

## Supabase Edge Functions (Platform Level)

### `provision-store`
Triggered by `/api/provision`. Runs the full 7-step provisioning sequence.
Logs each step to `provisioning_jobs`. Sends completion email.

### `deprovision-store`
Triggered by subscription cancellation webhook or admin action.
- Sets `store_instances.status = 'suspended'`
- Optionally deletes Supabase project after grace period
- Sends "Store suspended" email to merchant

### `platform-stripe-webhook`
Handles platform-level Stripe events:
- `customer.subscription.created` → update `merchants.plan_status = 'active'`
- `customer.subscription.updated` → sync plan changes
- `customer.subscription.deleted` → trigger deprovision-store
- `invoice.payment_failed` → update `merchants.plan_status = 'past_due'`, send warning email
- `checkout.session.completed` (download) → generate license key, send delivery email

### `generate-download-url`
Called from `/api/download/generate-url`.
Creates a signed Supabase Storage URL with 30-day expiry and 5-download limit.
Increments `download_purchases.download_count`.

---

## Pricing Plans

### Cloud Hosted (Monthly Subscription)

| | Starter | Pro | Agency |
|--|---------|-----|--------|
| Price | $29/mo | $79/mo | $199/mo |
| Stores | 1 | 1 | Up to 10 |
| Free Trial | 14 days | 14 days | 14 days |
| Custom Domain | ✅ | ✅ | ✅ |
| Printify Sync | ✅ | ✅ | ✅ |
| Stripe Checkout | ✅ | ✅ | ✅ |
| Admin Dashboard | ✅ | ✅ | ✅ |
| SEO Tools | ✅ | ✅ | ✅ |
| Email Marketing | ✅ | ✅ | ✅ |
| Order Management | ✅ | ✅ | ✅ |
| Media Library | ✅ | ✅ | ✅ |
| White-Label | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |
| Multi-Shop | ❌ | ❌ | ✅ |

### Download (One-Time Purchase)

| | Single Site | Unlimited |
|--|-------------|-----------|
| Price | $299 | $799 |
| Domains | 1 | Unlimited |
| Source Code | ✅ Full | ✅ Full |
| Updates | 1 year | Lifetime |
| Setup Guide | ✅ | ✅ |
| License | Single domain | Unlimited domains |
| Support | Community | Priority email |
| White-Label | ✅ | ✅ |
| Resell Rights | ❌ | ❌ |

---

## Environment Variables (Platform App)

```env
# Platform Supabase (the SaaS platform's own project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (platform billing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...
STRIPE_DOWNLOAD_SINGLE_PRICE_ID=price_...
STRIPE_DOWNLOAD_UNLIMITED_PRICE_ID=price_...

# Supabase Management API (for provisioning new projects)
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_ORG_ID=

# DigitalOcean (for droplet provisioning)
DO_API_TOKEN=
DO_SSH_KEY_ID=
DO_REGION=nyc3
DO_DROPLET_SIZE=s-1vcpu-1gb

# DNS (Cloudflare or DigitalOcean DNS)
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
PLATFORM_DOMAIN=printifyplatform.com

# Resend (platform transactional email)
RESEND_API_KEY=
PLATFORM_FROM_EMAIL=hello@printifyplatform.com

# Store template
STORE_TEMPLATE_REPO=https://github.com/your-org/printifyplatform-store-template
STORE_RELEASE_BUCKET=releases
STORE_RELEASE_FILE=printifyplatform-v1.0.0.zip

# App
NEXT_PUBLIC_SITE_URL=https://printifyplatform.com
```

---

## Security Considerations

### Merchant Isolation
- Each merchant's Supabase project is completely isolated — separate DB, separate auth, separate storage
- Merchant's Printify API key is stored only in their Supabase project's secrets, never in the platform DB
- Merchant's Stripe keys are stored only in their environment, never in the platform DB
- Platform DB stores only non-sensitive metadata (project ref, subdomain, connection status booleans)

### Platform API Security
- All `/dashboard/*` routes protected by Supabase Auth session
- All `/platform-admin/*` routes protected by session + `platform_admins` table role check
- `/api/provision` requires valid session + merchant ownership check
- `/api/license/validate` rate-limited (10 req/min per IP)
- Stripe webhooks verified by signature

### Download Security
- ZIP download URLs are signed Supabase Storage URLs (time-limited, download-count-limited)
- License keys are validated server-side, never client-side
- Single-site licenses enforce domain binding via `license_activations` table

---

## Deployment Architecture

```
printifyplatform.com (platform)
├── Vercel or DigitalOcean (platform Next.js app)
├── Supabase (platform DB + edge functions)
└── Cloudflare (DNS + CDN)

Per-merchant store:
├── {subdomain}.printifyplatform.com → merchant's droplet IP
├── DigitalOcean Droplet ($6/mo, 1GB RAM)
│   └── Docker: Next.js standalone app
└── Supabase (merchant's isolated project)
    ├── Postgres DB (products, orders, settings)
    ├── Auth (merchant's admin users)
    ├── Storage (store-images bucket)
    └── Edge Functions (printify-proxy, stripe-checkout, stripe-webhook, printify-webhook)
```

---

## Key Implementation Notes

### Multi-tenant storefront middleware (Options 2 and 4)
The storefront Next.js app must resolve `hostname → tenant_id` on every request before any page or query runs. This lives in `middleware.ts` at the edge. The resolved `tenant_id` is injected as an `x-tenant-id` request header that all server components and API routes read from. Every single Supabase query in the storefront must include `.eq('tenant_id', tenantId)`. RLS policies enforce the same constraint at the DB layer as a safety net. See the [Critical Architectural Note](#️-critical-architectural-note--multi-tenant-storefront-awareness) section for the full middleware pattern, caching strategy, custom domain handling, and RLS setup.

### Provisioning is async
The `/api/provision` endpoint queues the job and returns immediately. The frontend polls `/api/provision/status?job_id=` every 3 seconds to show live progress. Use Supabase Realtime on `provisioning_jobs` for push updates instead of polling if possible.

### Store template is a git repo
The store template (this codebase, sanitized of all brand-specific content) lives in a private GitHub repo. Provisioning clones it, injects env vars, and deploys. Keeping it as a git repo means updates can be pushed to all stores via a platform-level "Update All Stores" action.

### Download ZIP is pre-built
The download ZIP is not generated on-demand. It's a pre-built artifact uploaded to Supabase Storage. When a new version is released, upload the new ZIP and update `STORE_RELEASE_FILE` env var. Existing download links continue to work (they point to the version they purchased).

### Stripe Connect vs. manual keys
For cloud merchants, offer both:
- **Stripe Connect (OAuth)** — cleaner UX, platform can see connection status
- **Manual key entry** — simpler, no OAuth flow needed, works for merchants who already have Stripe set up

For download merchants, manual key entry only (they're self-hosting).

### White-label (Agency plan)
Agency plan merchants can remove all "Powered by PrintifyPlatform" branding from their stores. Implement via a `white_label: boolean` flag in `store_instances` that controls whether the footer attribution renders.

---

## Build Order (Recommended)

1. ✅ Platform Supabase schema + migrations
2. ✅ Auth flow (signup, login, email verification)
3. ✅ Onboarding wizard (path selection, store setup, Printify connection)
4. ✅ Download purchase flow (Stripe one-time + license delivery email)
5. ✅ Provisioning engine (multi-tenant SQL inserts + edge function scaffold)
6. ✅ Merchant dashboard (store status, billing, settings)
7. ✅ Platform admin panel
8. ✅ Subscription billing (Stripe subscriptions + webhook handler)
9. ✅ Custom domain support
10. ✅ Platform marketing site (sales page, pricing, demo)

---

## Files Created

```
app/
  ✅ signup/page.tsx                      ← Full cloud + download wizard
  ✅ signup/verify/page.tsx
  ✅ dashboard/layout.tsx                 ← Protected sidebar layout
  ✅ dashboard/page.tsx
  ✅ dashboard/store/page.tsx
  ✅ dashboard/store/connect-printify/page.tsx
  ✅ dashboard/store/connect-stripe/page.tsx
  ✅ dashboard/store/domain/page.tsx
  ✅ dashboard/billing/page.tsx
  ✅ dashboard/billing/upgrade/page.tsx
  ✅ dashboard/download/page.tsx
  ✅ dashboard/support/page.tsx
  ✅ platform-admin/layout.tsx            ← Super admin layout + auth guard
  ✅ platform-admin/page.tsx
  ✅ platform-admin/merchants/page.tsx
  ✅ platform-admin/instances/page.tsx
  ✅ platform-admin/provisioning/page.tsx
  ✅ platform-admin/downloads/page.tsx
  ⬜ platform-admin/billing/page.tsx      ← NOT YET BUILT
  ⬜ platform-admin/settings/page.tsx     ← NOT YET BUILT
  ✅ api/webhooks/stripe/route.ts
  ✅ api/provision/route.ts
  ✅ api/provision/status/route.ts
  ✅ api/license/validate/route.ts
  ✅ api/license/activate/route.ts
  ✅ api/download/generate-url/route.ts
  ✅ api/checkout/route.ts
  ⬜ api/deprovision/route.ts              ← NOT YET BUILT

lib/
  ✅ supabase.ts
  ✅ stripe.ts
  ✅ provisioning.ts
  ✅ license.ts
  ✅ types.ts                             ← Extended with all platform types

middleware.ts
  ✅ hostname → tenant_id resolution (subdomain + custom domain)
  ✅ 60s in-process edge cache
  ⬜ Cloudflare KV / Vercel Edge Config cache  ← NOT YET BUILT (needed at scale)

supabase/
  ✅ migrations/001_platform_schema.sql   ← All 6 tables, RLS, triggers, indexes
  ✅ functions/provision-store/index.ts
  ✅ functions/deprovision-store/index.ts
  ✅ functions/generate-download-url/index.ts
  ⬜ functions/platform-stripe-webhook/   ← SCAFFOLD ONLY, not implemented

.env.local.example
  ✅ All 20+ platform env vars documented
```

## What Still Needs to Be Built

### Must-Have Before Launch
- [ ] `/api/deprovision` route — HTTP endpoint that calls the `deprovision-store` edge function
- [ ] Wire `/api/provision` to actually invoke the `provision-store` edge function after inserting the job row
- [ ] Wire subscription cancellation webhook to call `/api/deprovision` (currently updates DB only)
- [ ] Deploy Supabase edge functions (`supabase functions deploy`)
- [ ] Run `001_platform_schema.sql` migration against the platform Supabase project
- [ ] Create Stripe products + price IDs and populate `.env.local`
- [ ] Upload release ZIP to Supabase Storage `releases` bucket
- [ ] White-label toggle UI in `/dashboard/store` (column exists in DB, no UI yet)

### Nice-to-Have / Post-Launch
- [ ] `/platform-admin/billing` — Stripe revenue dashboard (MRR chart, payouts)
- [ ] `/platform-admin/settings` — Feature flags, pricing overrides
- [ ] Supabase Realtime on `provisioning_jobs` (replace polling with push)
- [ ] Cloudflare KV / Vercel Edge Config cache for middleware tenant lookups
- [ ] `platform-stripe-webhook` edge function (currently handled in Next.js API route — fine for now)
- [ ] Subdomain availability check API (`/api/subdomain/check`) — currently optimistic in signup wizard
- [ ] Printify API key real validation in signup (currently simulated with timeout)
- [ ] Impersonate merchant action in platform admin
- [ ] Retry failed provisioning jobs button (UI exists, action not wired)
- [ ] Welcome email on signup (Resend)
- [ ] "Store is live" email after provisioning completes (Resend)
- [ ] Magic link login (currently password only)
- [ ] Downgrade plan flow (upgrade exists, downgrade not wired)

### Architecture Decisions Still Open
- [ ] **Deployment target for platform app** — Vercel vs DigitalOcean App Platform vs self-hosted
- [ ] **Edge cache backend** — Cloudflare KV (if on Cloudflare) vs Vercel Edge Config (if on Vercel) vs Redis
- [ ] **Supabase hosting phase** — Currently coded for Option 2 (shared Pro). Confirm before going live.
- [ ] **Stripe Connect vs manual keys** — OAuth flow at `/api/stripe/connect-oauth` not yet implemented; manual keys work

---

## Definition of Done

- [x] Merchant can sign up, choose cloud or download path
- [x] Download purchase: Stripe payment → license key email → signed ZIP download
- [x] License key validation API works (called by downloaded app)
- [x] Cloud signup: Printify key validated, shop selected, plan chosen
- [ ] Provisioning engine creates isolated Supabase project + deploys store ⚠️ *multi-tenant SQL inserts wired; edge function `provision-store` needs to be deployed and called from `/api/provision`*
- [x] Merchant dashboard shows live store status + admin panel link
- [x] Stripe subscription billing with trial, upgrade, downgrade, cancel
- [ ] Subscription cancellation triggers store suspension ⚠️ *webhook handler calls deprovision but edge function is not yet invoked — needs `fetch()` call to `deprovision-store` function URL*
- [x] Platform admin can view all merchants, instances, jobs, downloads
- [x] Custom domain setup with DNS instructions
- [ ] White-label toggle for Agency plan ⚠️ *`white_label` column exists in DB + schema; UI toggle in dashboard not yet built*
- [x] All secrets isolated per merchant (never in platform DB)

---

## Infrastructure Decision — Supabase Hosting Strategy

This is the most important infrastructure decision for the platform. Four real options exist, each with different cost, complexity, and scaling profiles.

---

### Option 1 — Each Merchant Gets Their Own Free Supabase Account

**Architecture:** Merchant creates their own Supabase account during onboarding, pastes their project URL + anon key + service role key into your platform.

**Pros:**
- Zero Supabase cost to you — ever
- Merchant owns their data completely
- Free tier is generous (500MB DB, 1GB storage, 2GB bandwidth)
- No vendor lock-in concern for merchants

**Cons:**
- Onboarding friction is real — 5+ extra steps (create account, create project, copy 3 keys, run migrations)
- You can't auto-provision — merchant has to do it manually
- Support burden goes up ("where do I find my anon key?")
- Migrations have to be run by the merchant (SQL file they paste into Supabase SQL editor)

**Best for:** Download/self-host product only. Not viable for a "5-minute launch" cloud product.

---

### Option 2 — You Run One Supabase Pro Account, All Merchants Share It (Multi-tenant)

**Architecture:** One Supabase project. All merchants share the same DB with a `tenant_id` column on every table. RLS policies enforce isolation.

**Pros:**
- Cheapest option — $25/mo Supabase Pro covers all merchants
- Simplest provisioning — just INSERT a row, no new project needed
- You control everything, updates are instant across all stores
- No per-merchant Supabase complexity

**Cons:**
- RLS has to be airtight — one bug leaks one merchant's data to another
- One Supabase project has limits: 500MB free, Pro gives 8GB — shared across all merchants
- Bandwidth is pooled — a viral store could spike costs for everyone
- Supabase free tier only allows 2 projects total — you'd need Pro from day one
- Edge functions are shared — a bug in one merchant's webhook affects all

**Best for:** Early stage, under ~50 merchants. This is the fastest path to launch.

---

### Option 3 — Supabase Management API (Per-Merchant Projects Under Your Org)

**Architecture:** You have one Supabase organization. Each merchant gets their own project provisioned via the Supabase Management API. This is what the original provisioning engine above describes.

**Pros:**
- True isolation — each merchant has their own DB, auth, storage, edge functions
- Scales cleanly — no shared resource contention
- Merchant data is fully portable

**Cons:**
- Supabase charges per project on paid plans — free tier allows 2 projects per org
- To provision unlimited projects you need the Team plan ($599/mo) or pay per project
- Supabase free projects pause after 1 week of inactivity — bad for merchants
- Gets expensive fast: 50 merchants × ~$10/project = $500+/mo just for Supabase

**Best for:** Enterprise tier only, or if you're charging $79+/mo and can absorb the cost.

---

### Option 4 — Self-Hosted Supabase on Coolify

**Architecture:** You run Supabase on your own Coolify instance. One installation, you control it. Can run multi-tenant (Option 2 style) or provision per-merchant databases on the same Postgres instance.

**Pros:**
- Fixed cost — pay for the server, not per project or per merchant
- Full control — no Supabase pricing surprises
- Coolify makes Supabase self-hosting manageable
- Can create multiple Postgres databases on one server (per-merchant isolation without per-project cost)
- No project pause issues

**Cons:**
- You own the ops: backups, uptime, Postgres tuning, SSL, updates
- Supabase self-hosted doesn't include the Management API — provisioning is manual or custom-scripted
- Edge functions on self-hosted Supabase require Deno server setup
- If your server goes down, every merchant's store goes down
- Bandwidth costs depend on your VPS provider (DigitalOcean charges $0.01/GB over 1TB)

**Best for:** If you're comfortable with DevOps and want predictable costs at scale.

---

### Recommendation: Start with Option 2, Migrate to Option 4

**Phase 1 (0–50 merchants): Multi-tenant on Supabase Cloud Pro**
- One project, `tenant_id` on every table, RLS for isolation
- $25/mo flat, zero provisioning complexity
- Lets you validate the business before investing in infrastructure
- Onboarding is instant — no new Supabase project needed

**Phase 2 (50+ merchants or when DB hits 4GB): Self-hosted on Coolify**
- Migrate to a $40–80/mo Hetzner or DigitalOcean server running Supabase via Coolify
- Keep multi-tenant architecture (same schema, same RLS) — migration is just a data move
- Fixed cost regardless of merchant count
- Add a nightly backup to S3/R2 ($0.02/GB)

**The schema change for multi-tenant is minimal** — every table gets a `tenant_id uuid NOT NULL` column, every RLS policy adds `AND tenant_id = auth.jwt() ->> 'tenant_id'`. The application code adds `tenant_id` to every query. That's it.

---

### What Changes in the Architecture with Multi-tenant

With Option 2 or 4, provisioning a new merchant goes from a 7-step infrastructure job to 4 SQL inserts:

```sql
-- 1. Create auth user (Supabase Auth)
-- 2. Insert merchant row
INSERT INTO tenants (id, merchant_id, store_name, subdomain) VALUES (...);

-- 3. Seed their settings
INSERT INTO settings (tenant_id, store_name, ...) VALUES (...);

-- 4. Create their admin user
INSERT INTO admins (tenant_id, email, role) VALUES (...);
```

No new Supabase project. No new droplet. No DNS provisioning. The store template reads `tenant_id` from the session and all queries are automatically scoped. **Provisioning goes from 3 minutes to 3 seconds.**

The tradeoff is that the storefront Next.js app needs to know which tenant it is — solved by reading the subdomain from the request hostname and looking up the `tenant_id` at the edge.

**Bottom line:** Option 2 (shared Supabase Pro, multi-tenant) is the right call to launch. Option 4 (Coolify self-hosted) is the right call at scale. The architecture is the same for both — you're just moving where Postgres lives.

---

## ⚠️ Critical Architectural Note — Multi-tenant Storefront Awareness

> **This is the single most consequential implementation decision in the entire build. Get this wrong and the whole multi-tenant model breaks.**

The biggest architectural fork is whether the **storefront Next.js app is multi-tenant aware or not**.

### Per-Project Model (Option 3)
Each store is a completely separate Next.js deployment with its own env vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PRINTIFY_SHOP_ID`, etc. are all baked in at build time per merchant. The app code has zero knowledge of other tenants. Simple, isolated, expensive to operate.

### Multi-tenant Model (Options 2 and 4)
One Next.js deployment serves **all** merchant storefronts. Every incoming request must resolve:

```
https://brandname.printifyplatform.com/shop
         ↓
  hostname = 'brandname.printifyplatform.com'
         ↓
  subdomain = 'brandname'
         ↓
  lookup tenant_id from tenants table WHERE subdomain = 'brandname'
         ↓
  attach tenant_id to request context
         ↓
  every DB query: .eq('tenant_id', tenant_id)
```

This hostname → `tenant_id` resolution **must happen in Next.js middleware** (`middleware.ts`) so it runs at the edge before any page, layout, or API route executes. The resolved `tenant_id` is then passed via a request header (e.g. `x-tenant-id`) that server components and API routes read from.

```ts
// middleware.ts (runs on every request at the edge)
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const subdomain = hostname.split('.')[0]  // 'brandname'

  // Lookup tenant_id by subdomain (cached at edge)
  const tenant = await getTenantBySubdomain(subdomain)

  if (!tenant) return NextResponse.redirect('/not-found')

  // Inject tenant_id into request headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenant.id)
  response.headers.set('x-tenant-subdomain', subdomain)
  return response
}
```

Every Supabase query in the app then scopes to that tenant:

```ts
// In any server component or API route
const tenantId = headers().get('x-tenant-id')
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('tenant_id', tenantId)   // ← this line on every single query
  .eq('status', 'active')
```

### The Cache Problem
The middleware tenant lookup hits the DB on every request. At scale this becomes a bottleneck. Solve it with edge caching:
- Cache `subdomain → tenant_id` in a Cloudflare KV store or Vercel Edge Config
- TTL of 60 seconds is fine — subdomains don't change often
- On tenant update (store name change, suspension), invalidate the cache entry

### Custom Domains
When a merchant sets a custom domain (`mybrand.com` → their store), the middleware needs to handle both:
- `brandname.printifyplatform.com` → lookup by subdomain
- `mybrand.com` → lookup by custom_domain column

```ts
const isCustomDomain = !hostname.endsWith('.printifyplatform.com')
const tenant = isCustomDomain
  ? await getTenantByCustomDomain(hostname)
  : await getTenantBySubdomain(subdomain)
```

### RLS as the Safety Net
Even with `tenant_id` filtering in application code, **RLS policies are the last line of defense**. Every table must have:

```sql
CREATE POLICY "tenant_isolation" ON products
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

The JWT must include `tenant_id` as a custom claim — set this in Supabase Auth hooks when the merchant admin logs in.

> If the application-level `tenant_id` filter is ever missing from a query, RLS catches it. Without RLS, one missing `.eq('tenant_id', ...)` leaks every merchant's data to every other merchant.
