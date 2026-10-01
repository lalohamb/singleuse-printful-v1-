# PHASE 2 FOUNDATION REPORT

Generated: 2025-07-10

---

## 1. Executive Summary

Phase 2 establishes a storefront-owned variant identity and removes the highest-risk provider coupling identified in the architecture audit.

Before this phase, `variant_id` in the cart was a Printful numeric ID (e.g. `"4011"`) that flowed directly into the Printful order API at checkout. After this phase, `variant_id` in the cart is a stable store UUID (`product_variants.id`). Only at fulfillment does the backend resolve that UUID to `printful_variant_id` via a database lookup.

All eight `/api/printful/` routes are now protected with `requireAdmin()`. Stale Printify configuration artifacts have been removed from `supabase/config.toml` and `.env.example`.

---

## 2. Pre-Implementation Verification

Audit findings confirmed accurate at time of implementation:

- `products.variants` JSONB confirmed as sole variant source
- `CartItem.variant_id` confirmed as Printful numeric ID string
- `stripe-webhook` confirmed using `Number(item.variant_id)` directly to Printful
- All 8 `/api/printful/` routes confirmed unauthenticated
- `supabase/config.toml` confirmed registering non-existent Printify functions
- `.env.example` confirmed containing Printify variables

No material changes found since audit. Implementation proceeded.

---

## 3. Files Changed

| Path | Purpose | Change |
|---|---|---|
| `supabase/migrations/20261016000000_create_product_variants.sql` | NEW — product_variants table + data migration | Created |
| `src/types.ts` | Shared types | Added `StoreVariant`; marked `ProductVariant` as LEGACY; updated `CartItem` |
| `src/lib/cart.tsx` | Cart context | Versioned storage key (`_v2`); legacy cart clearing; `addToCart` uses `StoreVariant` |
| `src/app/product/[id]/page.tsx` | Product page server component | Fetches `product_variants`, falls back to JSONB; passes `storeVariants` to client |
| `src/app/product/[id]/ProductDetailClient.tsx` | Product detail UI | Uses `StoreVariant` instead of `ProductVariant`; reads `retail_price` |
| `supabase/functions/printful-proxy/index.ts` | Sync edge function | Upserts `product_variants` after products sync; preserves stable UUIDs; marks removed variants unavailable |
| `supabase/functions/stripe-checkout/index.ts` | Checkout edge function | Validates against `product_variants`; JSONB fallback; stores `store_variant_id` + `printful_variant_id` in Stripe metadata |
| `supabase/functions/stripe-webhook/index.ts` | Fulfillment edge function | Uses `printful_variant_id` from metadata; throws on missing mapping; order preserved on error |
| `src/app/api/printful/artwork-upload/route.ts` | Artwork upload | Added `requireAdmin()` |
| `src/app/api/printful/mockups/route.ts` | Mockup creation | Added `requireAdmin()` |
| `src/app/api/printful/mockups/persist/route.ts` | Mockup persistence | Added `requireAdmin()` |
| `src/app/api/printful/products/route.ts` | Catalog products | Added `requireAdmin()` |
| `src/app/api/printful/products/[productId]/route.ts` | Catalog product detail | Added `requireAdmin()` |
| `src/app/api/printful/printfiles/[productId]/route.ts` | Print files | Added `requireAdmin()` |
| `src/app/api/printful/templates/[productId]/route.ts` | Layout templates | Added `requireAdmin()` |
| `src/app/api/printful/mockups/[taskKey]/route.ts` | Task polling | Added `requireAdmin()` |
| `supabase/config.toml` | Supabase function config | Removed Printify function entries |
| `.env.example` | Environment variable docs | Removed Printify variables section |
| `src/__tests__/printful/phase2.test.ts` | NEW — Phase 2 tests | Created (35 tests) |

---

## 4. Migration Created

**File:** `supabase/migrations/20261016000000_create_product_variants.sql`

