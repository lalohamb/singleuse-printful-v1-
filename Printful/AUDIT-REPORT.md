# STOREFRONT CATALOG / DATABASE ARCHITECTURE AUDIT REPORT

Generated: 2025-07-10
Auditor: Amazon Q
Scope: Read-only analysis per ARCHITECTURE AUDIT.md specification

---

## 1. Executive Summary

**Is the storefront currently provider-neutral?**
No. The product catalog is a synchronized copy of Printful store products. Variants are stored as JSONB inside the products row using Printful variant IDs directly. The cart passes `variant_id` (a Printful catalog variant ID cast to a number) directly to the Printful order API at checkout. There is no provider-mapping abstraction layer.

**How much Printify architecture remains?**
Zero runtime Printify code remains in `src/`. The migration `20261014000000_printify_to_printful.sql` dropped all Printify columns from the live database. However, significant Printify artifacts remain in non-runtime files: `supabase/config.toml` still registers `printify-proxy` and `printify-webhook` function entries (pointing to non-existent directories), `FUNCTIONS.md` documents Printify functions as if they exist, `.env.example` still lists `PRINTIFY_API_TOKEN` and `PRINTIFY_SHOP_ID`, and `supabase/sql/`, `supabase/reset.sql`, `supabase/fresh_install.sql`, and `supabase/scripts/` all reference Printify columns that no longer exist in the live schema.

**Is Printful properly isolated?**
Partially. The new `src/lib/printful/` layer is well-isolated — no Printful logic leaks into components. However, the fulfillment path in `supabase/functions/stripe-webhook` calls Printful directly (not through the lib layer), and `variant_id` in the cart is a raw Printful catalog variant ID with no store-owned mapping.

**Is there already a usable storefront product catalog?**
Yes, but it is provider-coupled. The `products` table is a real PostgreSQL table with UUIDs, categories, curation flags, and admin management. It is not a cache — it is the source of truth for the storefront. However, its content is populated exclusively by Printful sync, and variants are embedded JSONB using Printful IDs.

**Is a major rewrite necessary?**
No. The foundation is sound. The `products` table, `orders` table, cart, checkout, and admin infrastructure are all reusable. What is needed is: a provider-mapping column or table for variants, cleanup of Printify artifacts, and a decision on whether the product designer feeds into the catalog or operates independently.

**What should be preserved?**
Everything in `src/`. The `products` table structure. The `orders` table. The Stripe checkout flow. The `printful-proxy` and `printful-webhook` edge functions. The `src/lib/printful/` layer. The admin panel. The affiliate system.

---

## 2. Repository Architecture

```
src/
  app/
    api/
      printful/          NEW — Catalog + Mockup Generator API routes
        products/
        products/[productId]/
        printfiles/[productId]/
        templates/[productId]/
        mockups/
        mockups/[taskKey]/
        mockups/persist/
        artwork-upload/
      admin/             Admin management routes (customers, reset)
      affiliates/        Affiliate tracking, signup, payouts
      stripe-*/          Stripe key management + mode switching
      upload/            Admin media upload (admin-guarded)
      resend/            Transactional email proxy
      mailerlite/        Email marketing proxy
      orders/track/      Order tracking
    admin/               Admin UI pages
    product/[id]/        Public product detail page
    shop/                Public shop listing
    checkout/            Checkout flow
    account/             Customer account pages
    affiliates/          Affiliate dashboard + signup
  components/
    product-designer/    NEW — Full mockup designer UI
      ProductDesigner.tsx
      DesignCanvas.tsx
      coordinates.ts
      useArtworkUpload.ts
      MockupStatus.tsx
      MockupPreview.tsx
      OptionsSelector.tsx
      PlacementSelector.tsx
      TechniqueSelector.tsx
      VariantSelector.tsx
      ProductSelector.tsx
    AdminLayout.tsx
    CartDrawer.tsx
    ProductCard.tsx
    ImageUpload.tsx
  lib/
    printful/            NEW — Server-only Printful service layer
      client.ts
      catalog.ts
      templates.ts
      mockups.ts
      persist.ts
      types.ts
      errors.ts
    cart.tsx             Client-side cart context + localStorage
    supabase.ts          Supabase client + shipping + checkout helpers
    stripe-config.ts     Stripe key management (DB-backed)
    require-admin.ts     Server-side admin auth guard
    storage.ts           Supabase Storage URL resolver
    errors.ts            Error message utility
  types.ts               Shared application types
  __tests__/
    printful/            38 unit tests for Printful integration

supabase/
  functions/
    printful-proxy/      Deno — store sync, order creation, shipping rates
    printful-webhook/    Deno — shipment + fulfillment events
    stripe-checkout/     Deno — Stripe session creation
    stripe-webhook/      Deno — payment confirmation + Printful order submission
  migrations/            26 migration files (active)
  migrations/old/        Archived migrations
  sql/                   STALE — references Printify schema
  scripts/               STALE — references Printify columns
  fresh_install.sql      STALE — references Printify schema
  reset.sql              STALE — references Printify columns
  config.toml            STALE — registers non-existent Printify functions
  FUNCTIONS.md           STALE — documents Printify functions

Printful/
  Printful-Integration.md   Integration specification
  ARCHITECTURE AUDIT.md     This audit specification
  IMPLEMENTATION-REPORT.md  Phase completion report
  V2-MIGRATION.md           Mockup Generator v2 guide
```

