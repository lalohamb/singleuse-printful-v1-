Read Printful/CURRENT-ARCHITECTURE-CONTRACT.md first.

It is the sole authoritative architecture contract.

Printful/COMPLETE-BUILD-ALIGNMENT-PLAN.md is an implementation plan governed
by the architecture contract. It must not override, reinterpret, or amend the
contract.

Printful/CONTRACT-CHANGE-LOG.md is historical documentation of contract changes.

Files under Printful/reports/ and Printful/archive/ are evidence/history only.

If the implementation plan conflicts with CURRENT-ARCHITECTURE-CONTRACT.md,
STOP and report the conflict.

# CountyBuys — Current Printful Architecture Contract

**Status**: Authoritative  
**Derived from**: Current stabilized source code, passing tests, live-proven provider API contracts, and required target architecture  
**Supersedes**: All PHASE-*, AUDIT-*, IMPLEMENTATION-*, and prior architecture documents where they conflict with this file  
**Last stabilized**: Workstream C — Legacy Disposition / Final Regression — Complete  
**Change log**: `Printful/CONTRACT-CHANGE-LOG.md`

> **Note on target-state sections**: Sections previously marked **⚠️ IMPLEMENTATION MIGRATION PENDING** (§4.4 and §8.1) have been fully implemented and operator-verified in Workstream A. No pending migration markers remain in this contract. Workstream B fulfillment migration is operator-verified — see §10.1. Workstream C sync disposition is resolved — see §3 and §10.2.

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

CountyBuys has one primary product architecture and one legacy compatibility path.

### PRIMARY — `catalog_source = catalog_builder`

This is the authoritative architecture for new CountyBuys products.

- `products.printful_id = NULL`
- `products.printful_catalog_id` = Printful catalog product ID
- CountyBuys Product UUID remains the product identity
- CountyBuys Store Variant UUID remains the storefront/customer variant identity
- `product_variants.printful_variant_id` stores the Printful V2 catalog variant ID
- Provider data follows the V2-first policy in Section 4
- Fulfillment strategy: `DIRECT_CATALOG_ORDER`
- Product creation engine: `src/lib/catalog/product-engine.ts`

Provider-managed sync products are not required for Catalog Builder fulfillment.

The intended identity chain is:

```text
CountyBuys Product UUID
        ↓
CountyBuys Store Variant UUID
        ↓
Printful V2 Catalog Variant ID
        ↓
Provider production / fulfillment
```

---

### LEGACY / COMPATIBILITY — `catalog_source = printful_sync`

**FINAL DISPOSITION: OPTIONAL**

`printful_sync` is **not** a co-equal primary architecture for new CountyBuys development.

It exists to preserve compatibility with the one existing provider-managed sync product (Lightweight quarter-zip pullover, Printful sync product 476330305, catalog product 903).

Workstream C audit findings:

- 1 active `printful_sync` product exists (status: active)
- 8 variants, all available
- 0 orders of any status reference this product
- 0 paid orders on the SYNC_VARIANT path
- 0 fulfilled/shipped orders on the SYNC_VARIANT path
- All orders in the database use `strategy: DIRECT_CATALOG_ORDER`

Disposition rationale: The sync infrastructure is not required for any new Catalog Builder product. DIRECT_CATALOG_ORDER is fully independent. The quarter-zip remains active in the storefront with no order history. The sync code is isolated and does not contaminate the Catalog Builder path. OPTIONAL means the sync infrastructure may be preserved indefinitely at zero cost to the Catalog Builder architecture, or removed after the operator confirms the quarter-zip is either rebuilt as a Catalog Builder product or intentionally retired.

Current characteristics:

- `products.printful_id` = Printful Sync product ID (non-null)
- Fulfillment strategy: `SYNC_VARIANT`
- Existing stored identities remain valid
- New Catalog Builder products must not use this path

---

### Rules

- `catalog_builder` is the primary architecture for new product development.
- `printful_sync` is a compatibility path.
- The two identity models must not be silently merged.
- A Printful Sync product must never be created merely to fulfill a Catalog Builder product.
- Existing viable sync code must not be deleted until its dependencies are proven unnecessary.

---

# 4. PRINTFUL API RESPONSIBILITIES

## 4.1 API Strategy — V2 First for New Catalog Builder Development

