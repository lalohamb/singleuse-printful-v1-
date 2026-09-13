# Body & Sleeves — SaaS Frontend Prompt

## Project Overview

Build a production-ready **Next.js 14 (App Router)** ecommerce storefront for **Body & Sleeves**, a Printify-powered print-on-demand clothing brand. The app is a SaaS frontend that connects to:

- **Printify** (product catalog via proxy)
- **Stripe** (payment wall / checkout)
- **Supabase** (auth, orders, brand settings, admin)

---

## Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | Next.js 14 App Router (TypeScript)  |
| Styling      | Tailwind CSS                        |
| Payments     | Stripe Checkout (hosted)            |
| Backend      | Supabase (Postgres + Edge Functions)|
| POD Fulfillment | Printify API (via Supabase proxy) |
| Containerization | Docker + Docker Compose          |
| CI/CD        | GitHub Actions → DigitalOcean Droplet |

---

## Pages & Routes

```
/                        → Homepage (hero, featured products, brand story)
/shop                    → Full product catalog (Printify products)
/product/[id]            → Product detail (variants, sizes, add to cart)
/checkout                → Stripe payment wall
/about                   → Brand story
/refund-policy           → Legal
/terms-of-service        → Legal
/admin                   → Protected admin dashboard
/admin/products          → Curate/flag Printify products
/admin/orders            → View orders
/admin/settings          → Brand settings (logo, colors, SEO, social links)
```

---

## Key Components

### Storefront
- `Header` — logo, nav, cart icon with drawer
- `CartDrawer` — slide-out cart with quantity controls
- `ProductCard` — image, title, price, "Add to Cart" CTA
- `Footer` — social links, legal links, newsletter signup
- `Reveal` — scroll-triggered fade-in animation wrapper

### Checkout / Stripe Payment Wall
- Cart review step
- Stripe Checkout session created via Supabase Edge Function (`/functions/stripe-checkout`)
- Redirect to Stripe hosted checkout page
- Success/cancel redirect handling
- Webhook handler (`/functions/stripe-webhook`) updates order status in Supabase

### Admin
- Protected by Supabase auth (`ProtectedAdmin` wrapper)
- Product curation: show/hide Printify products, set featured flags
- Brand settings: logo URL, primary color, SEO title/description, social links
- Order management table

---

## Stripe Integration

### Flow
```
User clicks "Checkout"
  → POST /api/checkout (or Supabase Edge Function)
  → Creates Stripe Checkout Session with line_items from cart
  → Redirects user to stripe.com/pay/...
  → On success → stripe-webhook fires → order saved to Supabase
  → User lands on /checkout?success=true
```

### Required Stripe ENV vars
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Supabase Edge Function: `stripe-checkout`
- Receives cart items
- Maps to Stripe `line_items` with Printify product prices
- Sets `success_url` and `cancel_url`
- Returns `{ url }` for client redirect

### Supabase Edge Function: `stripe-webhook`
- Verifies Stripe signature
- On `checkout.session.completed` → inserts order into `orders` table
- Triggers Printify order creation via `printify-proxy`

---

## Printify Integration

### Supabase Edge Function: `printify-proxy`
- Proxies requests to `api.printify.com/v1/`
- Keeps Printify API key server-side only
- Endpoints used:
  - `GET /shops/{shop_id}/products.json` — catalog
  - `GET /shops/{shop_id}/products/{id}.json` — product detail
  - `POST /shops/{shop_id}/orders.json` — create order after payment

### Required ENV vars
```env
PRINTIFY_API_KEY=...
PRINTIFY_SHOP_ID=...
```

---

## Docker Setup

### `Dockerfile`
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> Requires `output: 'standalone'` in `next.config.mjs`

### `docker-compose.yml`
```yaml
version: '3.9'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```

### `.dockerignore`
```
node_modules
.next
.env*.local
.git
```

### `next.config.mjs` addition
```js
const nextConfig = {
  output: 'standalone',
  // ...existing config
};
```

---

## Environment Variables (full list)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Printify
PRINTIFY_API_KEY=
PRINTIFY_SHOP_ID=

# App
NEXT_PUBLIC_SITE_URL=https://bodyandsleeves.com
```

---

## Advertising Copy (Homepage)

### Hero Section
```
Headline:   "Wear Your Story."
Subheadline: "Premium print-on-demand apparel — designed with intention, shipped to your door."
CTA:        "Shop the Collection"
```

### Value Props
- 🖨️ **Print-on-Demand** — Every piece made fresh, no overstock waste
- 🚚 **Worldwide Shipping** — Fulfilled by Printify's global network
- 💳 **Secure Checkout** — Powered by Stripe
- 🔄 **Easy Returns** — Hassle-free refund policy

### Featured Section
```
"New Arrivals" — dynamically pulled from Printify, curated in admin
```

---

## Supabase Schema (key tables)

```sql
-- orders
id, stripe_session_id, printify_order_id, status, total, items (jsonb), created_at

-- brand_settings
id, logo_url, primary_color, site_title, seo_description, social_links (jsonb)

-- admins
id, user_id (fk auth.users)

-- product_flags
printify_product_id, is_featured, is_hidden, content_locked
```

---

## Deployment Checklist

- [ ] `output: 'standalone'` set in `next.config.mjs`
- [ ] `Dockerfile` and `docker-compose.yml` in project root
- [ ] All ENV vars set in `.env.local` (never committed)
- [ ] Stripe webhook endpoint registered: `https://yourdomain.com/api/stripe-webhook`
- [ ] Supabase Edge Functions deployed: `stripe-checkout`, `stripe-webhook`, `printify-proxy`
- [ ] Printify shop connected and products published
- [ ] Admin user seeded in `admins` table
- [ ] DNS pointed to DigitalOcean Droplet / server IP