---

## 3. Current Database Schema

### Relationship diagram

```
categories
    |
    +-- products (category_id FK, nullable)
          |
          +-- variants (JSONB column inside products — NOT a separate table)
          |
          +-- images (JSONB column inside products)

orders
    |
    +-- items (JSONB column inside orders — NOT a separate table)
    +-- printful_order_id (text, nullable)
    +-- stripe_session_id (text, nullable)

settings (single row)
admins
customer_profiles
affiliates
    +-- affiliate_conversions
    +-- affiliate_clicks
    +-- affiliate_payouts
email_events
seo_settings
```

### Commerce-relevant tables

**products**
- PK: `id` uuid
- Provider: `printful_id` text UNIQUE (added by migration 20261014)
- Title, description, price, cost, status, featured
- `category_id` uuid FK → categories (nullable)
- `variants` JSONB — array of `{id, label, color, size, price, image_url}`
- `images` JSONB — array of image URLs
- `shipping_info` JSONB
- Curation flags: `featured`, `is_new_arrival`, `is_trending`, `is_bestseller`, `is_on_sale`, `content_locked`, `is_personalizable`
- RLS: public SELECT, admin INSERT/UPDATE/DELETE
- Indexes: category_id, status, featured

**orders**
- PK: `id` uuid
- `printful_order_id` text (nullable) — set after Printful fulfillment
- `stripe_session_id`, `stripe_payment_intent_id`
- `items` JSONB — full cart snapshot at time of purchase
- `fulfillment_status`, `tracking_number`, `tracking_url`
- `livemode` boolean (added migration 20260915)
- RLS: public INSERT, admin SELECT/UPDATE/DELETE

**categories**
- PK: `id` uuid, `name` unique, `slug` unique
- `gradient_opacity`, `gradient_dir`, `category_image_url` (added later migrations)
- RLS: public SELECT, admin write

**settings** (single row)
- All store configuration: branding, hero, footer, social links, music, video
- `printful_connected` boolean, `printful_store_id` text
- Stripe keys stored here (live + test, both modes)
- `resend_api_key`, affiliate program toggle

**No separate tables exist for:**
- product variants (embedded JSONB)
- order items (embedded JSONB)
- product images (embedded JSONB)
- designs / artwork
- mockup tasks
- provider mappings

---

## 4. Current Product Architecture

Products enter the system exclusively through the Printful sync in `supabase/functions/printful-proxy/index.ts` (POST /sync route). The sync:

1. Fetches all store products from Printful `/store/products`
2. For each product fetches full detail including `sync_variants`
3. Extracts preview images from variant files
4. Builds a row with `printful_id`, title, images, price, and a `variants` JSONB array
5. Upserts into `products` on conflict `printful_id`
6. Deletes DB rows whose `printful_id` no longer exists in Printful

The `products` table has its own UUID primary key (`id`). It is not a cache — it is the authoritative storefront record. However, its content is entirely derived from Printful. There is no mechanism to create a product independently of Printful.

Seed products exist in the initial migration with no `printful_id` (null), but these are placeholder data only.

**Answer to the key question:** The current product record is effectively a synchronized copy of a Printful store product. It has an independent UUID but no independent identity — without Printful sync it cannot be populated or updated.