**Table created:** `product_variants`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` — stable store identity |
| `product_id` | uuid NOT NULL | FK → `products(id)` ON DELETE RESTRICT |
| `provider` | text NOT NULL | Default `'printful'` |
| `printful_variant_id` | text | Provider mapping — nullable for manual variants |
| `label` | text | Display label (e.g. "Black / M") |
| `color` | text | nullable |
| `size` | text | nullable |
| `retail_price` | numeric(10,2) | Authoritative storefront price |
| `provider_cost` | numeric(10,2) | nullable |
| `image_url` | text | nullable |
| `available` | boolean | Default true |
| `provider_metadata` | jsonb | Default `{}` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Uniqueness constraint:** `UNIQUE (product_id, provider, printful_variant_id) WHERE printful_variant_id IS NOT NULL`
Prevents duplicate provider mappings. Allows multiple manual (null) variants per product.

**Indexes:**
- `idx_product_variants_product_id` — primary join path
- `idx_product_variants_printful_variant_id` (partial, WHERE NOT NULL) — fulfillment lookup
- `idx_product_variants_provider` — future multi-provider queries
- `idx_product_variants_available` — storefront filtering

**RLS policies:**
- `public_read_product_variants` — anon + authenticated SELECT WHERE available = true
- `admin_read_all_product_variants` — admin SELECT (all, including unavailable)
- `admin_insert_product_variants` — admin INSERT
- `admin_update_product_variants` — admin UPDATE
- `admin_delete_product_variants` — admin DELETE

**Data migration:** SQL INSERT from `products.variants` JSONB into `product_variants` rows. Uses `ON CONFLICT DO NOTHING` — safe to re-run. `products.variants` JSONB is NOT removed.

---

## 5. Variant Migration Results

**MIGRATION CREATED BUT NOT APPLIED**

The migration SQL has been written and placed in `supabase/migrations/`. It has not been executed against the live database. Apply with:

```bash
supabase db push
```

or via the Supabase dashboard SQL editor.

The data migration query will:
- Read every product's `variants` JSONB array
- Insert one `product_variants` row per element
- Set `provider = 'printful'`, `printful_variant_id = variants[].id`
- Generate a new stable store UUID per variant
- Skip duplicates via `ON CONFLICT DO NOTHING`

---

## 6. Product Sync Changes

The `printful-proxy` POST /sync route now:

1. Upserts products as before (unchanged)
2. Fetches the store product UUIDs for all synced products
3. For each product, upserts `product_variants` rows using `onConflict: "product_id,provider,printful_variant_id"` — this preserves the existing store UUID on re-sync
4. Marks variants no longer returned by Printful as `available = false` (does not delete)

**Stable UUID guarantee:** Because the upsert conflicts on `(product_id, provider, printful_variant_id)`, the `id` UUID is never regenerated for an existing mapping. A re-sync only updates `label`, `color`, `size`, `retail_price`, `image_url`, `available`, and `updated_at`.

---

## 7. Cart Changes

| | Before (v1) | After (v2) |
|---|---|---|
| Storage key | `pod_storefront_cart` | `pod_storefront_cart_v2` |
| `variant_id` | Printful numeric ID string (e.g. `"4011"`) | Store UUID (e.g. `"sv-uuid-001"`) |
| `addToCart` accepts | `ProductVariant` | `StoreVariant` |
| Price field | `variant.price` | `variant.retail_price` |
| New fields | — | `color`, `size` snapshot on CartItem |

---

## 8. Legacy Cart Handling

On first load, `CartProvider` removes the legacy `pod_storefront_cart` key from localStorage. The v2 key `pod_storefront_cart_v2` is then initialized empty.

Legacy carts (v1) cannot be safely migrated because v1 `variant_id` values are Printful numeric IDs and there is no client-side mapping to store UUIDs. Safe clearing is the correct behavior — customers with items in a v1 cart will see an empty cart on first load after deployment.

This is a one-time event. All new carts use store UUIDs.

---

## 9. Checkout Changes

`stripe-checkout` now:

1. Loads `product_variants` rows matching the submitted `variant_id` values
2. **Phase 2 path:** validates `storeVariant.product_id === item.product_id`, rejects if `available = false`
3. **Legacy fallback:** if no `product_variants` row found (pre-migration), falls back to JSONB variant validation
4. Uses `storeVariant.retail_price` as authoritative price — browser price ignored
5. Stores `store_variant_id` and `printful_variant_id` in Stripe session metadata
6. Uses `printful_variant_id` for the Printful shipping rate API call

---

## 10. Fulfillment Changes

```
Order item in Stripe metadata
  store_variant_id: "sv-uuid-001"
  printful_variant_id: "4011"
        ↓