CountyBuys currently uses a hybrid Printful V1/V2 integration during migration.

The architectural direction is:

> New Catalog Builder functionality must use Printful V2 when the required capability exists and has been live-verified.

V1 may remain when:

- the equivalent V2 capability has not yet been live-verified;
- the capability is still required by an existing legacy workflow;
- migrating it is outside the current implementation scope.

A new V1 dependency must not be introduced into the Catalog Builder merely because equivalent V1 code already exists.

Existing V1 functionality must not be removed until the dependent workflow has been deliberately migrated and verified.

The migration strategy is therefore:

```text
New Catalog Builder development
        ↓
V2 FIRST

Existing capability with no proven V2 replacement
        ↓
V1 TEMPORARILY

Legacy/provider-managed workflows
        ↓
V1 COMPATIBILITY UNTIL DELIBERATELY MIGRATED
```

---

## 4.2 V2 — Catalog Variant Identity

```text
GET /v2/catalog-products/{id}/catalog-variants
```

Purpose:

```text
Authoritative Catalog Builder provider-variant identity
```

Response envelope:

```text
{
  data: [...],
  paging: {
    total,
    limit,
    offset
  },
  extra,
  _links
}
```

Rules:

- The endpoint is paginated.
- All pages must be accumulated.
- `paging.total` is authoritative.
- Results must be deduplicated by catalog variant ID.
- Handled by `printfulGetV2()`.
- Used by `getCatalogVariants()`.

`CatalogVariant.id` is a V2 catalog variant ID.

`CatalogVariant` proves provider variant identity only.

It must NOT automatically be treated as proof of:

```text
provider cost
stock
regional availability
fulfillment availability
```

Missing provider information remains unknown unless another authoritative provider endpoint establishes it.

---

## 4.3 V2 — Provider Pricing

```text
GET /v2/catalog-products/{id}/prices
```

Purpose:

```text
Authoritative provider pricing for Catalog Builder products
```

The live-proven response provides:

```text
currency
variant technique pricing
placement pricing
layer additional pricing
paging
```

Provider cost is resolved from:

```text
variant technique amount
+ placement amount
+ applicable layer additional amounts
```

Rules:

- Pricing is separate from `CatalogVariant`.
- `CatalogVariant` must not gain provider-cost fields.
- `discounted_price` may be used when it is an authoritative returned value.
- Missing or unparseable provider pricing remains `null` / unknown.
- Unknown provider cost must never be converted to `$0`.
- An explicit provider `"0.00"` is a known numeric zero and must not be treated as missing.
- Pricing retrieval must not fan out across the entire catalog during initial catalog browsing.

Retail price remains owned by CountyBuys.

Provider cost and storefront retail price are separate concepts.

---

## 4.4 V2 — Catalog Builder Production-Template Geometry

```text
GET /v2/catalog-products/{id}/mockup-templates
```

Purpose:

```text
Catalog Builder artwork-positioning and production-template geometry
```

This endpoint uses the same V2 catalog variant ID namespace as `CatalogVariant.id`.

Live-proven V2 template records contain:

```text
catalog_variant_ids
placement
technique
print_area_width
print_area_height
print_area_top
print_area_left
template_width
template_height
image_url
background_url
background_color
printfile_id
orientation
template_positioning
template_type
role
```

There is no V1 `template_id` or nested `variant_mapping` structure.

Authoritative Catalog Builder template resolution is:

```text
catalog_variant_ids includes selected CatalogVariant.id
AND
technique matches selected technique
AND
placement matches selected placement
AND
role == "primary"
```

The resolved template supplies the pixel-level geometry required for artwork positioning.

Rules:

- Retrieve all pages.
- Do not translate V2 catalog variant IDs into V1 variant IDs for Catalog Builder geometry.
- Do not use `variant_mapping[0]`.
- Do not use `templates[0]`.
- Zero matching templates means unresolved.
- More than one distinct primary match means ambiguous/error.
- Catalog Builder must never silently choose an arbitrary template.

---

## 4.5 V2 — Mockup Styles

```text
GET /v2/catalog-products/{id}/mockup-styles
```

Purpose:

```text
Mockup presentation/style metadata
```

Live-proven mockup-style records may contain:

```text
placement
display_name
technique
print_area_width
print_area_height
print_area_type
dpi
mockup_styles
```