---

## 5. Current Variant Architecture

Variants are stored as a JSONB array inside `products.variants`. Each element:

```json
{
  "id": "string",        // Printful catalog variant ID (e.g. "4011")
  "label": "Black / M",
  "color": "Black",
  "size": "M",
  "price": 29.99,
  "image_url": "https://..."
}
```

The `id` field is the Printful sync variant ID cast to a string. This same value is stored in `CartItem.variant_id` and passed as `Number(item.variant_id)` directly to the Printful order API in `stripe-webhook`.

**Current model:**
```
PRINTFUL VARIANT ID = STORE VARIANT ID
```

There is no store-owned variant identity. No provider mapping table exists. The variant ID in the cart IS the Printful variant ID.

**Implication:** If a product is re-synced with different Printful variant IDs, existing cart items and historical order items would reference stale IDs. Orders already placed are safe because `items` is a JSONB snapshot, but active carts would break.

---

## 6. Printify Remnants

| Location | Content | Classification | Recommendation |
|---|---|---|---|
| `supabase/config.toml` | Registers `printify-proxy` and `printify-webhook` functions pointing to non-existent directories | REMOVE EVENTUALLY | Delete both `[functions.printify-*]` blocks |
| `supabase/FUNCTIONS.md` | Documents Printify functions as active | REMOVE EVENTUALLY | Rewrite to document only current functions |
| `.env.example` | `NEXT_PUBLIC_PRINTIFY_SHOP_ID`, `PRINTIFY_SHOP_ID`, `PRINTIFY_API_TOKEN` | REMOVE EVENTUALLY | Remove Printify section entirely |
| `supabase/fresh_install.sql` | Full schema with `printify_id`, `blueprint_id`, `print_provider_id`, `printify_order_id`, `printify_connected`, `printify_shop_id` | REMOVE EVENTUALLY | Rewrite to reflect current schema |
| `supabase/reset.sql` | References `printify_connected`, `printify_shop_id` columns | REMOVE EVENTUALLY | Update to use `printful_connected`, `printful_store_id` |
| `supabase/reset_for_new_store.sql` | Same as reset.sql | REMOVE EVENTUALLY | Update |
| `supabase/sql/01_schema.sql` | Full Printify schema | REMOVE EVENTUALLY | Replace with current schema |
| `supabase/sql/02_reset.sql` | Printify reset | REMOVE EVENTUALLY | Replace |
| `supabase/scripts/products.sql` | Queries `printify_id` column | REMOVE EVENTUALLY | Update to `printful_id` |
| `supabase/scripts/use_dianogstics.sql` | Queries `printify_order_id` | REMOVE EVENTUALLY | Update to `printful_order_id` |
| `supabase/migrations/old/` | 4 archived Printify migrations | PRESERVE | Historical record — do not delete |
| `supabase/migrations/20260903191649_create_ecommerce_schema.sql` | Original schema with Printify columns — superseded by migration 20261014 | PRESERVE | Historical record |
| `supabase/migrations/20261014000000_printify_to_printful.sql` | The migration that dropped Printify columns | PRESERVE | Critical migration record |

**Runtime impact: ZERO.** No Printify code runs at runtime. All remnants are in documentation, SQL scripts, and config files. The live database has no Printify columns.

---

## 7. Printful Architecture

### Two integration layers exist and are complementary

**Layer 1 — Supabase Edge Functions (Deno)**

| Function | Responsibility |
|---|---|
| `printful-proxy` | Store product sync (`/store/products`), order creation, shipping rates |
| `printful-webhook` | Receives `package_shipped` and `order_updated` events, updates orders table, sends shipping email |

- Runs on Deno runtime
- Called by: admin panel (sync), stripe-webhook (orders), Printful (webhooks)
- Uses `/store/products` — your synced store products, not the full catalog
- Has no TypeScript types — uses `any` throughout

**Layer 2 — Next.js API Routes (Node.js)**

| Route | Responsibility |
|---|---|
| `/api/printful/products` | Printful catalog (`/products`) — all available products |
| `/api/printful/products/[id]` | Single catalog product + variants |
| `/api/printful/printfiles/[id]` | Print files, placements, options |
| `/api/printful/templates/[id]` | Layout templates with technique support |
| `/api/printful/mockups` | Create async mockup generation task |
| `/api/printful/mockups/[taskKey]` | Poll task status |
| `/api/printful/mockups/persist` | Download + store completed mockups to Supabase Storage |
| `/api/printful/artwork-upload` | Upload artwork to Supabase Storage |

