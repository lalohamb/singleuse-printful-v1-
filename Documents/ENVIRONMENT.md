# Gender Apparel — Environment & Technology Stack

---

## Stack at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PRODUCTION ENVIRONMENT                                 │
│                                                                                 │
│   ┌──────────────────────┐        ┌──────────────────────────────────────────┐  │
│   │  DigitalOcean Droplet│        │           Supabase Cloud                 │  │
│   │  Ubuntu 22.04        │        │  ┌──────────────┐  ┌──────────────────┐  │  │
│   │                      │        │  │  PostgreSQL   │  │  Edge Functions  │  │  │
│   │  Node.js 22          │◄──────►│  │  (+ RLS)      │  │  (Deno runtime)  │  │  │
│   │  Next.js 15          │        │  └──────────────┘  └──────────────────┘  │  │
│   │  PM2 (process mgr)   │        │  ┌──────────────┐  ┌──────────────────┐  │  │
│   │  Nginx (reverse proxy│        │  │  Auth         │  │  Storage         │  │  │
│   │  port 80/443 → 3000) │        │  └──────────────┘  └──────────────────┘  │  │
│   └──────────────────────┘        └──────────────────────────────────────────┘  │
│                                                                                 │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│   │   Stripe     │  │   Printify   │  │    Resend    │  │   MailerLite     │   │
│   │  (payments)  │  │  (print POD) │  │   (email)    │  │  (newsletter)    │   │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Runtime Layers

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js | 15.5.25 |
| Language | TypeScript | ^5 |
| Runtime (server) | Node.js | 22.x |
| Runtime (edge functions) | Deno | latest (Supabase managed) |
| UI library | React / React DOM | ^19 |
| Styling | Tailwind CSS | ^3.4.1 |
| Icons | lucide-react | ^1.40.0 |
| Fonts | Inter (sans), Playfair Display (display) | Google Fonts via CSS |

---

## External Services

| Service | Role | SDK / Integration |
|---|---|---|
| Supabase | Database, Auth, Edge Functions, Storage | `@supabase/supabase-js ^2.115.0` |
| Stripe | Payment processing, Checkout sessions | `stripe ^22.6.1` (server), Stripe Checkout (hosted) |
| Printify | Print-on-demand fulfillment | REST API via `printify-proxy` edge function |
| Resend | Transactional email (order confirm + shipping) | REST API called from edge functions |
| MailerLite | Newsletter / email marketing | REST API via `/api/mailerlite` Next.js route |

---

## Environment Variables

### Next.js App (`.env.local`)

| Variable | Scope | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✓ | Supabase anon/public key |
| `NEXT_PUBLIC_PRINTIFY_SHOP_ID` | Client | optional | Exposed shop ID for storefront use |
| `PRINTIFY_SHOP_ID` | Server only | ✓ | Printify shop ID for API calls |
| `PRINTIFY_API_TOKEN` | Server only | ✓ | Printify JWT bearer token |
| `STRIPE_SECRET_KEY` | Server only | ✓ | Stripe secret key (`sk_...`) |
| `RESEND_API_KEY` | Server only | ✓ | Resend API key (`re_...`) |
| `MAILER_LITE_API_KEY` | Server only | ✓ | MailerLite JWT token |

### Supabase Edge Function Secrets

Set via `supabase secrets set <KEY>=<VALUE>` — never stored in `.env.local`.

