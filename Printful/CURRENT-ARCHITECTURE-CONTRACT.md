# CountyBuys — Current Printful Architecture Contract

**Status**: Authoritative  
**Derived from**: Current stabilized source code, passing tests, and live-proven provider API contracts  
**Supersedes**: All PHASE-*, AUDIT-*, IMPLEMENTATION-*, and prior architecture documents where they conflict with this file  
**Last stabilized**: Phase 11A.3.2b stabilization pass

---

## 1. SYSTEM OWNERSHIP

CountyBuys owns the commercial storefront catalog.  
Printful provides manufacturing capability, production metadata, provider catalog identities, mockups, and fulfillment.

| CountyBuys owns | Printful owns |
|---|---|
| Product titles | Catalog product identity |
| Descriptions | Catalog variant identity |
| Retail pricing | Production techniques |
| Categories and collections | Placements |
| SEO / meta fields | Printfile / template metadata |
| Publication status | Provider manufacturing capabilities |
| Merchandising | Fulfillment |
| Customer-facing product identity | |
| Store variant UUIDs | |

---

## 2. PRODUCT IDENTITY CHAIN

```
CountyBuys Product UUID          (products.id)
    ↓
CountyBuys Store Variant UUID    (product_variants.id)
    ↓
Provider Mapping
    ↓
Printful Catalog Variant ID      (product_variants.printful_variant_id)
```

Store variant UUIDs are the internal and customer-facing variant identity.  
Printful catalog variant IDs are provider mappings only — they are never the primary key for CountyBuys records.

---

## 3. CATALOG SOURCES

Two catalog sources exist. They must not be silently merged.

### `catalog_source = catalog_builder`

- `products.printful_id = NULL`
- `products.printful_catalog_id` = Printful catalog product ID
- Variant mapping uses Printful catalog variant ID from V2 endpoint
- Fulfillment strategy: `DIRECT_CATALOG_ORDER`
- Product creation engine: `src/lib/catalog/product-engine.ts`

### `catalog_source = printful_sync`

- `products.printful_id` = Printful Sync product ID (non-null)
- Existing sync identity and behavior preserved unchanged
- Fulfillment strategy: `SYNC_VARIANT`
- Do not alter sync identity, sync variant UUIDs, or sync fulfillment path

**Rule**: A Printful Sync product must never be created merely to fulfill a Catalog Builder product.

---

## 4. PRINTFUL API RESPONSIBILITIES

### Legacy V1 — catalog product discovery

```
GET /products
```

- Returns V1 envelope: `{ code: 200, result: [...] }`
- Live-proven: 555 products, no pagination, single response
- Handled by: `printfulGet()` in `src/lib/printful/client.ts`
- Used by: `getCatalogProducts()` in `src/lib/printful/catalog.ts`

```
GET /products/{id}
```

- Returns V1 envelope: `{ code: 200, result: <flat product object> }`
- Live-proven: flat product object, no `variants` array
- `GET /products/{id}/variants` — **does not exist**, returns 404
- Used by: `getCatalogProduct()` in `src/lib/printful/catalog.ts`

### V2 — catalog variant identity

```
GET /v2/catalog-products/{id}/catalog-variants
```

- Returns V2 envelope: `{ data: [...], paging: { total, limit, offset }, extra, _links }`
- Live-proven: paginated at 20 per page; `paging.total` is authoritative
- All pages must be accumulated; deduplication by variant ID required
- Handled by: `printfulGetV2()` in `src/lib/printful/client.ts`
- Used by: `getCatalogVariants()` in `src/lib/printful/catalog.ts`

### Production metadata

```
GET /mockup-generator/printfiles/{id}?technique={technique}
GET /mockup-generator/templates/{id}?technique={technique}
```

- `technique` parameter is required; omitting it returns wrong placements
- Handled by: `getPrintfiles()`, `getLayoutTemplates()` in `src/lib/printful/templates.ts`

### Rule: `printfulGet()` and `printfulGetV2()` must not be used interchangeably

`printfulGet()` reads `json.result` (V1 envelope).  
`printfulGetV2()` reads the full `{ data, paging, extra, _links }` object (V2 envelope).  
Using the wrong helper for an endpoint produces silent data corruption.

---

## 5. CATALOG VARIANT SEMANTICS

`CatalogVariant` (defined in `src/lib/printful/types.ts`) proves **provider variant identity only**.