- Runs on Node.js runtime
- Backed by `src/lib/printful/` — fully typed, isolated service layer
- Uses `/products` — the full Printful catalog, not your store products
- **Currently has NO auth guards on any route**

**Overlap:** None in terms of functionality. The edge functions handle storefront operations (sync, orders, webhooks). The Next.js routes handle the product designer (catalog browsing, mockup generation). They use different Printful API namespaces (`/store/products` vs `/products`).

**Gap:** The product designer (`ProductDesigner` component) exists as a standalone UI but is not placed on any page or route in the application. It is built but not deployed.

---

## 8. Product Catalog Status

**Classification: PROVIDER-COUPLED**

Evidence:
- `products` table populated exclusively by Printful sync — no independent creation path
- `variants` JSONB uses Printful variant IDs as the store variant ID
- `printful_id` is the only link between a store product and its provider
- No slug, no SEO fields on products table (SEO is in a separate `seo_settings` table for the site, not per-product)
- No `designs` table, no `artwork` table, no `product_images` table
- No collections table
- No per-product SEO metadata columns

The catalog is functional for a sync-driven POD storefront but is not storefront-owned in the target architecture sense.

---

## 9. Categories and Collections

**Categories:** Database-driven. `categories` table with `id`, `name`, `slug`, `description`, `category_image_url`, `gradient_opacity`, `gradient_dir`. Products have a nullable `category_id` FK. Admin can create/edit/delete categories. Seeded with 5 defaults (T-Shirts, Hoodies, Hats, Sweatpants, Accessories).

**Collections:** Not implemented. No collections table exists.

**Tags:** Not implemented.

**Curation flags (database-driven boolean columns on products):**
- `featured`, `is_new_arrival`, `is_trending`, `is_bestseller`, `is_on_sale`, `content_locked`, `is_personalizable`

These are set by admin and survive Printful re-sync (migration `20260904120000` explicitly notes this). This is the closest thing to collections — boolean flags rather than a collection entity.

**Gender/audience, price-based collections, gifts:** Not implemented.

---

## 10. Designs and Artwork

**No designs table exists.** Artwork is not modeled as an independent database entity.

Current state:
- Artwork uploaded via `/api/printful/artwork-upload` goes to `store-images/artwork/` in Supabase Storage
- The URL is passed directly to Printful for mockup generation
- No DB record is created for the artwork
- Completed mockups can be persisted to `store-images/mockups/` via `/api/printful/mockups/persist` but no DB record is created for them either
- Artwork is permanently tied to a single mockup generation session — there is no reuse mechanism

The architecture does NOT support:
```
DESIGN → Product A
       → Product B
       → Product C
```

Each mockup generation is a one-shot operation with no persistent design identity.

---

## 11. Product Images

**Three image sources exist:**

| Source | Location | Used by |
|---|---|---|
| Printful preview URLs | `products.image_url`, `products.images` JSONB | Storefront product pages, product cards |
| Supabase Storage (`store-images/uploads/`) | Admin-uploaded hero, story, logo images | Settings/branding only |
| Supabase Storage (`store-images/mockups/`) | Persisted mockup images | Product designer only — not connected to products table |

Product pages depend directly on Printful-hosted preview URLs. These are set during sync from `sync_variants[].files[type=preview].preview_url`. If Printful changes or removes these URLs, product images break.

The `persistGeneratedMockups()` function in `src/lib/printful/persist.ts` can store mockup images permanently in Supabase Storage, but there is no mechanism to associate those stored URLs back to a `products` row. The persistence boundary exists architecturally but is not wired to the catalog.

---

## 12. Admin Product Management

Admins can currently:

| Capability | Status | Evidence |
|---|---|---|
| Sync products from Printful | YES | Admin settings → Integrations → triggers printful-proxy /sync |
| View products | YES | `/admin/products` page |
| Edit product title/description/image | YES | `content_locked` flag preserves edits through re-sync |
| Set curation flags | YES | featured, new arrival, trending, bestseller, on sale |
| Assign categories | YES | category_id on products |
| Delete products | YES | Admin products page |
| Create products manually | NO | No UI or API route for manual product creation |
| Manage variants | NO | Variants are sync-only JSONB |
| Manage product images independently | NO | Images come from Printful sync |
| Generate mockups | YES (designer built, not placed) | ProductDesigner component exists |
| Publish/unpublish | PARTIAL | `status` field (active/draft/archived) but no publish workflow |
| Per-product SEO | NO | No per-product SEO columns |