Mockup styles may provide:

```text
mockup style IDs
style category/view information
placement
technique
print-area dimensions in inches
DPI
```

Mockup styles are NOT the authoritative source of pixel-level artwork-positioning geometry.

Pixel-level positioning geometry comes from:

```text
GET /v2/catalog-products/{id}/mockup-templates
```

---

## 4.6 Transitional V1 — Catalog Product Discovery

```text
GET /products
```

Current purpose:

```text
Catalog product discovery
```

Live-proven response:

```text
{
  code: 200,
  result: [...]
}
```

Observed:

```text
555 products
no pagination indicated
single response
```

Handled by:

```text
printfulGet()
getCatalogProducts()
```

This remains a transitional V1 dependency until a V2 catalog-product discovery replacement is deliberately live-verified and migrated.

Product detail:

```text
GET /products/{id}
```

Returns:

```text
{
  code: 200,
  result: <flat product object>
}
```

The response does not contain a `variants` array.

The following endpoint is NOT a valid catalog-variant endpoint:

```text
GET /products/{id}/variants
```

It must not be used for Catalog Builder catalog variant retrieval.

---

## 4.7 Transitional V1 — Printfiles, Placement Discovery, and DPI Validation

```text
GET /mockup-generator/printfiles/{id}?technique={technique}
```

Current responsibilities include:

```text
available placement discovery
printfile metadata
DPI validation support
variant-to-printfile metadata
```

The `technique` parameter is required.

Omitting the technique may return production metadata or placements for the wrong production technique.

This V1 dependency may remain until equivalent V2 behavior has been separately live-verified and migrated.

It must NOT be used to redefine V2 catalog variant identity.

---

## 4.8 Transitional V1 — Template Metadata

```text
GET /mockup-generator/templates/{id}?technique={technique}
```

Current remaining responsibilities may include:

```text
conflicting_placements
legacy ProductDesigner
legacy batch/recipe paths
other V1 workflows
```

Catalog Builder production geometry must NOT use V1 `variant_mapping` to resolve a V2 `CatalogVariant.id`.

The following identity crossing is prohibited:

```text
V2 CatalogVariant.id
        ↓
V1 variant_mapping.variant_id
```

unless a future explicit and live-proven crosswalk is intentionally introduced.

No such crosswalk currently exists.

Catalog Builder production geometry should use the V2 mockup-template contract instead.

---

## 4.9 Transitional V1 — Mockup Task Creation and Polling

Current mockup generation uses:

```text
POST /mockup-generator/create-task/{id}

GET /mockup-generator/task?task_key=...
```

These remain V1 dependencies until the V2 mockup-task contract is separately live-verified and deliberately migrated.

Do not migrate mockup creation or polling through inference alone.

A V2 replacement must first undergo controlled live contract verification.

---

## 4.10 Legacy Provider-Managed / Sync Path

`printful_sync` is a legacy/compatibility path.

It must NOT automatically be treated as the primary CountyBuys product architecture.

The primary CountyBuys product model is:

```text
CountyBuys Product UUID
        ↓
CountyBuys Store Variant UUID
        ↓
Printful Catalog Variant ID
        ↓
Provider production / fulfillment
```

CountyBuys owns the commercial storefront catalog.

Printful provides manufacturing capabilities and provider identities.

Existing `printful_sync` products and workflows should remain compatible until a separate architecture audit determines whether the provider-managed/sync model is still needed.

New Catalog Builder functionality must NOT create a Printful Sync Product merely to enable fulfillment.

The long-term need for `printful_sync` must be evaluated separately rather than assumed.

---

## 4.11 V1 and V2 Response Helpers

`printfulGet()` handles V1 envelopes such as:

```text
{
  code,
  result
}
```

`printfulGetV2()` handles V2 envelopes such as:

```text
{
  data,
  paging,
  extra,
  _links
}
```

These helpers must NOT be used interchangeably.

Using the wrong helper may cause silent data loss, undefined values, or incorrect normalization.

---

## 4.12 Provider Identity Boundary Rule

Never assume identifiers returned by different Printful API generations represent the same namespace.

In particular:

```text
V2 CatalogVariant.id
!=
V1 mockup-generator variant_mapping.variant_id
```

