# Printful Integration Plan

**Date:** 2025-07-14
**Decision:** Printful products run alongside Printify in the same storefront, cart, and checkout.
**Rule:** No existing code is modified until each section is reviewed and approved.

---

## Overview

The storefront currently uses Printify exclusively. This plan adds Printful as a second
fulfillment provider. Both providers coexist — a customer can add a Printify product and
a Printful product to the same cart, pay once, and both orders are submitted to their
respective providers automatically after payment.

---

## How the Current Printify System Works

Understanding every Printify touchpoint is required before adding anything.

### Product sync
```
Admin → /admin/products → "Sync Printify"
  → POST supabase/functions/printify-proxy/sync?shop_id=
    → Paginates Printify products API
    → Upserts into products table (keyed on printify_id)
    → Stores blueprint_id, print_provider_id, variants, shipping_info
```

### Checkout — shipping cost
```
stripe-checkout edge function
  → Calls Printify orders/shipping.json with line items
  → Falls back to DB-cached shipping_info on failure
```

### Order fulfillment
```
stripe-webhook: checkout.session.completed
  → Reads items[].printify_id from order
  → POSTs to Printify orders.json
  → Stores printify_order_id on the order row
```

### Tracking webhook
```
Printify → printify-webhook edge function
  → Updates orders.fulfillment_status, tracking_number, tracking_url
  → Sends shipping email via Resend
```

### Database fields that are Printify-specific today

| Field | Table | Notes |
|---|---|---|
| `printify_id` | products | Upsert key |
| `blueprint_id` | products | Printify blueprint |
| `print_provider_id` | products | Printify provider |
| `shipping_info` | products | Cached shipping profile |
| `printify_order_id` | orders | Set after fulfillment |
| `printify_id` | orders.items JSONB | Passed to Printify at order time |

---

## Printful vs Printify — Key Differences

| Aspect | Printify | Printful |
|---|---|---|
| Base URL | `https://api.printify.com/v1` | `https://api.printful.com` |
| Auth | `Bearer TOKEN` | `Bearer TOKEN` |
| Product list | `GET /shops/{id}/products.json` | `GET /store/products` |
| Product detail | `GET /shops/{id}/products/{id}.json` | `GET /store/products/{id}` |
| Variant structure | `variants[]` with `options[]` (color/size IDs) | `sync_variants[]` with `name: "Color / Size"` |
| Variant ID for orders | integer string from `variants[].id` | `variant_id` field on sync_variant |
| Shipping quote | `POST /shops/{id}/orders/shipping.json` | `POST /shipping/rates` |
| Order submission | `POST /shops/{id}/orders.json` | `POST /orders` |
| Tracking webhook event | `order:shipment:created` | `package_shipped` |
| Product images | `images[].src` | `sync_variants[].files[].preview_url` |
| Shop identifier | `shop_id` query param | `store_id` in settings (not in path) |

---

## What Needs to Be Built

### Step 1 — Database migration (new file, no existing tables broken)

**File to create:** `supabase/migrations/20261013000000_add_printful.sql`

Changes:
- `products` table: add `fulfillment_provider text NOT NULL DEFAULT 'printify'` and `printful_id text UNIQUE`
- `products` table: backfill `fulfillment_provider = 'printify'` where `printify_id IS NOT NULL`, `'manual'` where null
- `orders` table: add `printful_order_id text`, `printful_tracking_number text`, `printful_tracking_url text`, `printful_fulfillment_status text`
- `settings` table: add `printful_connected boolean DEFAULT false`, `printful_store_id text`

Why these columns:
- `fulfillment_provider` — tells `stripe-webhook` which API to call for each product
- `printful_id` — upsert key for Printful sync (mirrors `printify_id`)
- `printful_order_id` — stores Printful order reference after fulfillment
- `printful_tracking_*` — mixed-cart orders can have two separate shipments
- `printful_connected` / `printful_store_id` — admin UI connection status

Risk: Zero. All new nullable columns with defaults. No existing queries break.

---

### Step 2 — TypeScript types (src/types.ts)

Add to `Product` interface:
```
fulfillment_provider: 'printify' | 'printful' | 'manual'
printful_id: string | null
```

Add to `CartItem` interface:
```
printful_id: string | null
fulfillment_provider: string
```

Add to `Order` interface:
```
printful_order_id: string | null
printful_tracking_number: string | null
printful_tracking_url: string | null
printful_fulfillment_status: string | null
```

Risk: Zero. All nullable. Existing code that reads `product.printify_id` is unaffected.

---

### Step 3 — New edge function: printful-proxy

**File to create:** `supabase/functions/printful-proxy/index.ts`

This is a new file. Zero changes to `printify-proxy`.

Endpoints it handles:
- `GET /products` — list Printful sync products
- `GET /products/:id` — get single product with sync_variants
- `POST /shipping` — calculate shipping rates via `POST /shipping/rates`
- `POST /orders` — submit order to Printful
- `GET /orders/:id` — get order status
- `POST /sync` — sync all Printful products into the products table