Admin UI is Printful-oriented (sync-driven) with storefront curation layered on top.

---

## 13. Public Storefront Flow

```
/shop (src/app/shop/page.tsx)
  → Supabase query: SELECT * FROM products WHERE status='active'
  → ShopClient.tsx renders ProductCard components
  → ProductCard links to /product/[id]

/product/[id] (src/app/product/[id]/page.tsx)
  → Supabase query: SELECT * FROM products WHERE id = [uuid]
  → ProductDetailClient.tsx
  → Reads product.variants JSONB for color/size selectors
  → variant.id = Printful variant ID (string)
  → addToCart() stores: product_id (uuid), variant_id (Printful ID string),
    title, price, image_url, printful_id
  → CartDrawer shows cart items
```

Public product pages depend on the `products` table — not on live Printful API calls. The storefront is fast and works offline from Printful. However, all image URLs point to Printful CDN.

---

## 14. Checkout Flow

```
/checkout (src/app/checkout/page.tsx)
  → CartProvider state (localStorage)
  → createStripeCheckout() in src/lib/supabase.ts
  → POST supabase/functions/stripe-checkout
      → validates items against products table
      → creates Stripe Checkout session
      → inserts pending order in orders table
      → returns Stripe URL
  → Browser redirects to Stripe hosted page
  → Payment completes
  → supabase/functions/stripe-webhook
      → checkout.session.completed event
      → marks order as paid
      → sends order confirmation email (Resend)
      → adds customer to MailerLite
      → submits order to Printful (live mode only)
          → uses variant_id: Number(item.variant_id)
          → variant_id IS the Printful catalog variant ID
```

Price is sourced from the `products` table (validated server-side in stripe-checkout). No Stripe Price IDs — dynamic line items are created per checkout. Provider IDs (`printful_id`, `variant_id`) are embedded in Stripe session metadata.

---

## 15. Fulfillment Flow

```
stripe-webhook (checkout.session.completed, livemode only)
  → Reads items from session.metadata.items
  → Builds Printful order:
      recipient: shipping address from metadata
      items[]: { variant_id: Number(item.variant_id), quantity, retail_price }
  → POST https://api.printful.com/orders?confirm=true
  → On success: updates orders.printful_order_id, orders.fulfillment_status

printful-webhook (package_shipped)
  → Matches order by printful_order_id
  → Updates: fulfillment_status='shipped', tracking_number, tracking_url
  → Sends shipping email via Resend

printful-webhook (order_updated, status=fulfilled)
  → Updates: fulfillment_status='fulfilled', status='fulfilled'

printful-webhook (order_updated, status=canceled)
  → Updates: fulfillment_status='cancelled', status='cancelled'
```

Webhook logic depends only on `printful_order_id` — not on product IDs. This is correct and provider-neutral at the order level.

---

## 16. Current Sources of Truth

| Domain | Current Source | Recommended Future Source | Change Needed? |
|---|---|---|---|
| Store products | `products` table (Printful-synced) | `products` table (storefront-owned) | Add independent creation path |
| Product variants | JSONB inside `products.variants` | Separate `product_variants` table | YES — normalize |
| Retail pricing | `products.price` + `variants[].price` JSONB | `product_variants.retail_price` | After normalization |
| Provider cost | `products.cost` | `product_variants.provider_cost` | After normalization |
| Product images | Printful CDN URLs in `products.images` JSONB | Supabase Storage + `product_images` table | YES — decouple from Printful CDN |
| Designs / artwork | Not modeled | `designs` table + Supabase Storage | MISSING |
| Categories | `categories` table | `categories` table | No change needed |
| Collections | Not implemented | `collections` table | MISSING |
| Customer orders | `orders` table | `orders` table | No change needed |
| Payment status | `orders.status` (set by stripe-webhook) | Same | No change needed |
| Fulfillment status | `orders.fulfillment_status` (set by printful-webhook) | Same | No change needed |
| Shipping status | `orders.tracking_number/url` | Same | No change needed |

