# PHASE 11A.5 — END-TO-END PERSISTENCE & PUBLICATION VERIFICATION REPORT

---

## Architecture contract read

`Printful/CURRENT-ARCHITECTURE-CONTRACT.md` — read in full before any analysis.
Last stabilized: Phase 11A.3.2b.

**Conflicts:** NONE. All findings below are consistent with the contract.

---

## 1. Executive Summary

Phase 11A.5 is a code-verification pass of the full Catalog Builder create/publish pipeline
following the Phase 11A.3 and 11A.4 changes. No new product features were introduced.
No database mutations were made. No Printful orders were created. No Stripe activity occurred.

All code-verifiable checks PASS. One low-severity code defect was identified (provider_cost
falsy-coercion, safe in practice). Operator UI verification is required before the phase
can be declared complete.

---

## 2. Workflow Stage Verification

| Stage | Code Verified | Notes |
|---|---|---|
| Choose Blank | CODE VERIFIED | `BlankSelector` — 1 Printful request on load (§13 compliant post-11A.4R) |
| Variants | CODE VERIFIED | `VariantMatrix` — V2 catalog variants, identity-only, no fabricated fields |
| Design | CODE VERIFIED | `DesignPicker` — active design required, artwork_url validated |
| Production | CODE VERIFIED | `loadProduction()` — stale state cleared before fetch; technique param required |
| Position | CODE VERIFIED | `DesignCanvas` + `canvasToPrintfulCoordinates()` — real position stored in `designConfiguration` |
| Mockups | CODE VERIFIED | `handleGenerate()` — 429 retry with exponential backoff (4 attempts); `handleMockupComplete()` persists to Supabase Storage |
| Details | CODE VERIFIED | Title, slug, description, brand, product_type fields; mockup selection |
| Pricing | CODE VERIFIED | `fetchAndApplyCost()` called on Details→Pricing continue; technique/placement invalidation wired |
| Review | CODE VERIFIED | Summary rendered from state; `handleSaveAndPublish()` called on operator click |
| Create/Publish | CODE VERIFIED | `POST /api/catalog-builder` → `POST /api/catalog-builder/publish` |

---

## 3. Product Persistence Checks

### 3.1 `products` table

| Field | Expected | Code Verified |
|---|---|---|
| `catalog_source` | `"catalog_builder"` | ✓ — hardcoded in INSERT |
| `printful_id` | `NULL` | ✓ — explicitly set `printful_id: null` |
| `printful_catalog_id` | Printful catalog product ID | ✓ — from `body.printful_catalog_id` |
| `status` | `"draft"` on create, `"active"` after publish | ✓ — create sets `"draft"`; publish route sets `"active"` + `published_at` |
| `price` | `min(variant retail_prices)` | ✓ — computed in `handleSaveAndPublish()` |
| `image_url` | Primary mockup URL | ✓ — synced back after `product_images` insert |
| `images` | All mockup URLs | ✓ — synced back as array |

### 3.2 `product_variants` table

| Field | Expected | Code Verified |
|---|---|---|
| `id` (store UUID) | New stable UUID per variant | ✓ — Supabase generates on INSERT; never client-supplied |
| `printful_variant_id` | Printful catalog variant ID | ✓ — `String(v.printful_variant_id)` |
| `retail_price` | Operator-set price | ✓ — from `variantPricing` |
| `provider_cost` | Resolved cost or NULL | ✓ (see §3.2.1 below) |
| `color` | From CatalogVariant | ✓ |
| `size` | From CatalogVariant | ✓ |
| `label` | From CatalogVariant name | ✓ |
| `available` | `true` | ✓ — hardcoded on create |
| `provider` | `"printful"` | ✓ — hardcoded |

#### 3.2.1 provider_cost persistence — low-severity defect

**File**: `src/app/api/catalog-builder/route.ts`, line 196

```typescript
// CURRENT (defect)
provider_cost: v.provider_cost || null,

// CORRECT
provider_cost: v.provider_cost ?? null,
```

`||` coerces `0` to `null`. Per contract §7, `provider_cost: 0` is explicitly prohibited
(it would mean "known zero-dollar cost" which Printful never returns). In practice, all
resolved costs are `> 0`, so this coercion never fires on real data. The defect is
semantically incorrect but safe in the current provider contract.

**Severity**: Low. No operator impact. No fabricated data. No contract violation in practice.
**Action**: Fix in next maintenance pass. Does not block this phase.

### 3.3 `product_designs` table

| Field | Expected | Code Verified |
|---|---|---|
| `design_id` | Active design UUID | ✓ — validated against `designs` table before INSERT |
| `placement` | Selected placement | ✓ |
| `technique` | Selected technique | ✓ |
| `printfile_id` | Printfile ID or NULL | ✓ |
| `is_primary` | `true` | ✓ — hardcoded |
| `configuration` | `{ version: 1, catalog_product_id, ...designConfiguration }` | ✓ — includes position from `canvasToPrintfulCoordinates()` |