Fields present: `id`, `catalog_product_id`, `name`, `size`, `color`, `color_code`, `image`

Fields **not present** in the V2 catalog-variant response:
- `price` / provider cost
- `in_stock`
- `availability_regions`
- `availability_status`

### Invariants

| Missing field | Must NOT be interpreted as |
|---|---|
| `price` absent | `$0.00` provider cost |
| `in_stock` absent | `in_stock = true` |
| `in_stock` absent | `availability_status = "active"` |
| eligibility unknown | unavailable |

**No provider field may be fabricated to satisfy an older type contract.**  
If a downstream type requires a field that V2 does not provide, the type must be updated — not the data fabricated.

---

## 6. ELIGIBILITY

`getCatalogVariants()` never throws. It returns `CatalogVariantResult`:

```typescript
type CatalogVariantEligibility = "eligible" | "unavailable" | "error";

interface CatalogVariantResult {
  eligibility: CatalogVariantEligibility;
  variants: CatalogVariant[];
  reason?: string;
}
```

| State | Meaning |
|---|---|
| `eligible` | V2 variant identity accessible for current store/region |
| `unavailable` | Provider explicitly returned regional unavailability (404 with region message) |
| `error` | Unexpected provider or system failure |
| `unknown` | Eligibility not yet established (summary not loaded) |

### Rules

- `unknown` must never be collapsed to `unavailable`
- `error` must never be collapsed to `unavailable`
- `unavailable` must never be collapsed to `error`
- A product present in the legacy `/products` catalog is not automatically eligible for CountyBuys building

**Live-proven examples**:
- Product 679: `eligible` — V2 variants accessible, US store
- Product 638 (Adidas Dad Hat): present in legacy catalog, `unavailable` — V2 returns regional 404 for current store

---

## 7. PRICING SEMANTICS

### `provider_cost: null`

`VariantPricing.provider_cost` is typed `number | null`.  
`null` means **authoritative provider cost is unknown**.  
It does not mean `$0.00`.

```typescript
// CORRECT
provider_cost: null   // unknown — V2 does not provide cost

// WRONG
provider_cost: 0      // fabricated — implies known zero-dollar cost
```

### FIXED_PRICE recipes

Provider cost is not required. `fixed_price` is the retail price.  
Behavior is unchanged regardless of provider cost availability.

### COST_PLUS recipes

```
provider cost known   → retail price = cost + configured margin
provider cost unknown → BLOCKING ERROR — cannot activate or validate
```

COST_PLUS activation is blocked when provider cost is unavailable.  
The margin must not be used as a standalone retail price.  
No cost must be fabricated to unblock activation.

Implemented in:
- `src/lib/catalog/recipe-engine.ts` — `resolveProductRecipe()` pushes per-variant error when `providerCost === null` and strategy is `COST_PLUS`
- `src/app/api/recipes/[id]/activate/route.ts` — COST_PLUS with unknown cost pushes a blocking activation error

### Dry-run sentinel

`ProductSpecification.price` requires `number > 0` for structural validation.  
In the multi-product dry-run path (`CatalogBuilder.tsx`), `price: 1` is used as a non-persistent structural sentinel when provider cost is unknown.  
This value exists only to satisfy `validateProductSpecification()` in a no-persistence dry-run context.  
It must never be interpreted as a real storefront price.

---

## 8. PRODUCTION METADATA

### Technique awareness

- `fetchPrintfileSpec()` requires `technique` as a parameter — `src/lib/fulfillment/artwork-validation.ts`
- `getPrintfiles()` passes `?technique=` query param — `src/lib/printful/templates.ts`
- `getLayoutTemplates()` passes `?technique=` query param — `src/lib/printful/templates.ts`
- Changing technique invalidates any previously computed artwork validation
- Selecting a placement triggers revalidation against the current technique

### Template resolution

Template resolution must follow the `variant_mapping` path:

```
variant_mapping.find(m => m.variant_id === variantId)
    → .templates.find(t => t.placement === placement)
    → .template_id
    → templates.find(t => t.template_id === template_id)
```

**`templates[0]` must never be used as authoritative placement resolution.**

Implemented in: `resolveLayoutTemplateForVariantPlacement()` — `src/lib/printful/templates.ts`

### `conflicting_placements` normalization

Printful returns `conflicting_placements` as either an array or a Record.  
`getLayoutTemplates()` normalizes it to `Record<string, string[]>` before returning.

### Valid techniques