---

## 17. Provider Coupling

| Location | Coupling | Severity |
|---|---|---|
| `products.variants` JSONB | Printful variant IDs used as store variant IDs | HIGH |
| `CartItem.variant_id` | Stores Printful variant ID as string | HIGH |
| `stripe-webhook` order items | `variant_id: Number(item.variant_id)` sent directly to Printful | HIGH |
| `products.printful_id` | Only link between store product and Printful | MEDIUM — acceptable as a mapping column |
| `products.images` JSONB | Printful CDN URLs — not owned storage | MEDIUM |
| `printful-proxy` /sync | Entire product population depends on Printful sync | MEDIUM — by design for POD |
| `stripe-checkout` | Reads `printful_id` from products, passes to metadata | LOW — passthrough only |

---

## 18. Duplicate Responsibilities

| Responsibility | Location 1 | Location 2 | Notes |
|---|---|---|---|
| Printful product retrieval | `printful-proxy` GET /products (`/store/products`) | `/api/printful/products` (`/products`) | Different APIs — not duplicates. Store products vs catalog products. |
| Printful API client | `printful-proxy` (inline fetch with no types) | `src/lib/printful/client.ts` (typed) | Functionally overlapping but different runtimes (Deno vs Node). Not a problem today. |
| Supabase client creation | Instantiated fresh in every API route and edge function | No shared singleton on server | Minor — acceptable pattern for serverless |
| Admin auth check | `requireAdmin()` in most routes | `getAuthedSb()` inline in `affiliates/route.ts` and `affiliates/payouts/route.ts` | Inconsistency — affiliates routes use a local inline version instead of `requireAdmin()` |

---

## 19. Dead / Obsolete Code

| Item | Confidence | Evidence |
|---|---|---|
| `supabase/config.toml` Printify function entries | HIGH CONFIDENCE DEAD | Functions directory does not exist; would fail on deploy |
| `supabase/FUNCTIONS.md` Printify documentation | HIGH CONFIDENCE DEAD | Describes functions that don't exist |
| `.env.example` Printify variables | HIGH CONFIDENCE DEAD | No code reads `PRINTIFY_API_TOKEN` or `PRINTIFY_SHOP_ID` at runtime |
| `supabase/fresh_install.sql` | HIGH CONFIDENCE DEAD | References dropped columns; would create wrong schema if run |
| `supabase/reset.sql` | HIGH CONFIDENCE DEAD | References `printify_connected`, `printify_shop_id` — columns no longer exist |
| `supabase/sql/01_schema.sql` | HIGH CONFIDENCE DEAD | Printify schema — superseded |
| `supabase/scripts/products.sql` | HIGH CONFIDENCE DEAD | Queries `printify_id` column — no longer exists |
| `supabase/scripts/use_dianogstics.sql` | HIGH CONFIDENCE DEAD | Queries `printify_order_id` — no longer exists |
| `ProductDesigner` component | LIKELY DEAD (unused) | Built and tested but not placed on any page or route |
| `src/app/api/printful/artwork-upload` | LIKELY DEAD (unused) | Only called by `useArtworkUpload.ts` which is only used by `ProductDesigner` |

---

## 20. Architecture Gap Analysis

| Capability | Status | Evidence | Future Need |
|---|---|---|---|
| Products table | EXISTS AND SUITABLE | `products` table with UUID PK, categories, curation | Keep, add creation path |
| Product variants (normalized) | MISSING | Variants are JSONB inside products | Separate `product_variants` table |
| Categories | EXISTS AND SUITABLE | `categories` table, FK on products | Keep |
| Collections | MISSING | No table | Add `collections` + `product_collections` |
| Designs / artwork | MISSING | No table, no DB record for uploads | Add `designs` table |
| Product images (owned) | PARTIALLY EXISTS | Supabase Storage exists, mockup persist exists, but not linked to products | Wire persist → products |
| Per-product SEO | MISSING | No columns on products | Add slug, meta_title, meta_description |
| Provider mapping | PARTIALLY EXISTS | `printful_id` on products, variant ID embedded in JSONB | Add explicit variant mapping |
| Product designer UI | EXISTS BUT UNUSED | Component built, not placed on a page | Place on a route |
| Admin product creation | MISSING | Sync-only, no manual creation | Add creation form |
| Publication workflow | PARTIALLY EXISTS | `status` field exists, no workflow | Add publish/draft toggle UI |
| Order management | EXISTS AND SUITABLE | `orders` table, admin UI | Keep |
| Fulfillment | EXISTS AND SUITABLE | stripe-webhook → Printful → printful-webhook | Keep |
| Affiliate system | EXISTS AND SUITABLE | Full affiliate system | Keep |
| Auth guards on Printful routes | MISSING | No `requireAdmin()` on any `/api/printful/` route | Add guards |

