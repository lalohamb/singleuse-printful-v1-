# Printful API Integration Plan

**Application:** Body&Sleeves — Next.js 15 / Supabase / Stripe POD Storefront
**Date:** 2025-07-14
**Status:** Planning confirmed — mixed-cart (Printify + Printful side by side) required
**Decision:** Printful products run alongside Printify products in the same storefront, same cart, same checkout.

---

## Overview

This document evaluates adding Printful as a second print-on-demand fulfillment provider alongside the existing Printify integration. The goal is to allow products from either provider to coexist in the same storefront, be purchased in the same cart, and be fulfilled automatically after payment.

---

## 1. Current Architecture — What Printify Does

Before planning Printful, it is essential to understand every place Printify is wired into the system today.

### 1.1 Product sync (admin-triggered)

```
Admin → /admin/products → "Sync from Printify"
  → POST supabase/functions/printify-proxy/sync?shop_id=
    → Paginates Printify products API
    → For each product: fetches detail, variants, shipping profile
    → Upserts into products table (keyed on printify_id)
    → Stores blueprint_id, print_provider_id, shipping_info, variants
```

### 1.2 Product webhook (Printify-triggered)

```
Printify publishes a product
  → POST supabase/functions/printify-webhook
    → Upserts product into products table
    → Calls publishing_succeeded back to Printify
```

### 1.3 Checkout — shipping cost

```
Customer submits checkout
  → stripe-checkout edge function
    → Calls Printify orders/shipping.json with line items
    → Gets live shipping cost
    → Falls back to DB-cached shipping_info if Printify is unreachable
```

### 1.4 Order fulfillment

```
Stripe webhook: checkout.session.completed
  → stripe-webhook edge function
    → Reads items[].printify_id and items[].variant_id from order
    → POSTs to Printify orders.json
    → Stores printify_order_id on the order row
```

### 1.5 Shipping/tracking webhook (Printify-triggered)

```
Printify ships an order
  → POST supabase/functions/printify-webhook
    → Updates orders.fulfillment_status, tracking_number, tracking_url
    → Sends shipping email via Resend
```

### 1.6 Database fields that are Printify-specific

| Field | Table | Purpose |
|---|---|---|
| `printify_id` | `products` | Printify product ID — used as upsert key |
| `blueprint_id` | `products` | Printify blueprint (product template) |
| `print_provider_id` | `products` | Printify print provider |
| `shipping_info` | `products` | Cached Printify shipping profile |
| `printify_order_id` | `orders` | Printify order ID after fulfillment |
| `printify_id` | `cart_items` (via orders.items JSONB) | Passed to Printify at order time |

---

## 2. Printful API — Key Differences from Printify

Understanding the differences is critical to designing a clean integration.

| Aspect | Printify | Printful |
|---|---|---|
| Product ID field | `printify_id` (integer as string) | `printful_id` (integer) |
| Variant ID | Integer, passed as `variant_id` | Integer, called `variant_id` |
| Sync mechanism | Manual sync + webhook | Manual sync + webhook |
| Shipping quote | `POST /orders/shipping.json` | `POST /shipping/rates` |
| Order submission | `POST /shops/{id}/orders.json` | `POST /orders` |
| Order tracking webhook | `order:shipment:created` | `package_shipped` |
| Product images | CDN URLs in `images[].src` | CDN URLs in `sync_variants[].files` |
| Variants | `variants[]` with `options[]` (color/size IDs) | `sync_variants[]` with `variant_id` |
| Auth | Bearer token | Bearer token (`Authorization: Bearer TOKEN`) |
| Base URL | `https://api.printify.com/v1` | `https://api.printful.com` |
| Shipping profile | Per blueprint/provider via catalog API | Per product via `/shipping/rates` at checkout |

---

## 3. Integration Strategy — Provider-Agnostic Products Table

The cleanest approach that does not break existing Printify functionality is to make the `products` table **provider-agnostic** by adding a `fulfillment_provider` field and a `printful_id` field, while keeping all existing Printify fields intact.

### 3.1 Core principle

Every product in the database has exactly one fulfillment provider. The storefront, cart, and checkout code does not need to know which provider — it just reads from the `products` table. The fulfillment routing happens in the `stripe-webhook` edge function after payment, based on `fulfillment_provider`.

```
products table
├── fulfillment_provider: 'printify' | 'printful' | 'manual'
├── printify_id: text | null        ← existing, unchanged
├── printful_id: text | null        ← NEW
├── blueprint_id: text | null       ← Printify-specific, kept as-is
├── print_provider_id: text | null  ← Printify-specific, kept as-is
└── shipping_info: jsonb            ← provider-specific cached profile
```