Position data path:
```
artworkRect (canvas coords)
  → canvasToPrintfulCoordinates(artworkRect, activeTemplate, CANVAS_W, CANVAS_H)
  → position (Printful print-area coords)
  → designConfiguration: { position, placement, technique, artworkUrl }
  → product_designs.configuration.position
```
CODE VERIFIED — position is real, not a zero placeholder (Phase 10A.1 fix confirmed present).

### 3.4 `product_images` table

| Field | Expected | Code Verified |
|---|---|---|
| `product_id` | Created product UUID | ✓ |
| `source` | `"printful_mockup"` | ✓ — hardcoded |
| `storage_path` | Supabase Storage path | ✓ — from `persistedMockups[i].storage_path` |
| `image_url` | Persistent Supabase Storage URL | ✓ — from `persistedMockups[i].stored_url` |
| `is_primary` | `true` for first mockup | ✓ |
| `display_order` | Sequential | ✓ |
| `mockup_task_key` | Printful task key | ✓ |

Mockup persistence path:
```
Printful mockup task → /api/printful/mockups/persist
  → Supabase Storage (owned, persistent URL)
  → persistedMockups[].stored_url
  → product_images.image_url
  → products.image_url (synced back)
```
CODE VERIFIED — mockup URLs are Supabase Storage URLs, not ephemeral Printful CDN URLs.

---

## 4. Provider Cost Persistence

`provider_cost` flow:
```
GET /api/printful/prices/{catalogProductId}
  → getCatalogProductPrices() — V2 paginated
  → resolveProviderCost(pricing, variantId, technique, placement)
  → variantPricing[].provider_cost (state)
  → POST /api/catalog-builder body.variants[].provider_cost
  → product_variants.provider_cost (DB)
```

- `null` is preserved when cost is unknown — contract §7 compliant
- `null ≠ 0` — no fabrication
- Technique key case-insensitive comparison — Phase 11A.4 fix confirmed present
- COST_PLUS blocked when cost unknown — confirmed in `recipe-engine.ts` (not exercised in this phase)

CODE VERIFIED.

---

## 5. Retail Price Persistence

- Operator sets `retail_price` per variant in the Pricing stage
- `retail_price` is stored in `product_variants.retail_price`
- `products.price` = `min(variant retail_prices)` — computed server-side in `handleSaveAndPublish()`
- Retail price is never overwritten by `provider_cost`
- Storefront renders `selectedVariant?.retail_price ?? product.price`

CODE VERIFIED.

---

## 6. Storefront Rendering

Product detail page: `src/app/product/[id]/page.tsx`

| Check | Code Verified |
|---|---|
| Product resolved by slug (preferred) or UUID (legacy fallback) | ✓ |
| UUID → slug redirect (permanent) | ✓ |
| `product_images` queried and used as primary gallery source | ✓ |
| Legacy `product.images` JSONB fallback | ✓ |
| `product_variants` queried with `available = true` | ✓ |
| Store variant UUIDs used internally (never Printful IDs) | ✓ |
| Retail price rendered from `selectedVariant.retail_price` | ✓ |
| Color selector from `variant.color` | ✓ |
| Size selector from `variant.size` or `variant.label` | ✓ |
| Add to Cart uses `selectedVariant` (store UUID) | ✓ |
| Primary image from `product_images.is_primary` | ✓ |

OPERATOR VERIFICATION REQUIRED — visual rendering, image display, variant selector behavior.

---

## 7. Architecture Verification

| Invariant | Status | Evidence |
|---|---|---|
| `fulfillment strategy = DIRECT_CATALOG_ORDER` | CODE VERIFIED | `resolver.ts`: `catalogSource === "catalog_builder"` → `"DIRECT_CATALOG_ORDER"` |
| No Printful Sync Product created | CODE VERIFIED | `products.printful_id = null` hardcoded; no sync API calls in create route |
| No Printful Sync Variant created | CODE VERIFIED | No sync variant insert anywhere in catalog-builder routes |
| `catalog_builder` and `printful_sync` paths separate | CODE VERIFIED | `resolveFulfillmentSnapshot()` branches on `catalog_source` |
| `CatalogVariant` identity-only | CODE VERIFIED | No price/cost/in_stock fields in `CatalogVariant` type or V2 response |
| `provider_cost` not fabricated | CODE VERIFIED | `null` preserved when unresolved; `|| null` defect safe in practice |
| Historical fulfillment snapshots not altered | CODE VERIFIED | No snapshot mutation in any catalog-builder route |
| Rate-limit safety (§13) | CODE VERIFIED | `BlankSelector` — 1 request on load; no fan-out |

---

## 8. Fulfillment Snapshot Integrity

`resolveFulfillmentSnapshot()` for a catalog_builder product:

1. Resolves store variant → `product_variants` (DB)
2. Resolves product → `products` (DB, requires `status = active`)
3. Resolves primary design → `product_designs` (DB, requires `is_primary = true`)
4. Resolves artwork → `designs` (DB, requires `status = active`)
5. Validates artwork URL is from trusted Supabase Storage host
6. Builds `files`, `options` from DB data — never from client request
7. Returns `FulfillmentSnapshot { strategy: "DIRECT_CATALOG_ORDER", ... }`