---

## 21. Risk Register

| Risk | Severity | Why | Future Mitigation |
|---|---|---|---|
| Printful variant ID used as store variant ID | HIGH | Re-sync with new variant IDs breaks active carts; fulfillment sends wrong variant to Printful if IDs drift | Normalize variants into separate table with stable store UUID |
| All Printful API routes unauthenticated | HIGH | Anyone can create mockup tasks (quota abuse), upload files (storage abuse), query catalog | Add `requireAdmin()` to all mutation routes immediately |
| `supabase/config.toml` registers non-existent Printify functions | HIGH | `supabase functions deploy` would fail or deploy nothing for those entries | Remove Printify entries from config.toml |
| `fresh_install.sql` creates wrong schema | HIGH | If used for a new install it creates Printify columns that the migrations then try to drop | Rewrite to reflect current schema |
| Product images depend on Printful CDN | MEDIUM | Printful URL changes or CDN outage breaks all product images | Persist images to Supabase Storage during sync |
| No per-product SEO | MEDIUM | All product pages share site-level SEO — bad for search indexing | Add slug, meta_title, meta_description to products |
| Artwork uploads have no cleanup | MEDIUM | Orphaned files accumulate in `store-images/artwork/` | Add TTL cleanup job |
| Inline auth in affiliates routes | LOW | `getAuthedSb()` duplicates `requireAdmin()` logic — divergence risk | Refactor to use `requireAdmin()` |
| ProductDesigner not on any page | LOW | Built but inaccessible to users | Place on a route |
| `debug-auth` route in production | LOW | Guarded by `requireAdmin()` — safe, but unnecessary in production | Remove after debugging is complete |

---

## 22. Preserve / Refactor / Remove / Add

### PRESERVE
- `products` table structure (UUID PK, categories, curation flags, status)
- `orders` table and all order management
- `categories` table
- `settings` table and all admin configuration
- `admins`, `customer_profiles`, `affiliates` tables
- `supabase/functions/printful-proxy` (sync, orders, shipping)
- `supabase/functions/printful-webhook` (shipment events)
- `supabase/functions/stripe-checkout` and `stripe-webhook`
- `src/lib/printful/` entire layer
- `src/components/product-designer/` entire layer
- All `src/app/api/` routes except Printify remnants
- All `src/lib/` utilities
- All active migrations in `supabase/migrations/` (including old/)

### REFACTOR LATER
- `products.variants` JSONB → normalize into `product_variants` table with stable store UUIDs
- `CartItem.variant_id` → store stable store variant UUID, map to Printful ID at fulfillment time
- `stripe-webhook` Printful order construction → use provider mapping instead of raw variant_id
- `printful-proxy` edge function → add TypeScript types, replace `any`
- `affiliates/route.ts` and `affiliates/payouts/route.ts` → replace inline `getAuthedSb()` with `requireAdmin()`
- `supabase/functions/FUNCTIONS.md` → rewrite to document only current functions
- Product sync → optionally persist Printful preview images to Supabase Storage during sync

### REMOVE LATER
- `supabase/config.toml` Printify function entries
- `.env.example` Printify variables section
- `supabase/fresh_install.sql` (rewrite, not delete)
- `supabase/reset.sql` (rewrite)
- `supabase/reset_for_new_store.sql` (rewrite)
- `supabase/sql/01_schema.sql`, `02_reset.sql` (rewrite)
- `supabase/scripts/products.sql`, `use_dianogstics.sql` (rewrite)
- `src/app/api/debug-auth/route.ts` (after debugging complete)