Sync logic differences from Printify:
- Paginates via `offset` + `limit` (not `page`)
- Variant ID to use for orders is `sync_variant.variant_id` (catalog ID), not `sync_variant.id` (store ID)
- Color/size parsed from `sync_variant.name` string (format: `"Black / S"`)
- Images come from `sync_variant.files[].preview_url`
- Sets `fulfillment_provider = 'printful'` on every upserted product
- Upserts on conflict `printful_id`

Secrets required (set via `supabase secrets set`):
- `PRINTFUL_API_TOKEN`

---

### Step 4 — New edge function: printful-webhook

**File to create:** `supabase/functions/printful-webhook/index.ts`

This is a new file. Zero changes to `printify-webhook`.

Events it handles:

| Event | Action |
|---|---|
| `package_shipped` | Update `orders.printful_fulfillment_status = 'shipped'`, set `printful_tracking_number`, `printful_tracking_url`, send shipping email via Resend |
| `order_updated` | Update `printful_fulfillment_status` |
| `order_canceled` | Update `printful_fulfillment_status = 'cancelled'` |

Webhook signature verification:
- Printful sends `X-PF-Signature` header
- Verify with HMAC-SHA256 of raw body using `PRINTFUL_WEBHOOK_SECRET`

Secrets required:
- `PRINTFUL_WEBHOOK_SECRET`

Webhook URL to register in Printful dashboard:
```
https://<project-ref>.supabase.co/functions/v1/printful-webhook
```

---

### Step 5 — Modify: stripe-checkout (shipping routing)

**File:** `supabase/functions/stripe-checkout/index.ts`

Current behavior: calls Printify shipping API for all items.

New behavior: split items by provider, get shipping cost from each, sum them.

```
printifyItems = verifiedItems.filter(i => i.fulfillment_provider === 'printify')
printfulItems = verifiedItems.filter(i => i.fulfillment_provider === 'printful')

printifyShipping = await getPrintifyShipping(printifyItems)   // existing function
printfulShipping = await getPrintfulShipping(printfulItems)   // new function
totalShipping = printifyShipping + printfulShipping
```

Printful shipping API call shape:
```json
POST https://api.printful.com/shipping/rates
{
  "recipient": { "address1": "...", "city": "...", "state_code": "CA", "country_code": "US", "zip": "..." },
  "items": [{ "variant_id": 4011, "quantity": 1 }]
}
```

Fallback: if Printful shipping API fails, use `settings.default_shipping_cost`.

Risk: Low. Existing Printify shipping block is unchanged. New block only runs when Printful items are present.

---

### Step 6 — Modify: stripe-webhook (fulfillment routing)

**File:** `supabase/functions/stripe-webhook/index.ts`

Current behavior: submits all items to Printify unconditionally.

New behavior: route by `fulfillment_provider` on each cart item.

```
printifyItems = items.filter(i => i.fulfillment_provider === 'printify' || i.printify_id)
printfulItems = items.filter(i => i.fulfillment_provider === 'printful' || i.printful_id)

if (printifyItems.length) → submit to Printify (existing code, unchanged)
if (printfulItems.length) → submit to Printful (new block)
```

Printful order submission shape:
```json
POST https://api.printful.com/orders
{
  "recipient": {
    "name": "...", "address1": "...", "city": "...",
    "state_code": "CA", "country_code": "US", "zip": "...",
    "email": "...", "phone": "..."
  },
  "items": [
    { "variant_id": 4011, "quantity": 1 }
  ]
}
```

After successful submission:
- Store `printful_order_id` on the order row
- Store `printful_fulfillment_status = 'pending'`

Risk: Low. Printify block is untouched. Printful block only runs when `printful_id` is present on items.

---

### Step 7 — Modify: cart.tsx (snapshot)

**File:** `src/lib/cart.tsx`

The `addToCart` function builds the CartItem snapshot stored in `orders.items` JSONB.
Add `printful_id` and `fulfillment_provider` to the snapshot so `stripe-webhook` can route.

Current:
```ts
{ product_id, title, price, image_url, quantity, variant_id, variant_label,
  printify_id, blueprint_id, print_provider_id }
```

New:
```ts
{ ...existing fields,
  printful_id: product.printful_id ?? null,
  fulfillment_provider: product.fulfillment_provider }
```

Risk: Low. New fields are nullable. Existing Printify cart items are unaffected.

---

### Step 8 — Modify: next.config.mjs (remotePatterns)

**File:** `next.config.mjs`

Add two Printful CDN hostnames to the existing allowlist:

```js
{ protocol: 'https', hostname: 'files.cdn.printful.com' },
{ protocol: 'https', hostname: 'ucarecdn.com' },
```

`files.cdn.printful.com` — Printful product mockup images
`ucarecdn.com` — Uploadcare CDN used by Printful for some assets

Risk: None. Additive change.

---

### Step 9 — Modify: admin products page (Sync button)

**File:** `src/app/admin/products/page.tsx`

Add a "Sync Printful" button alongside the existing "Sync Printify" button.

The button calls:
```
POST <supabase-url>/functions/v1/printful-proxy/sync
Authorization: Bearer <anon-key>
```