unless explicitly proven otherwise.

Do NOT resolve an identity mismatch by using:

```text
variant_mapping[0]
templates[0]
the first returned record
an arbitrary fallback
```

Provider identity transitions must be explicit and live-proven.

For Catalog Builder production geometry, V2 `catalog_variant_ids` must be used directly where the V2 mockup-template endpoint supports them.

---

## 4.13 Migration Rule

The Printful migration policy is:

```text
V2-FIRST for new Catalog Builder development.

Keep V1 only where:
- required by an existing workflow; or
- the V2 replacement has not yet been live-verified.
```

Each V1 → V2 capability migration must follow:

```text
1. Controlled read-only live contract verification
2. Capture actual provider response shape
3. Define a bounded implementation scope
4. Implement without mixing incompatible identity namespaces
5. Add regression tests
6. Run TypeScript and production build verification
7. Perform operator verification
8. Remove the obsolete Catalog Builder V1 dependency only after verification
```

Do NOT perform broad speculative V1 → V2 migrations.

---

## 4.14 New V1 Dependency Rule

New Catalog Builder features must not introduce a V1 dependency merely because:

```text
similar V1 code already exists
a legacy helper is convenient
a historical report used V1
```

Before introducing a new V1 dependency, determine whether an appropriate V2 capability exists.

If a V2 capability exists but has not yet been verified:

```text
STOP
→ perform controlled read-only V2 contract verification
→ then decide implementation
```

V1 remains a compatibility mechanism, not the preferred direction for new Catalog Builder development.

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

`getCatalogVariants()` always returns one of exactly three values: `"eligible"`, `"unavailable"`, or `"error"`. It never returns `"unknown"`.

### Provider result states (returned by `getCatalogVariants()`)

| State | Meaning |
|---|---|
| `eligible` | V2 variant identity accessible for current store/region |
| `unavailable` | Provider explicitly returned regional unavailability (404 with region message) |
| `error` | Unexpected provider or system failure |

### UI / pre-validation state (NOT returned by `getCatalogVariants()`)

| State | Meaning |
|---|---|
| `unknown` | Eligibility not yet established — `getCatalogVariants()` has not yet been called for this product in the current session |

`"unknown"` is **not** part of `CatalogVariantEligibility`. It is a higher-level UI and `ProductSummary` layer concept representing the state before variant retrieval has been performed. It is never a return value of `getCatalogVariants()`.

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
provider_cost: null   // unknown — V2 catalog-variants endpoint does not provide cost;
                      // authoritative cost is resolved separately through
                      // GET /v2/catalog-products/{id}/prices

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

Production metadata follows the V2-first policy defined in Section 4.

Catalog Builder and legacy V1 workflows must not share variant identity implicitly.

---

### 8.1 Catalog Builder — V2 Production-Template Geometry

For `catalog_source = catalog_builder`, authoritative artwork-positioning geometry comes from:

```text
GET /v2/catalog-products/{id}/mockup-templates
```

This endpoint uses the same V2 catalog variant ID namespace as `CatalogVariant.id`. No V1 variant ID translation is required or permitted.

Live-proven V2 template records contain:

```text
catalog_variant_ids    — V2 catalog variant IDs (same namespace as CatalogVariant.id)
placement
technique              — lowercase (e.g. "dtfilm")
print_area_width       — pixels
print_area_height      — pixels
print_area_top         — pixels
print_area_left        — pixels
template_width         — pixels
template_height        — pixels
image_url
background_url
background_color
printfile_id
orientation
template_positioning
template_type
role                   — "primary" | "template"
```

There is no V1 `template_id` field. There is no nested `variant_mapping` structure.

Authoritative Catalog Builder template resolution:

```text
catalog_variant_ids.includes(selectedCatalogVariantId)
AND technique matches selected technique
AND placement matches selected placement
AND role === "primary"
```

The resolved record supplies the pixel-level geometry required for artwork canvas positioning.

Resolution outcomes:

```text
exactly one primary match  →  resolved
zero primary matches       →  unresolved — do not proceed
multiple distinct matches  →  ambiguous/error — do not proceed
```

Rules:

- Retrieve all pages before resolving.
- Do not translate V2 catalog variant IDs into V1 variant IDs for Catalog Builder geometry.
- Do not use `variant_mapping[0]` for Catalog Builder template resolution.
- Do not use `templates[0]` for Catalog Builder template resolution.
- Do not silently choose an arbitrary template record.
- Catalog Builder must never resolve production geometry through the V1 `variant_mapping` path.

---

### 8.2 Transitional V1 — Placement Discovery and DPI Validation

The following V1 endpoint remains authorized temporarily:

```text
GET /mockup-generator/printfiles/{id}?technique={technique}
```

Current Catalog Builder responsibilities:

```text
available placement discovery
printfile metadata
DPI / artwork validation
variant-to-printfile mapping
```

The `technique` parameter is required. Omitting it may return metadata for the wrong production technique.

This V1 dependency remains **transitional** until an equivalent V2 capability is separately live-verified and migrated.

It must not be used to redefine or translate V2 catalog variant identity.

---

### 8.3 Transitional V1 — Template Metadata

The V1 endpoint:

```text
GET /mockup-generator/templates/{id}?technique={technique}
```

may remain for capabilities not yet replaced in V2, including:

```text
conflicting_placements
legacy ProductDesigner
legacy batch/recipe paths
other explicitly preserved V1 workflows
```

V1 `variant_mapping` remains valid **only** where both sides of the operation use the V1 identity namespace:

```text
V1 PrintfulVariant.id
        ↓
V1 variant_mapping.variant_id
```

This relationship may remain in legacy ProductDesigner or other verified V1-only workflows.

The following identity crossing is **prohibited**:

```text
V2 CatalogVariant.id
        ↓
V1 variant_mapping.variant_id
```

unless a future explicit crosswalk is separately live-proven and deliberately introduced. No such crosswalk currently exists.

---

### 8.4 Technique Awareness

Production metadata must always remain technique-aware.

- `fetchPrintfileSpec()` requires `technique` — `src/lib/fulfillment/artwork-validation.ts`
- `getPrintfiles()` passes `?technique=` — `src/lib/printful/templates.ts`
- `getLayoutTemplates()` passes `?technique=` for remaining V1 callers — `src/lib/printful/templates.ts`
- Changing technique invalidates stale placement/template state
- Changing technique invalidates stale artwork validation
- Changing technique or placement invalidates stale provider cost
- Selecting a placement triggers revalidation against the current technique

A production object resolved for one technique or placement must never remain authoritative after that production configuration changes.

Technique key casing may differ across V1 and V2 responses:

```text
V1 returns: "DTFILM"   (uppercase)
V2 returns: "dtfilm"   (lowercase)
```

Comparisons across V1/V2 boundaries must normalize casing. Do not change the underlying provider key merely for display purposes.

`VALID_TECHNIQUES` is defined in `src/lib/printful/techniques.ts`.

---

### 8.5 Mockup Styles

For Catalog Builder, V2 mockup presentation metadata is available from:

```text
GET /v2/catalog-products/{id}/mockup-styles
```

Live-proven mockup-style records may contain:

```text
placement
display_name
technique
print_area_width    — inches (not pixels)
print_area_height   — inches (not pixels)
print_area_type
dpi
mockup_styles[]     — style IDs, category names, view names
```

Mockup styles are **not** the authoritative source of pixel-level production geometry.

Pixel-level artwork-positioning geometry comes exclusively from:

```text
GET /v2/catalog-products/{id}/mockup-templates
```

---

### 8.6 Conflicting Placements

`conflicting_placements` is currently supplied by the V1 template response.

Until a V2 replacement is live-verified, V1 `conflicting_placements` remains a transitional authorized dependency.

It must remain isolated from Catalog Builder V2 template identity resolution.

`getLayoutTemplates()` normalizes `conflicting_placements` to `Record<string, string[]>` before returning, because Printful may return it as either an array or a Record.

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

CountyBuys commerce identity and Stripe payment behavior are independent of the Printful API generation used underneath the provider adapter.

---

### 10.1 Catalog Builder Products — Primary Fulfillment Path

```text
catalog_source = catalog_builder
products.printful_id = NULL
products.printful_catalog_id = Printful catalog product ID
```

Fulfillment strategy: `DIRECT_CATALOG_ORDER`

The manufacturing identity chain is:

```text
CountyBuys Store Variant UUID
        ↓
stored Printful V2 Catalog Variant ID
        ↓
immutable production configuration
        ↓
immutable artwork / files
        ↓
Printful provider order
```

A Printful Sync product is not required.

New fulfillment development must follow the V2-first policy in Section 4.

Existing working Stripe behavior must not be redesigned as part of Printful migration.

Protected commerce behavior includes:

```text
Stripe Checkout
Stripe webhook verification
payment idempotency
purchase records
CountyBuys product UUIDs
CountyBuys store variant UUIDs
immutable fulfillment snapshots
```

Printful V1/V2 migration occurs below this commerce boundary.

#### Workstream B — V2 Fulfillment Capabilities (Operator Verified)

All DIRECT_CATALOG_ORDER fulfillment now uses Printful V2. Operator-verified in Workstream B.

| Capability | Endpoint | Status |
|---|---|---|
| Shipping rates | `POST /v2/shipping-rates` | V2 — operator verified |
| Draft order creation | `POST /v2/orders` | V2 — operator verified |
| Order retrieval | `GET /v2/orders/{id}` | V2 — operator verified |
| External ID recovery | `GET /v2/orders/@{external_id}` | V2 — live-proven Batch 2, implementation verified |
| Order cancellation | `DELETE /v2/orders/{id}` | V2 — operator verified |
| Explicit confirmation | `POST /orders/{id}/confirm` | **V1 LEGACY EXCEPTION** — V2 `/confirmation` endpoint exists but is not live-verified because confirmation may trigger manufacturing. Must never be called automatically. Explicit operator/admin action only. |

V2 shipping request shape (DIRECT_CATALOG_ORDER only):

```text
POST /v2/shipping-rates
{
  recipient: { ... },
  order_items: [{ source: "catalog", catalog_variant_id: <V2 id>, quantity }],
  currency: "USD",
  locale: "en_US"
}
Response: { data: [{ rate: "...", ... }], extra: [] }
```

V2 order creation request shape:

```text
POST /v2/orders
{
  external_id: "so-<29 chars>",
  shipping: "STANDARD",
  recipient: { ... },
  order_items: [{
    source: "catalog",
    catalog_variant_id: <snapshot.printful_catalog_variant_id>,
    quantity,
    retail_price: "...",
    placements: [{ placement, technique, layers: [{ type: "file", url: <snapshot.artwork_url> }] }]
  }]
}
Response: { data: { id, external_id, status: "draft", ... }, extra: [] }
```

Duplicate external_id recovery (V2):

```text
error.reason === "BadRequest"
AND error.message contains "External ID validation error"
        ↓
GET /v2/orders/@{external_id}
        ↓
data.id  →  orders.printful_order_id
```

V1 OR-13 recovery remains for SYNC_VARIANT path only.

Mixed-cart rule: if any item in a checkout is SYNC_VARIANT or has no snapshot, the entire order uses V1. No V2 shape is invented for sync items.

---

### 10.2 Legacy Sync Products — Compatibility Path

**FINAL DISPOSITION: OPTIONAL** — see §3 and Workstream C audit in `CONTRACT-CHANGE-LOG.md`

```text
catalog_source = printful_sync
products.printful_id = Printful Sync product ID (non-null)
```

Fulfillment strategy: `SYNC_VARIANT`

This path remains for the one existing sync product (Lightweight quarter-zip pullover). Zero orders have used this path. The sync infrastructure is retained as OPTIONAL — it may be removed after the operator confirms the quarter-zip is rebuilt as a Catalog Builder product or intentionally retired.

This path must not become an automatic fallback for Catalog Builder fulfillment.

There must be no silent fallback:

```text
DIRECT_CATALOG_ORDER
        ↓
SYNC_VARIANT
```

If direct catalog fulfillment fails, the failure must remain visible.

---

### 10.3 Migration Rule

Existing production-proven fulfillment behavior must be preserved while Printful provider calls are migrated.

A V1 fulfillment capability may remain when:

- V2 does not currently provide the required operation;
- the V2 replacement has not yet been live-verified;
- an existing legacy product explicitly depends on the V1 path.

The long-term need for `SYNC_VARIANT` must be decided separately after its actual production dependencies are audited.

Strategy resolution currently remains in:

```text
src/lib/fulfillment/resolver.ts — resolveFulfillmentSnapshot()
```

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