Cart items already carry `printify_id` in the JSONB snapshot. We add `printful_id` to the snapshot as well. The `stripe-webhook` reads whichever is populated.

---

## 4. What Needs to Change

### 4.1 Database migration

One new migration file needed:

```sql
-- supabase/migrations/YYYYMMDD_add_printful.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fulfillment_provider text NOT NULL DEFAULT 'printify',
  ADD COLUMN IF NOT EXISTS printful_id text UNIQUE;

-- Backfill existing products
UPDATE products SET fulfillment_provider = 'printify' WHERE printify_id IS NOT NULL;
UPDATE products SET fulfillment_provider = 'manual'   WHERE printify_id IS NULL;

-- Index for sync lookups
CREATE INDEX IF NOT EXISTS idx_products_printful_id ON products(printful_id) WHERE printful_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_provider    ON products(fulfillment_provider);
```

**Risk:** Zero. Adding nullable columns with defaults never breaks existing queries or RLS policies.

### 4.2 TypeScript types (`src/types.ts`)

Add two fields to the `Product` interface and `CartItem` interface:

```ts
// Product
fulfillment_provider: 'printify' | 'printful' | 'manual';
printful_id: string | null;

// CartItem — add alongside existing printify_id
printful_id: string | null;
```

**Risk:** Zero breaking changes. Both fields are nullable. Existing code that reads `product.printify_id` continues to work.

### 4.3 New Supabase edge function — `printful-proxy`

Mirror the structure of `printify-proxy/index.ts`. Handles:

- `GET /products` — list Printful sync products
- `GET /products/:id` — get single product
- `POST /sync` — sync Printful products to DB (upsert on `printful_id`)
- `GET /shipping` — calculate shipping rates
- `POST /orders` — submit order to Printful

Key differences from `printify-proxy`:

```
Printful API base: https://api.printful.com
Auth header: Authorization: Bearer PRINTFUL_API_TOKEN
Product endpoint: GET /store/products (not /shops/{id}/products.json)
Variant structure: sync_variants[].variant_id (not options[])
Shipping: POST /shipping/rates (different payload shape)
Order: POST /orders (no shop_id in path)
```

**Risk:** Zero impact on existing Printify proxy. Completely separate function.

### 4.4 New Supabase edge function — `printful-webhook`

Handles Printful webhook events:

- `package_shipped` → update `orders.fulfillment_status`, `tracking_number`, `tracking_url`, send shipping email
- `order_updated` → update `orders.fulfillment_status`

Printful webhooks use HMAC-SHA256 signature verification (similar to Stripe). The secret is set as a Supabase edge function secret `PRINTFUL_WEBHOOK_SECRET`.

**Risk:** Zero impact on existing `printify-webhook`. Completely separate function.

### 4.5 `stripe-webhook` edge function — fulfillment routing

This is the only existing file that needs modification. Currently it unconditionally submits every order to Printify. It needs to route based on `fulfillment_provider`:

```ts
// CURRENT (simplified):
if (printifyToken && printifyShopId) {
  // submit all items to Printify
}

// AFTER:
const printifyItems = items.filter(i => i.fulfillment_provider === 'printify' || i.printify_id);
const printfulItems = items.filter(i => i.fulfillment_provider === 'printful' || i.printful_id);

if (printifyItems.length && printifyToken && printifyShopId) {
  // submit printify items — existing code unchanged
}

if (printfulItems.length && printfulToken) {
  // submit printful items — new code
}
```

**Risk:** Low. The existing Printify submission block is unchanged. The new Printful block only runs when `printful_id` is present on an item. A mixed cart (Printify + Printful items) generates two separate fulfillment orders.

### 4.6 `stripe-checkout` edge function — shipping cost

Currently calls Printify's shipping API for all items. Needs to split by provider:

```ts
// Get shipping cost per provider, sum them
const printifyShipping = await getPrintifyShipping(printifyItems);
const printfulShipping = await getPrintfulShipping(printfulItems);
const totalShipping = printifyShipping + printfulShipping;
```

**Risk:** Low. The fallback to `default_shipping_cost` is preserved. If Printful shipping API fails, it falls back to the DB-cached `shipping_info` value.

### 4.7 Admin panel — product sync UI

Add a "Sync from Printful" button to `/admin/products` alongside the existing "Sync from Printify" button. The button calls the new `printful-proxy/sync` endpoint.

The product list already shows all products regardless of provider. No changes needed to the product table display — `fulfillment_provider` can be shown as a badge.

**Risk:** Zero. Additive UI change only.

### 4.8 Admin settings — Printful connection

Add a Printful section to `/admin/settings` (Integrations tab) similar to the existing Printify section:

- API token input (stored as Supabase secret `PRINTFUL_API_TOKEN`)
- Store ID input (stored in `settings.printful_store_id`)
- Connection test button
- Webhook registration button

Requires one new column in the `settings` table:

```sql
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS printful_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printful_store_id text;
```

### 4.9 `next.config.mjs` — remotePatterns

Printful product images are served from:
- `files.cdn.printful.com`
- `ucarecdn.com` (Uploadcare CDN used by Printful)

Add both to the existing allowlist:

```js
{ protocol: 'https', hostname: 'files.cdn.printful.com' },
{ protocol: 'https', hostname: 'ucarecdn.com' },
```

**Risk:** Zero. Additive change to the allowlist.

### 4.10 `src/lib/cart.tsx` — CartItem snapshot

The `addToCart` function builds the `CartItem` snapshot. Add `printful_id` and `fulfillment_provider` to the snapshot so the `stripe-webhook` can route correctly:

```ts
addToCart: (product, variant, quantity, personalization_text) =>
  dispatch({ type: "ADD", item: {
    ...existing fields...
    printful_id: product.printful_id ?? null,           // ADD
    fulfillment_provider: product.fulfillment_provider, // ADD
  }})
```

**Risk:** Low. The new fields are nullable. Existing Printify orders are unaffected because `printful_id` will be null for them.

---

## 5. What Does NOT Change

- Storefront pages (`/shop`, `/product/[id]`, homepage) — zero changes
- Checkout page — zero changes
- Cart UI — zero changes
- Stripe integration — zero changes to keys, webhooks, or session creation
- Existing Printify sync, proxy, and webhook — zero changes
- Database RLS policies — zero changes
- All existing orders — unaffected, `printful_id` is null for all of them
- `AppImage`, `ProductCard`, `ProductDetailClient` — zero changes

---

## 6. New Environment Variables / Secrets Required

| Variable | Where stored | Purpose |
|---|---|---|
| `PRINTFUL_API_TOKEN` | Supabase edge function secret | Printful API authentication |
| `PRINTFUL_WEBHOOK_SECRET` | Supabase edge function secret | Webhook signature verification |
| `PRINTFUL_STORE_ID` | Supabase edge function secret + `settings` table | Printful store identifier |

No new `NEXT_PUBLIC_*` variables needed — Printful is server-side only.

---

## 7. Implementation Order

Implement in this exact sequence to avoid breaking anything at each step:

### Step 1 — Database migration (safe, no code changes needed)
- Add `fulfillment_provider`, `printful_id` to `products`
- Add `printful_connected`, `printful_store_id` to `settings`
- Backfill existing products with `fulfillment_provider = 'printify'` or `'manual'`

### Step 2 — TypeScript types
- Add `fulfillment_provider` and `printful_id` to `Product` and `CartItem` interfaces
- Build passes, no runtime changes yet

### Step 3 — `printful-proxy` edge function
- New file, no existing code touched
- Test sync independently before wiring into admin UI

### Step 4 — `printful-webhook` edge function
- New file, no existing code touched
- Register webhook URL in Printful dashboard

### Step 5 — `next.config.mjs` remotePatterns
- Add Printful CDN hostnames
- Rebuild and deploy

### Step 6 — Admin UI additions
- "Sync from Printful" button in `/admin/products`
- Printful connection section in `/admin/settings`
- Rebuild and deploy
- Test sync: verify Printful products appear in DB with `fulfillment_provider = 'printful'`

### Step 7 — `cart.tsx` snapshot update
- Add `printful_id` and `fulfillment_provider` to CartItem snapshot
- Rebuild and deploy

### Step 8 — `stripe-checkout` shipping routing
- Split shipping calculation by provider
- Test with a Printful-only cart and a mixed cart

### Step 9 — `stripe-webhook` fulfillment routing
- Add Printful order submission block
- Test end-to-end in Stripe test mode with a Printful product

### Step 10 — Production verification
- Place a test order with a Printful product
- Confirm Printful order appears in Printful dashboard
- Confirm tracking webhook updates the order in Supabase

---

## 8. Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| DB migration (add columns) | None | Nullable columns with defaults never break existing queries |
| New edge functions | None | Completely isolated from existing functions |
| `stripe-webhook` routing | Low | Printify block unchanged; Printful block only runs when `printful_id` present |
| `stripe-checkout` shipping | Low | Fallback to `default_shipping_cost` preserved |
| `cart.tsx` snapshot | Low | New fields are nullable; existing Printify carts unaffected |
| Mixed cart (both providers) | Medium | Two separate fulfillment orders created; test thoroughly |
| `next.config.mjs` | None | Additive allowlist change |

---

## 9. Mixed Cart Behavior