stripe-webhook reads printful_variant_id from metadata
        ↓
Number("4011") = 4011
        ↓
Printful order payload: { variant_id: 4011 }
        ↓
Printful fulfillment
```

If `printful_variant_id` is null or missing, the webhook throws a clear error and logs it. The storefront order row is preserved in the database for admin resolution. No silent incorrect submission occurs.

Legacy orders (created before Phase 2) fall back to `item.variant_id` which was the Printful ID — backward compatible.

---

## 11. Security Changes

| Route | Method | Before | After |
|---|---|---|---|
| `/api/printful/products` | GET | No auth | `requireAdmin()` |
| `/api/printful/products/[productId]` | GET | No auth | `requireAdmin()` |
| `/api/printful/printfiles/[productId]` | GET | No auth | `requireAdmin()` |
| `/api/printful/templates/[productId]` | GET | No auth | `requireAdmin()` |
| `/api/printful/mockups` | POST | No auth | `requireAdmin()` |
| `/api/printful/mockups/[taskKey]` | GET | No auth | `requireAdmin()` |
| `/api/printful/mockups/persist` | POST | No auth | `requireAdmin()` |
| `/api/printful/artwork-upload` | POST | No auth | `requireAdmin()` |

All 8 routes now return 401 for unauthenticated requests using the existing `requireAdmin()` infrastructure.

---

## 12. Printify Cleanup

| Item | Action |
|---|---|
| `supabase/config.toml` — `[functions.printify-proxy]` block | Removed |
| `supabase/config.toml` — `[functions.printify-webhook]` block | Removed |
| `.env.example` — `NEXT_PUBLIC_PRINTIFY_SHOP_ID` | Removed |
| `.env.example` — `PRINTIFY_SHOP_ID` | Removed |
| `.env.example` — `PRINTIFY_API_TOKEN` | Removed |
| `.env.example` — Printify section comments | Removed |
| Historical migrations in `supabase/migrations/old/` | Preserved |
| `supabase/migrations/20261014000000_printify_to_printful.sql` | Preserved |

---

## 13. Legacy JSONB Status

Remaining references to `products.variants` JSONB:

| Location | Classification | Notes |
|---|---|---|
| `supabase/functions/printful-proxy/index.ts` sync | REQUIRED TEMPORARILY | Still writes JSONB for backward compat; also writes `product_variants` |
| `supabase/functions/stripe-checkout/index.ts` | REQUIRED TEMPORARILY | Legacy fallback path when `product_variants` row not found |
| `src/app/product/[id]/page.tsx` | REQUIRED TEMPORARILY | Fallback when `product_variants` is empty (pre-migration) |
| `src/types.ts` `ProductVariant` interface | REQUIRED TEMPORARILY | Kept for JSONB fallback typing |
| `supabase/migrations/20260903191649_create_ecommerce_schema.sql` | PRESERVE | Historical migration record |
| `supabase/fresh_install.sql`, `reset.sql`, `sql/*`, `scripts/*` | READY TO REMOVE | Stale — not used in deployment; Phase 2B cleanup |

`products.variants` JSONB column itself: **REQUIRED TEMPORARILY** — do not drop until all fallback paths are removed and `product_variants` is proven populated.

---

## 14. Test Results

| Suite | Tests | Result |
|---|---|---|
| Phase 1 — Printful integration (printful.test.ts) | 38 | ✅ PASS |
| Phase 2 — Foundation (phase2.test.ts) | 35 | ✅ PASS |
| **Total** | **73** | **✅ PASS** |

---

## 15. Build Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS — 0 errors |
| `npx vitest run` | ✅ PASS — 73/73 |
| `npm run build` | ✅ PASS — clean production build |

---

## 16. Regression Verification

| Area | Status | Notes |
|---|---|---|
| Product pages | ✅ | Fetches `product_variants`, falls back to JSONB |
| Categories | ✅ | Unchanged |
| Cart | ✅ | v2 key, StoreVariant identity |
| Checkout | ✅ | Validates against `product_variants` with JSONB fallback |
| Order creation | ✅ | Unchanged — `orders.items` JSONB snapshot preserved |
| Printful fulfillment | ✅ | Uses `printful_variant_id` from metadata |
| Printful webhook | ✅ | Unchanged — matches on `printful_order_id` only |
| Admin | ✅ | Unchanged |

---

## 17. Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| Migration not yet applied | HIGH | `product_variants` table does not exist in live DB until `supabase db push` is run. Storefront falls back to JSONB until then. |
| Legacy cart clearing is a one-time UX disruption | LOW | Customers with v1 carts will see empty cart on first load after deployment. Acceptable. |
| `supabase/fresh_install.sql` still references Printify schema | MEDIUM | Not used in deployment but would create wrong schema if run. Phase 2B cleanup. |
| `affiliates/route.ts` uses inline `getAuthedSb()` instead of `requireAdmin()` | LOW | Inconsistency noted in audit — not addressed in this phase (out of scope). |

---

## 18. Deferred Work

| Item | Phase |
|---|---|
| Remove `products.variants` JSONB column | After `product_variants` proven populated in production |
| Rewrite `supabase/fresh_install.sql`, `reset.sql`, `sql/*`, `scripts/*` | Phase 2B cleanup |
| `designs` table | Future catalog phase |
| `collections` / `product_collections` | Future catalog phase |
| Manual product creation in admin | Future catalog phase |
| Catalog builder | Future catalog phase |
| Product image migration (Printful CDN → Supabase Storage) | Future catalog phase |
| Per-product SEO (`slug`, `meta_title`, `meta_description`) | Future catalog phase |
| Product Designer integration with storefront catalog | Future catalog phase |
| Mockup Generator v2 migration | Future (architecture isolated, ready) |
| Affiliate `getAuthedSb()` → `requireAdmin()` refactor | Phase 2B |

---

## 19. Final Architecture

```
CUSTOMER
    |
    v
STOREFRONT PRODUCT (products.id UUID)
    |
    v
STOREFRONT VARIANT (product_variants.id UUID)
    |
    +-- label, color, size, retail_price, available
    |
    v
CART (pod_storefront_cart_v2)
    variant_id = product_variants.id
    |
    v
CHECKOUT (stripe-checkout)
    validates product_variants.id + product_id + available
    stores store_variant_id + printful_variant_id in Stripe metadata
    |
    v
ORDER (orders.items JSONB snapshot)
    store_variant_id, printful_variant_id, quantity, price
    |
    v
PROVIDER RESOLUTION (stripe-webhook)
    reads printful_variant_id from order metadata
    |
    v
PRINTFUL FULFILLMENT
    variant_id: Number(printful_variant_id)
```

---

## 20. Phase Completion Decision

**PHASE 2 FOUNDATION: COMPLETE**

All implementation steps executed. TypeScript: PASS. Tests: 73/73 PASS. Build: PASS.

**READY FOR STOREFRONT CATALOG PHASE: CONDITIONAL**

Condition: Apply the database migration (`supabase db push`) to create `product_variants` in the live database before deploying. The storefront falls back to JSONB variants until the migration is applied — this is safe but the provider boundary is not active until then.

Once the migration is applied and a Printful sync is run, `product_variants` will be populated and the full Phase 2 architecture will be active.