The product table already shows all products regardless of provider.
Add a provider badge in the status column:
- `via Printify` (already exists)
- `via Printful` (new)
- `via Manual` (already exists)

Risk: None. Additive UI change.

---

### Step 10 — Modify: admin settings Integrations (connection UI)

**File:** `src/app/admin/settings/sections/Integrations.tsx`

Add a Printful section below the existing Printify section:
- Store ID input (saved to `settings.printful_store_id`)
- Connection status badge (reads `settings.printful_connected`)
- "Test connection" button (calls `printful-proxy/products?limit=1`)

Risk: None. Additive UI change.

---

### Step 11 — Modify: order tracking page (dual shipment)

**File:** `src/app/track/page.tsx`

Currently shows one tracking number (`order.tracking_number`).

For mixed-cart orders, show both shipments if present:
- Printify shipment: `order.tracking_number` / `order.tracking_url`
- Printful shipment: `order.printful_tracking_number` / `order.printful_tracking_url`

Label each shipment by provider so the customer knows which package is which.

Risk: None. Additive UI change. Single-provider orders are unaffected.

---

## Mixed Cart — Full Flow

```
Customer adds Printify T-shirt + Printful hoodie to cart

stripe-checkout:
  - Printify shipping: POST Printify /orders/shipping.json
  - Printful shipping: POST Printful /shipping/rates
  - Total shipping = sum of both
  - Single Stripe session, both line items

Customer pays

stripe-webhook: checkout.session.completed
  - Printify order: POST Printify /shops/{id}/orders.json
    → orders.printify_order_id = "PFY-123"
  - Printful order: POST Printful /orders
    → orders.printful_order_id = "PFL-456"

Printify ships T-shirt:
  - printify-webhook: order:shipment:created
    → orders.tracking_number = "1Z..."
    → orders.fulfillment_status = "shipped"
    → Resend: shipping email sent

Printful ships hoodie:
  - printful-webhook: package_shipped
    → orders.printful_tracking_number = "9400..."
    → orders.printful_fulfillment_status = "shipped"
    → Resend: second shipping email sent

Customer visits /track:
  - Sees both tracking numbers labeled by provider
```

---

## New Secrets Required

Set these via `supabase secrets set` before deploying the edge functions:

| Secret | Purpose |
|---|---|
| `PRINTFUL_API_TOKEN` | Printful API authentication |
| `PRINTFUL_WEBHOOK_SECRET` | Webhook signature verification |

No new `NEXT_PUBLIC_*` env vars needed. Printful is entirely server-side.

---

## Files Summary

| File | Action | Risk |
|---|---|---|
| `supabase/migrations/20261013000000_add_printful.sql` | Create | None |
| `supabase/functions/printful-proxy/index.ts` | Create | None |
| `supabase/functions/printful-webhook/index.ts` | Create | None |
| `src/types.ts` | Modify — add 4 fields | None |
| `src/lib/cart.tsx` | Modify — add 2 fields to snapshot | Low |
| `supabase/functions/stripe-checkout/index.ts` | Modify — split shipping by provider | Low |
| `supabase/functions/stripe-webhook/index.ts` | Modify — add Printful fulfillment routing | Low |
| `next.config.mjs` | Modify — add 2 CDN hostnames | None |
| `src/app/admin/products/page.tsx` | Modify — add Sync Printful button + badge | None |
| `src/app/admin/settings/sections/Integrations.tsx` | Modify — add Printful connection UI | None |
| `src/app/track/page.tsx` | Modify — show dual shipment tracking | None |

**Files that do NOT change:**
- All storefront pages (shop, product detail, homepage, checkout)
- `supabase/functions/printify-proxy/index.ts`
- `supabase/functions/printify-webhook/index.ts`
- All other API routes
- All other UI components

---

## Implementation Order

1. Run DB migration — safe at any time, no code changes needed
2. Update `src/types.ts` — build still passes, no runtime effect
3. Create `printful-proxy` edge function — isolated, test independently
4. Create `printful-webhook` edge function — isolated, register in Printful dashboard
5. Update `next.config.mjs` — rebuild + deploy
6. Update admin products page — add Sync button, test sync
7. Update admin settings Integrations — add connection UI
8. Update `cart.tsx` — add fields to snapshot
9. Update `stripe-checkout` — split shipping calculation
10. Update `stripe-webhook` — add Printful fulfillment routing
11. Update `track/page.tsx` — dual shipment display
12. End-to-end test in Stripe test mode with a Printful product

---

## Pre-Implementation Checklist

Before writing any code, confirm:

- [ ] Printful account exists with at least one product created in the Printful dashboard
- [ ] Printful API token obtained from Printful dashboard → Settings → API
- [ ] Printful store ID confirmed (Printful dashboard → Settings → Stores)
- [ ] Printful webhook URL registered: `https://<project-ref>.supabase.co/functions/v1/printful-webhook`
- [ ] `PRINTFUL_API_TOKEN` set as Supabase edge function secret
- [ ] `PRINTFUL_WEBHOOK_SECRET` set as Supabase edge function secret
- [ ] DB migration reviewed and approved
- [ ] This plan reviewed section by section