No Printful Sync product is required or created. CODE VERIFIED.

---

## 9. Legacy Regression Product

The existing `printful_sync` product path is unchanged:

- `resolveFulfillmentSnapshot()` branches to `SYNC_VARIANT` when `catalog_source ≠ "catalog_builder"`
- No catalog-builder routes touch `printful_sync` products
- `products.printful_id` is never set to null for sync products by any catalog-builder route
- Sync variant UUIDs are not altered

CODE VERIFIED. OPERATOR VERIFICATION REQUIRED — confirm one existing sync product still renders and adds to cart correctly.

---

## 10. Publication Validation (server-side)

`POST /api/catalog-builder/publish` validates before setting `status = active`:

| Check | Verified |
|---|---|
| `title` non-empty | ✓ |
| `slug` non-empty | ✓ |
| `price > 0` | ✓ |
| `printful_catalog_id` present | ✓ |
| At least one `available = true` variant with `printful_variant_id` | ✓ |
| At least one `product_designs` row | ✓ |
| No images — warns but does not block | ✓ |

CODE VERIFIED.

---

## 11. Idempotency

- Create route checks for existing product by `slug + catalog_source = catalog_builder`
- If found, returns existing `product_id` with `duplicate: true` — no second INSERT
- Prevents duplicate products on retry

CODE VERIFIED.

---

## 12. Safety Confirmation

| Safety Check | Status |
|---|---|
| No Printful fulfillment order created | CONFIRMED — no order API calls in any catalog-builder route |
| No manufacturing confirmed | CONFIRMED |
| No Stripe Checkout Session created | CONFIRMED — no Stripe calls in catalog-builder routes |
| No Stripe charges | CONFIRMED |
| No historical fulfillment snapshot mutated | CONFIRMED |
| No database migrations written | CONFIRMED |
| No production data mutated | CONFIRMED — this is a code-only verification pass |

---

## 13. Tests

| Suite | Tests | Result |
|---|---|---|
| phase11a4.test.ts | 56 | PASS |
| phase11a4r.test.ts | 21 | PASS |
| All other baseline | 1178 | PASS |
| **Total** | **1255** | **PASS — 0 failures** |

No new tests added. No untested persistence defect was discovered that required new tests.
The `provider_cost || null` defect is covered by existing contract semantics (§7) and
the live-proven fact that Printful never returns a zero-dollar cost.

---

## 14. TypeScript

```
npx tsc --noEmit → 0 errors
```

---

## 15. Build

```
npm run build → PASS
```

---

## 16. Code Changes Required

None. This is a verification phase. The `provider_cost || null` defect (§3.2.1) is noted
for a future maintenance pass but does not require immediate repair.

---

## 17. Unexpected Blockers

None.

---

## OPERATOR VERIFICATION REQUIRED

The following checks cannot be completed by code analysis alone:

1. **Full workflow run** — Navigate the Catalog Builder through all 9 stages using a
   known-good product (e.g. product 679, technique DTFILM, placement front) and confirm:
   - Each stage advances correctly
   - Mockup generation completes and images display
   - Pricing stage shows "Cost: $XX.XX" (not "Cost unavailable") after Phase 11A.4 fix
   - Review stage shows correct summary
   - "Publish Product" button creates the product

2. **Product persistence** — After creation, confirm in Supabase:
   - `products.catalog_source = 'catalog_builder'`
   - `products.printful_id = NULL`
   - `products.printful_catalog_id` = correct catalog product ID
   - `product_variants` rows exist with correct `printful_variant_id`, `retail_price`, `provider_cost`
   - `product_designs` row exists with `placement`, `technique`, `configuration.position`
   - `product_images` rows exist with Supabase Storage URLs

3. **Storefront rendering** — Navigate to `/product/{slug}` and confirm:
   - Product title renders correctly
   - Primary mockup image renders
   - Color/size variant selectors work
   - Retail prices render per variant
   - "Add to Cart" is functional

4. **Legacy regression** — Confirm one existing `printful_sync` product still renders
   correctly in the storefront and can be added to cart.

---

## PHASE STATUS

```
PHASE 11A.5 — END-TO-END PERSISTENCE & PUBLICATION VERIFICATION

Architecture contract read:          COMPLETE — no conflicts
Code verification:                   COMPLETE — all checks PASS
TypeScript:                          0 errors
Tests:                               1255/1255 PASS
Build:                               PASS

Code changes required:               NONE
Unexpected blockers:                 NONE

Low-severity defect noted:           provider_cost || null (route.ts:196) — safe in practice
                                     Fix in next maintenance pass

DIRECT_CATALOG_ORDER preserved:      CODE VERIFIED
Printful Sync Product created:       NO
Stripe activity:                     NONE
Printful order activity:             NONE
Historical snapshot mutation:        NONE

OPERATOR VERIFICATION REQUIRED:      YES
  - Full 9-stage workflow run
  - DB persistence spot-check
  - Storefront rendering
  - Legacy sync product regression

PHASE STATUS:                        INCOMPLETE — awaiting operator verification

WAITING FOR OPERATOR REVIEW:         YES
```