`VALID_TECHNIQUES` set is defined in `src/lib/printful/techniques.ts`.  
Used by printfiles and templates API routes to validate the `?technique=` query parameter.

---

## 9. PRODUCT DESIGNER RACE SAFETY

When technique changes in `ProductDesigner`:

1. Stale state is cleared immediately: `printfiles`, `templates`, `placement`, `activeTemplate` set to null
2. An `AbortController` is created; in-flight requests for the previous technique are aborted
3. `AbortError` is caught and suppressed — it is expected behavior, not an error

Implemented in: `src/components/product-designer/ProductDesigner.tsx`

Stale production/template metadata must never remain visible after a technique change.

---

## 10. FULFILLMENT

### Catalog Builder products — `DIRECT_CATALOG_ORDER`

```
catalog_source = catalog_builder
products.printful_id = NULL
products.printful_catalog_id = Printful catalog product ID
```

Fulfillment uses Printful catalog variant ID directly with files and production options.  
No Printful Sync product is created or required.

### Legacy Printful Sync products — `SYNC_VARIANT`

```
catalog_source = printful_sync
products.printful_id = Printful Sync product ID (non-null)
```

Existing compatible fulfillment path preserved.  
No silent fallback from `DIRECT_CATALOG_ORDER` to `SYNC_VARIANT`.

Strategy resolution: `src/lib/fulfillment/resolver.ts` — `resolveFulfillmentSnapshot()`

---

## 11. FULFILLMENT SNAPSHOTS

Fulfillment snapshots are immutable historical records.  
They capture the manufacturing configuration at the time of order.  
Later catalog changes, provider changes, or product edits must not rewrite historical snapshots.

---

## 12. PROVIDER CONTRACT RULE

**No new or changed Printful endpoint or response contract may be implemented solely from AI inference, old phase reports, documentation assumptions, or TypeScript types.**

For uncertain provider behavior:
1. Perform one controlled read-only live verification
2. Capture the actual response contract (envelope shape, field names, pagination behavior, error format)
3. Record the result before implementing

---

## 13. RATE-LIMIT SAFETY

`getCatalogVariants()` calls `GET /v2/catalog-products/{id}/catalog-variants` — a paginated V2 endpoint.

**Do not fan out variant requests across all 555 catalog products during initial browser load.**

Provider validation must be:
- Lazy — triggered by operator action, not page load
- Deduplicated — do not re-fetch for the same product within a session
- Cached where appropriate — `_summaryCache` in `StageComponents.tsx` / `Phase11AComponents.tsx`
- Operator-driven — variant retrieval occurs when an operator selects a product for building

Unknown eligibility is acceptable until validation occurs. Unknown is not unavailable.

---

## 14. SAFETY DURING DIAGNOSTIC WORK

Unless explicitly authorized by the operator, diagnostic, audit, and checkpoint tasks must not:

- Create products
- Publish products
- Create orders
- Create Printful Sync products
- Create Stripe sessions or charges
- Generate mockups
- Modify fulfillment snapshots
- Write database migrations
- Mutate production data of any kind

---

## 15. HISTORICAL DOCUMENT POLICY

The following are **historical records only**:

- `Printful/PHASE-*.md`
- `Printful/AUDIT-*.md`
- `Printful/IMPLEMENTATION-*.md`
- `Printful/ARCHITECTURE AUDIT.md`
- `Printful/ARCHITECTURE-AUDIT-old.md`

They may explain why code exists. They are **not authoritative** when they conflict with:

1. This document (`CURRENT-ARCHITECTURE-CONTRACT.md`)
2. Current source code
3. Currently passing tests
4. Live-proven provider behavior

When a historical document contradicts current code or live-proven facts, the historical document is wrong.

---

## 16. AMAZON Q CHANGE CONTROL

Before implementing any CountyBuys Printful change:

1. Read `CURRENT-ARCHITECTURE-CONTRACT.md`
2. Identify which invariants apply to the requested change
3. State the exact files expected to be modified
4. Do not expand scope to adjacent improvements or unrelated refactoring
5. If the requested work conflicts with an invariant in this document, **STOP** and report the conflict — do not silently resolve it
6. `UNKNOWN` must remain `UNKNOWN` — do not collapse unknown state into a known value to satisfy a type or unblock a flow
7. Do not declare a task complete while required items remain outstanding
8. Do not modify application code during read-only audit or checkpoint tasks
9. Do not perform live provider API calls unless explicitly authorized for that task