A customer can add a Printify product and a Printful product to the same cart. This is supported:

```
Cart: [Printify T-shirt, Printful hoodie]
  ↓
stripe-checkout:
  - Shipping = Printify shipping + Printful shipping
  - Single Stripe session with both line items

Customer pays
  ↓
stripe-webhook:
  - Creates Printify order for the T-shirt
  - Creates Printful order for the hoodie
  - Both printify_order_id and printful_order_id stored on the order row
    (requires adding printful_order_id column to orders table — see Step 1)

Tracking:
  - Printify webhook updates tracking when T-shirt ships
  - Printful webhook updates tracking when hoodie ships
  - Customer may receive two separate shipments
```

The customer-facing order tracking page (`/track`) shows whatever tracking info is in the DB. If two shipments exist, both tracking numbers should be displayed. This requires a minor update to the order tracking UI.

---

## 10. Printful API Reference — Key Endpoints

```
Base URL: https://api.printful.com
Auth: Authorization: Bearer <PRINTFUL_API_TOKEN>

Product sync:
  GET  /store/products              — list sync products
  GET  /store/products/{id}         — get product detail with variants

Shipping:
  POST /shipping/rates              — calculate shipping
  Body: { recipient: {address1, city, state_code, country_code, zip},
          items: [{variant_id, quantity}] }

Orders:
  POST /orders                      — create order
  GET  /orders/{id}                 — get order status

Webhooks:
  POST /webhooks                    — register webhook URL
  Events: package_shipped, order_updated, order_canceled

Webhook payload verification:
  X-PF-Signature header (HMAC-SHA256 of raw body with PRINTFUL_WEBHOOK_SECRET)
```

---

## 11. Printful Variant Mapping

Printful's variant structure differs from Printify's. The sync function needs to map it correctly:

```
Printful sync_variant:
{
  id: 123456789,           ← this is the sync_variant_id (store-specific)
  variant_id: 4011,        ← this is the catalog variant_id (used for orders)
  name: "Black / S",
  retail_price: "29.99",
  files: [{ type: "preview", preview_url: "https://..." }]
}

Maps to ProductVariant:
{
  id: "4011",              ← use variant_id (catalog), not sync variant id
  label: "Black / S",
  color: "Black",          ← parse from name
  size: "S",               ← parse from name
  price: 29.99,
  image_url: "https://..."
}
```

Color and size are parsed from the variant `name` field (format: "Color / Size"). This is less structured than Printify's `options[]` system but workable.

---

## 12. Questions to Resolve Before Implementation

1. **Do you have a Printful account and API token?** The integration requires a Printful account with products already created in their dashboard.

2. **Will Printful products replace some Printify products, or run alongside them?** If replacing, the old Printify products should be archived (not deleted) to preserve order history.

3. **Do you want a mixed cart (both providers in one order)?** This works but results in two separate shipments. Some stores prefer to keep providers separate. If you want to prevent mixed carts, a cart validation step can be added.

4. **Printful store ID:** Printful uses a store ID in some API calls. Confirm your store ID from the Printful dashboard → Settings → Stores.

5. **Webhook URL:** The Printful webhook will be registered at:
   `https://<project-ref>.supabase.co/functions/v1/printful-webhook`
   Confirm this is accessible from Printful's servers.

---

## 13. Files to Create / Modify Summary

| File | Action | Risk |
|---|---|---|
| `supabase/migrations/YYYYMMDD_add_printful.sql` | Create | None |
| `supabase/functions/printful-proxy/index.ts` | Create | None |
| `supabase/functions/printful-webhook/index.ts` | Create | None |
| `src/types.ts` | Modify — add 2 fields | None |
| `src/lib/cart.tsx` | Modify — add 2 fields to snapshot | Low |
| `supabase/functions/stripe-checkout/index.ts` | Modify — split shipping by provider | Low |
| `supabase/functions/stripe-webhook/index.ts` | Modify — add Printful fulfillment routing | Low |
| `next.config.mjs` | Modify — add 2 CDN hostnames | None |
| `src/app/admin/products/page.tsx` | Modify — add Sync from Printful button | None |
| `src/app/admin/settings/sections/Integrations.tsx` | Modify — add Printful connection UI | None |
| `src/app/track/page.tsx` | Modify — show multiple tracking numbers | None |

**Files that do NOT change:**
- All storefront pages (`/shop`, `/product/[id]`, homepage, checkout)
- `supabase/functions/printify-proxy/index.ts`
- `supabase/functions/printify-webhook/index.ts`
- `src/app/api/**` (all API routes)
- `src/components/**` (all UI components)
- `next.config.mjs` image formats/TTL/sizes (already optimized)
- All Stripe configuration