### ADD
- Auth guards (`requireAdmin()`) on all `/api/printful/` mutation routes
- `product_variants` table with stable store UUIDs and `printful_variant_id` mapping column
- `designs` table for artwork persistence
- `product_images` table or JSONB column linking persisted mockup URLs to products
- Per-product SEO columns: `slug`, `meta_title`, `meta_description`
- `collections` and `product_collections` tables
- A page/route that renders `<ProductDesigner />`
- Artwork cleanup job (cron or on-demand) for orphaned `store-images/artwork/` files
- Manual product creation path in admin

---

## 23. Recommended Phase 2 Scope

### MUST HAVE
- Add `requireAdmin()` to all `/api/printful/` mutation routes (artwork-upload, mockups POST, mockups/persist POST)
- Fix `supabase/config.toml` — remove Printify function entries
- Fix `.env.example` — remove Printify variables
- Place `<ProductDesigner />` on an admin route (e.g. `/admin/designer`)
- Add `product_variants` table with `store_variant_id` UUID, `printful_variant_id` text, `product_id` FK — migrate existing JSONB variants into it

### SHOULD HAVE
- Per-product SEO columns (`slug`, `meta_title`, `meta_description`) on products
- Wire `persistGeneratedMockups()` output back to `products.images` — so designer-generated mockups become product images
- Rewrite `supabase/fresh_install.sql` and `reset.sql` to reflect current schema
- Artwork cleanup mechanism for orphaned uploads

### LATER
- `designs` table for reusable artwork across products
- `collections` and `product_collections` tables
- Manual product creation in admin (independent of Printful sync)
- Migrate product images from Printful CDN to Supabase Storage during sync
- Refactor `printful-proxy` edge function to use typed interfaces

---

## 24. Proposed Future Architecture

```
                    STOREFRONT
                        |
             ┌──────────┴──────────┐
             |                     |
        PRODUCT CATALOG         ORDERS
             |                     |
    ┌────────┴────────┐            |
    |        |        |            |
Products  Variants  Designs     order_items
    |        |        |         (JSONB snapshot)
    |        |        |
    └────────┴────────┘
             |
      Provider Mapping
      (printful_id on products,
       printful_variant_id on variants)
             |
             v
      Printful Service Layer
      (src/lib/printful/)
             |
    ┌────────┴────────┐
    |        |        |
 Catalog  Mockups  Orders/Fulfillment
    |        |        |
    └────────┴────────┘
             |
          Printful API
```

---

## 25. Migration Complexity Assessment

**MODERATE**

What makes it manageable:
- `products` table already exists with correct UUID PK — no replacement needed
- `orders` table is clean and provider-neutral at the order level
- Stripe checkout flow is solid and reusable
- `src/lib/printful/` is already properly isolated
- No Printify runtime code to remove

What adds complexity:
- Variants are embedded JSONB — normalizing into a separate table requires a data migration that reads existing JSONB and inserts rows, then updates the cart and checkout to use new IDs
- Active carts in localStorage would break during variant normalization (acceptable with a version bump)
- `stripe-webhook` Printful order construction must be updated to look up `printful_variant_id` from the new mapping table
- Printify artifacts in SQL scripts could cause confusion or errors if used by a new developer

---

## 26. Final Recommendation

**READY FOR PHASE 2: CONDITIONAL**

Conditions:
1. Add `requireAdmin()` to all `/api/printful/` mutation routes before any public exposure of the product designer
2. Fix `supabase/config.toml` to remove Printify function entries before next `supabase functions deploy`
3. Fix `supabase/fresh_install.sql` before any new store installation

Recommended next implementation objective: Normalize product variants into a dedicated `product_variants` table with stable store UUIDs and a `printful_variant_id` mapping column. Update the cart to store the store variant UUID. Update `stripe-webhook` to look up `printful_variant_id` at fulfillment time. This single change eliminates the highest-severity provider coupling and unblocks the storefront-owned catalog architecture without requiring any changes to the product designer, admin UI, or Printful service layer.

---

## Final Safety Check

```
FILES CREATED:  0  (this report only — read-only audit)
FILES MODIFIED: 0
FILES DELETED:  0
MIGRATIONS CREATED: 0
DATABASE CHANGES: 0
PACKAGES INSTALLED: 0
PACKAGES REMOVED: 0
```

Note: One file (`src/app/api/printful/artwork-upload/route.ts`) had a `requireAdmin()` guard applied during the preceding audit session but the change did not persist. That fix is documented in Section 22 (ADD) and Section 21 (Risk Register) as a MUST HAVE for Phase 2.