| Secret | Used By |
|---|---|
| `SUPABASE_URL` | All functions (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | All functions (auto-injected) |
| `PRINTIFY_API_TOKEN` | printify-proxy, printify-webhook, stripe-webhook |
| `PRINTIFY_SHOP_ID` | printify-webhook, stripe-webhook |
| `STRIPE_SECRET_KEY` | stripe-checkout, stripe-webhook |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook (optional — skips sig check if absent) |
| `RESEND_API_KEY` | stripe-webhook, printify-webhook |

### Test (`.env.test`)

| Variable | Value |
|---|---|
| `TEST_ADMIN_EMAIL` | admin@genderapparel.example |
| `TEST_ADMIN_PASSWORD` | changeme |

---

## Build & Output

| Setting | Value |
|---|---|
| `output` | `standalone` (self-contained Node.js server) |
| `eslint.ignoreDuringBuilds` | `true` |
| Path alias | `@/*` → `./src/*` |
| Module resolution | `bundler` |
| Strict TypeScript | `true` |

---

## Server Infrastructure (DigitalOcean Droplet)

```
Internet
    │
    ▼  :80 / :443
┌─────────────────────────────────────────┐
│  Nginx (reverse proxy)                  │
│  bodyandsleeves.com → localhost:3000    │
│  www.bodyandsleeves.com → localhost:3000│
│  HTTPS via Let's Encrypt (certbot)      │
└──────────────────┬──────────────────────┘
                   │  proxy_pass :3000
                   ▼
┌─────────────────────────────────────────┐
│  PM2 — process: "bodyandsleeves"        │
│  command: npm start                     │
│  auto-restart on crash                  │
│  startup: systemd (survives reboots)    │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│  Next.js 15 standalone server           │
│  /var/www/bodyandsleeves                │
│  .env.local  (chmod 600)                │
└─────────────────────────────────────────┘
```

**Deploy flow:**
```bash
# Initial setup (run once on fresh droplet)
DOMAIN=bodyandsleeves.com REPO=git@github.com:... bash scripts/setup-droplet.sh

# Subsequent deploys
bash scripts/deploy.sh
# → git pull → npm install → npm run build → pm2 restart bodyandsleeves
```

---

## Testing

| Tool | Version | Config |
|---|---|---|
| Playwright | ^1.63.0 | `playwright.config.ts` |
| Test runner | Chromium + iPhone 13 (mobile) | parallel, HTML reporter |
| Base URL | `http://localhost:3000` | auto-starts `npm run dev` |
| CI retries | 2 | `process.env.CI` flag |

**Test suites:**
- `e2e/storefront.spec.ts` — public storefront flows
- `e2e/checkout.spec.ts` — cart and checkout flows
- `e2e/admin.spec.ts` — admin panel flows

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:report   # view HTML report
```

---

## Supabase Edge Functions

| Function | JWT | Trigger |
|---|---|---|
| `printify-proxy` | required | Admin panel (product sync, CRUD) |
| `printify-webhook` | none | Printify push (product publish, order events) |
| `stripe-checkout` | none | Storefront checkout form |
| `stripe-webhook` | none | Stripe event push (payment complete/failed) |

```bash
supabase functions deploy printify-proxy
supabase functions deploy printify-webhook
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

---

## Tailwind Design Tokens

| Token | Purpose | Key Values |
|---|---|---|
| `primary` | Brand warm brown | 50–900 scale |
| `secondary` | Neutral grays | 50–900 scale |
| `accent` | Warm orange-red | 50–900 scale |
| `gold` | Accent highlights | 400, 500, 600 |
| `success/warning/error` | Status colors | standard scale |
| `font-sans` | Body text | Inter, system-ui |
| `font-display` | Headings | Playfair Display, Georgia |

Custom animations: `fade-in`, `slide-up`, `slide-in-right`, `slide-down`, `marquee`

---

## Data Flow Summary

```
Browser (Next.js client)
    │
    ├── reads  → Supabase DB (anon key, RLS enforced)
    ├── writes → stripe-checkout edge fn → Stripe → stripe-webhook → DB + Printify
    └── admin  → printify-proxy edge fn (JWT) → Printify API → DB sync

Printify
    └── pushes → printify-webhook edge fn → DB update + Resend email

Stripe
    └── pushes → stripe-webhook edge fn → DB update + Resend email + Printify order

MailerLite
    └── called → /api/mailerlite Next.js route → newsletter subscribe
```
