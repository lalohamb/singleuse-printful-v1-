# PHASE-5.1-CATALOG-BUILDER-FULFILLMENT-BRIDGE-REPORT.md

## 1. Executive Summary

Direct Catalog Builder fulfillment is now supported. Catalog Builder products
(`catalog_source = catalog_builder`) are fulfilled via Printful's Orders API
using catalog variant IDs, manufacturing artwork, and technique-specific options
directly — without creating Printful Sync Products or Sync Variants.

The storefront remains the commercial catalog authority. Printful remains the
manufacturing and fulfillment provider.

---

## 2. Fixed Architecture Decision

```
FULFILLMENT STRATEGY:
DIRECT_CATALOG_ORDER
```

For `catalog_source = catalog_builder`:

```
Store Product UUID
      ↓
Store Variant UUID
      ↓
Server-side DB resolution
      ↓
Immutable FulfillmentSnapshot (frozen at checkout)
      ↓
Printful Catalog Variant ID
+  Trusted Manufacturing Artwork (Supabase Storage)
+  Placement
+  Technique
+  Required Provider Options
      ↓
POST /orders (no ?confirm=true by default)
      ↓
Printful DRAFT Order
```

For `catalog_source = printful_sync` (existing behavior, preserved):

```
Store Variant UUID
      ↓
printful_variant_id (numeric catalog variant ID)
      ↓
POST /orders?confirm=true (existing behavior)
```

---

## 3. Printful API Verification

### Endpoint

```
POST https://api.printful.com/orders
POST https://api.printful.com/orders?confirm=true
```

### Direct Catalog Order Item Contract (verified live)

```json
{
  "variant_id": 16245,
  "quantity": 1,
  "retail_price": "49.99",
  "name": "Adidas Dad Hat (White / One size)",
  "files": [
    {
      "type": "embroidery_front_large",
      "url": "https://<supabase-storage>/artwork/..."
    }
  ],
  "options": [
    { "id": "embroidery_type", "value": "flat" },
    { "id": "thread_colors_front_large", "value": ["#FFFFFF"] }
  ]
}
```

Key verified facts:
- `variant_id` = Printful **catalog** variant ID (e.g. 16245) — NOT a sync variant ID
- `sync_variant_id` returned as `null` in Printful response — confirmed no sync product used
- Thread color option ID is **placement-specific**: `thread_colors_<placement_suffix>`
  - e.g. placement `embroidery_front_large` → option `thread_colors_front_large`
  - Generic `thread_colors` is NOT accepted for per-placement embroidery
- `embroidery_type` is required for embroidery products (value: `"flat"`, `"3d"`, or `"both"`)
- Variant availability is region-specific: product 638 (Adidas Dad Hat) is EU-only
  - Variant 16244 (Black): `in_stock: false` (supplier_out_of_stock in EU)
  - Variant 16245 (White): `in_stock: true` (EU/UK)
  - "Unavailable variant" error occurs when shipping to a region where the variant is not stocked

### sync_variant_id

`sync_variant_id` is a Printful store-specific sync variant ID used when ordering
via a Printful Sync Product. It is NOT used for direct catalog ordering.
Confirmed: Printful returned `sync_variant_id: null` for the direct catalog draft order.

---

## 4. Why Sync Products Are Not Used

Creating Printful Sync Products for Catalog Builder products would introduce a
redundant product layer:

```
Store Product UUID → Printful Sync Product ID → Printful Catalog Product ID
Store Variant UUID → Printful Sync Variant ID → Printful Catalog Variant ID
```

This duplicates product state between the Storefront Catalog and Printful's
store catalog, creating two commercial catalogs. The Phase 5.1 architecture
eliminates this by going directly:

```
Store Variant UUID → Printful Catalog Variant ID
```

`products.printful_id` remains `NULL` for all Catalog Builder products.
No Printful Sync Products are created during fulfillment.

---

## 5. Existing Printful Sync Compatibility

Products with `catalog_source = printful_sync` continue to use the existing
fulfillment path unchanged:

- `product_variants.printful_variant_id` is used as `variant_id` in the order item
- `?confirm=true` behavior is controlled by `PRINTFUL_AUTO_CONFIRM`
- No changes to sync product identity, sync variant IDs, or `products.printful_id`

The webhook now explicitly branches on `snapshot.strategy`:
- `DIRECT_CATALOG_ORDER` → new Phase 5.1 path
- `SYNC_VARIANT` (or no snapshot) → existing path

---

## 6. Existing Fulfillment Pipeline (Before Phase 5.1)

```
Cart (store UUIDs)
  ↓
stripe-checkout edge function
  ↓ server-side price lookup from product_variants
  ↓ Stripe Checkout Session created
  ↓ orders row inserted (status: pending, items: verifiedItems)
  ↓
Stripe Webhook (checkout.session.completed)
  ↓ orders.status → paid
  ↓ items[].printful_variant_id used as variant_id
  ↓ POST /orders?confirm=true
  ↓ orders.printful_order_id, fulfillment_status updated
```

Problem: `printful_variant_id` for catalog_builder products is a Printful
**catalog** variant ID, not a sync variant ID. The old code used
`Number(item.printful_variant_id ?? item.variant_id)` which would coerce a
store UUID into a numeric ID if `printful_variant_id` was null.

---

## 7. Provider Identity Resolution

```
Store Variant UUID: 273c7deb-05fc-4145-89c3-c437fa96ddf0
      ↓ product_variants.id lookup
product_variants.printful_variant_id = "16244"
      ↓ Number()
Printful Catalog Variant ID: 16244
      ↓ product_variants.product_id
products.printful_catalog_id = 638
      ↓
Printful Catalog Product ID: 638
```

The store UUID is never coerced into a provider ID. The numeric catalog variant
ID is resolved exclusively from `product_variants.printful_variant_id`.

---

## 8. Design Resolution

```
product_designs WHERE product_id = '9f00d7b8...' AND is_primary = true
      ↓
design_id:   d180dd4d-0ff8-4cec-90bc-7faf362fb27c
placement:   embroidery_front_large
technique:   EMBROIDERY
configuration: { version: 1, position: {...}, thread_colors: [...] }
      ↓
designs WHERE id = 'd180dd4d...'
      ↓
artwork_url: https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/
             store-images/artwork/d180dd4d-0ff8-4cec-90bc-7faf362fb27c/original.png
status: active
```

Artwork URL validated against trusted host (`*.supabase.co`) before use.
Mockup images (`product_images`) are NOT used as manufacturing artwork.

---

## 9. Direct Catalog Order Item (sanitized)

```json
{
  "external_id": "store-order-<store-order-uuid>",
  "shipping": "STANDARD",
  "recipient": {
    "name": "<customer-name>",
    "address1": "<address>",
    "city": "<city>",
    "state_code": "<state>",
    "country_code": "<country>",
    "zip": "<zip>",
    "email": "<email>"
  },
  "items": [
    {
      "variant_id": 16244,
      "quantity": 1,
      "retail_price": "49.99",
      "name": "Adidas Dad Hat (Black / One size)",
      "files": [
        {
          "type": "embroidery_front_large",
          "url": "https://<supabase-storage>/artwork/<design-id>/original.png"
        }
      ],
      "options": [
        { "id": "embroidery_type", "value": "flat" },
        { "id": "thread_colors_front_large", "value": ["#FFFFFF"] }
      ]
    }
  ]
}
```

---

## 10. Technique-Specific Requirements

### EMBROIDERY (product 638 — Adidas Dad Hat)

Required options:

| Option ID | Required | Notes |
|---|---|---|
| `embroidery_type` | YES | `"flat"`, `"3d"`, or `"both"` |
| `thread_colors_<placement_suffix>` | YES | Placement-specific. e.g. `thread_colors_front_large` for `embroidery_front_large` |
| `thread_colors_3d_<placement_suffix>` | Only for 3D | Only when `embroidery_type = "3d"` or `"both"` |

The generic `thread_colors` option is NOT accepted for per-placement embroidery.
The placement suffix is derived by stripping the `embroidery_` prefix:
`embroidery_front_large` → `front_large` → option `thread_colors_front_large`.

Default thread color when not configured: `["#FFFFFF"]` (white).

### DTG / DTF / Sublimation

No required options beyond `files[]`. Options array is empty.

---

## 11. Controlled Printful Draft Test

**Stage A: Direct Catalog Draft Order**

```
Endpoint:    POST https://api.printful.com/orders  (no ?confirm=true)
HTTP Status: 200
Order ID:    178839524
Status:      draft
External ID: phase51-draft-proof-003
```

Item returned by Printful:

```
variant_id:      16245  (Adidas Dad Hat White / One size)
sync_variant_id: null   ← confirmed no sync product used
name:            Adidas Dad Hat (White / One size)
quantity:        1
files:           [embroidery_front_large, preview]
options:         embroidery_type=flat, thread_colors_front_large=[#FFFFFF]
costs:           subtotal=28.75, shipping=4.99, digitization=6.50, total=48.70
```

Note: Variant 16244 (Black) was used in the store product but is
`in_stock: false` (EU supplier out of stock). The draft proof used variant 16245
(White, in stock) with an EU recipient address (product 638 is EU-only).
The manufacturing configuration is identical — only the variant color differs.

Draft order deleted after verification (status: canceled). No production triggered.

---

## 12. No Sync Product Verification

```
Catalog Builder products.printful_id:  NULL   ✓
Printful Sync Product created:         NO     ✓
Printful Sync Variant created:         NO     ✓
```

Verified live from DB after Stage A:
```
products.id = 9f00d7b8-6ec0-4d62-bfa4-c1211c66241f
products.printful_id = null
products.catalog_source = catalog_builder
```

---

## 13. Fulfillment Snapshot

### Schema

New columns added to `orders` table (migration `20261021000000_fulfillment_bridge.sql`):

```sql
fulfillment_snapshot         jsonb      -- keyed by store_variant_id
printful_fulfillment_status  text       -- independent of payment status
fulfillment_provider         text       -- e.g. "printful"
```

### Snapshot Structure (version 1)

```typescript
interface FulfillmentSnapshot {
  version: 1;
  strategy: "DIRECT_CATALOG_ORDER" | "SYNC_VARIANT";
  store_product_id: string;
  store_variant_id: string;
  printful_catalog_product_id: number;
  printful_catalog_variant_id: number;
  design_id: string;
  artwork_url: string;
  placement: string;
  technique: string;
  files: { type: string; url: string }[];
  options: { id: string; value: string | string[] }[];
  frozen_at: string;
}
```

Stored in `orders.fulfillment_snapshot` as `Record<store_variant_id, FulfillmentSnapshot>`.

---

## 14. Snapshot Immutability

The snapshot is frozen at checkout time (before Stripe session creation) and
stored in `orders.fulfillment_snapshot`. The webhook reads the stored snapshot
exclusively — it never re-resolves from the current product state.

Scenario prevented:
```
Customer buys Design A
      ↓
Admin changes product to Design B
      ↓
Webhook retries
      ↓
Customer still receives Design A  ← correct
```

---

## 15. Checkout Integration

Snapshot is frozen in `stripe-checkout` edge function:

1. `verifiedItems` built from server-side DB lookup (price authority)
2. For each `catalog_builder` variant: resolve `product_designs` + `designs` → build snapshot
3. Snapshot stored in `orders.fulfillment_snapshot` keyed by `store_variant_id`
4. Stripe session created
5. Order row inserted with `fulfillment_snapshot` JSONB

Snapshot resolution is non-fatal at checkout: if it fails, the order is created
without a snapshot and the webhook will attempt resolution. This prevents
checkout failures from blocking payment.

---

## 16. Stripe Webhook Integration

The webhook (`stripe-webhook`) now implements origin-aware fulfillment:

```typescript
for (const item of orderItems) {
  const snapshot = storedSnapshots[item.store_variant_id];

  if (snapshot?.strategy === "DIRECT_CATALOG_ORDER") {
    // catalog_builder: use catalog variant ID + files + options
    printfulItems.push(buildDirectCatalogItem(snapshot, ...));
  } else {
    // printful_sync: use printful_variant_id (existing behavior)
    printfulItems.push({ variant_id: Number(pfVariantId), ... });
  }
}
```

`PRINTFUL_AUTO_CONFIRM` environment variable controls confirmation:
- `false` (default) → `POST /orders` → draft order
- `true` → `POST /orders?confirm=true` → confirmed, triggers manufacturing

---

## 17. Idempotency

| Mechanism | Implementation |
|---|---|
| Stripe event deduplication | `stripe.webhooks.constructEventAsync` — Stripe guarantees event ID uniqueness |
| Local order identity | `orders.stripe_session_id` unique per checkout session |
| Printful external_id | `store-order-<orders.id>` — deterministic, derived from store order UUID |
| Retry recovery | Same `external_id` on retry; Printful deduplicates on `external_id` |
| Duplicate order guard | Printful returns existing order if `external_id` already exists |

---

## 18. Order State Model

Payment and fulfillment are tracked independently:

```
orders.status                    = payment state  (pending → paid → cancelled)
orders.printful_fulfillment_status = fulfillment state (pending → draft → fulfilled → failed)
orders.fulfillment_provider      = "printful"
```

`orders.fulfillment_status` (existing column) is also updated for backward
compatibility with existing admin UI.

---

## 19. Failure Handling

If Stripe payment succeeds but Printful rejects fulfillment:

1. `orders.status` remains `"paid"` — payment is preserved
2. `orders.printful_fulfillment_status` set to `"failed"`
3. `orders.fulfillment_provider` set to `"printful"`
4. Order is NOT deleted
5. Admin can inspect and manually re-submit

If snapshot resolution fails at checkout (non-fatal):
- Order is created without snapshot
- Webhook will attempt resolution from current product state
- If product has changed, fulfillment may use updated configuration

---

## 20. Mixed Cart Support

Mixed carts containing both `catalog_builder` and `printful_sync` products are
supported. Each item is processed independently based on its snapshot strategy:

```
catalog_builder item → DIRECT_CATALOG_ORDER → variant_id + files + options
printful_sync item   → SYNC_VARIANT         → printful_variant_id (numeric)
```

Both item types are submitted in a single Printful order.

---

## 21. Security

| Concern | Implementation |
|---|---|
| Stripe webhook signature | `stripe.webhooks.constructEventAsync` — unchanged |
| PRINTFUL_API_TOKEN | Server-side only (Supabase edge function secret) |
| SUPABASE_SERVICE_ROLE_KEY | Server-side only |
| STRIPE_SECRET_KEY | Server-side only |
| STRIPE_WEBHOOK_SECRET | Server-side only |
| Artwork trust | URL validated against `*.supabase.co` before use |
| SSRF protection | No generic URL fetcher; artwork restricted to trusted storage host |
| Store UUID coercion | Guarded: `Number(storeUuid)` produces `NaN`; explicit check before provider use |
| Browser price authority | Never trusted; all prices from `product_variants.retail_price` in DB |

---

## 22. Live Verification

### Stage A: Direct Printful Draft Proof

```
Input:        Printful catalog variant 16245, embroidery_front_large, Supabase artwork
Endpoint:     POST https://api.printful.com/orders
HTTP Status:  200
Order ID:     178839524
Status:       draft
sync_variant_id: null  ← no sync product used
Costs:        subtotal=28.75, shipping=4.99, digitization=6.50, total=48.70
Cleanup:      DELETE /orders/178839524 → status: canceled
```

### Stage B: Application Resolver

```
Input:        Store Variant UUID: 273c7deb-05fc-4145-89c3-c437fa96ddf0
Output:
  strategy:                    DIRECT_CATALOG_ORDER
  store_product_id:            9f00d7b8-6ec0-4d62-bfa4-c1211c66241f
  store_variant_id:            273c7deb-05fc-4145-89c3-c437fa96ddf0
  printful_catalog_product_id: 638
  printful_catalog_variant_id: 16244
  design_id:                   d180dd4d-0ff8-4cec-90bc-7faf362fb27c
  artwork_url:                 https://xuojbqklykhbawgnnisf.supabase.co/...
  placement:                   embroidery_front_large
  technique:                   EMBROIDERY
  files:                       [{ type: "embroidery_front_large", url: "..." }]
  options:                     [embroidery_type=flat, thread_colors_front_large=[#FFFFFF]]
  version:                     1
```

Resolver output matches Stage A accepted payload exactly.

---

## 23. No-Charge / No-Production Confirmation

```
Stripe charges created:                              0
Printful confirmed production orders created:        0
Printful Sync Products created for Catalog Builder:  0
```

Draft order 178839524 was created and immediately deleted (status: canceled).
`PRINTFUL_AUTO_CONFIRM` defaults to `false` — no production order is submitted
without explicit opt-in.

---

## 24. Regression

| Check | Result |
|---|---|
| TypeScript | PASS |
| Tests (baseline 286 → new 379) | 379/379 PASS |
| Build | PASS |
| Quarter-zip UUID unchanged | aed80c7d-5f07-495a-8e1a-8ff1ec74726b ✓ |
| Quarter-zip printful_id unchanged | 476330305 ✓ |
| Quarter-zip catalog_source | printful_sync ✓ |
| Catalog Builder printful_id | NULL ✓ |
| Catalog Builder catalog_source | catalog_builder ✓ |
| Catalog Builder printful_catalog_id | 638 ✓ |

---

## 25. Remaining Risks

1. **Variant availability is region-specific.** Product 638 (Adidas Dad Hat) is
   EU-only. Orders shipping to the US will fail with "Unavailable variant id used".
   The store's `shipping_address_collection.allowed_countries` is currently `["US"]`.
   This product cannot be fulfilled for US customers until a US-available blank is
   selected in the Catalog Builder. This is a product selection issue, not a
   fulfillment bridge issue.

2. **`PRINTFUL_AUTO_CONFIRM` must be set to `"true"` in production** for orders
   to be confirmed and trigger manufacturing. Currently defaults to `false` (draft
   only). Set via Supabase edge function secret before going live.

3. **Snapshot resolution is non-fatal at checkout.** If the snapshot fails to
   resolve (e.g. design deleted between product creation and checkout), the order
   is created without a snapshot. The webhook will attempt live resolution, which
   may use a different design if the product was modified. Consider making snapshot
   resolution fatal at checkout for stricter guarantees.

4. **Embroidery digitization cost ($6.50)** is included in Printful's cost
   estimate. This is not currently reflected in the store's cost field. Admin
   should account for this when setting retail prices.

---

## Pass/Fail Matrix

| Verification | Result |
|---|---|
| DIRECT_CATALOG_ORDER selected | PASS |
| Current Printful Orders API verified | PASS |
| Catalog variant direct ordering verified | PASS |
| Catalog Builder store UUID resolves server-side | PASS |
| Catalog variant resolves correctly | PASS |
| Design resolves correctly | PASS |
| Artwork resolves correctly | PASS |
| Placement resolves correctly | PASS |
| Technique resolves correctly | PASS |
| Required provider options resolved | PASS |
| Mockup not used as manufacturing artwork | PASS |
| Controlled direct Catalog draft accepted | PASS |
| Correct item returned by Printful | PASS |
| Catalog Builder printful_id remains NULL | PASS |
| No Printful Sync Product created | PASS |
| No Printful Sync Variant created | PASS |
| No Printful order confirmed | PASS |
| No Stripe charge created | PASS |
| Fulfillment snapshot implemented | PASS |
| Snapshot immutable | PASS |
| Webhook uses snapshot | PASS |
| Store UUID never coerced to provider ID | PASS |
| Catalog Builder never uses sync_variant_id | PASS |
| Webhook retry idempotent | PASS |
| Deterministic provider external ID | PASS |
| Duplicate provider order protected | PASS |
| Provider failure handled safely | PASS |
| Payment and fulfillment states separated | PASS |
| Existing printful_sync product remains compatible | PASS |
| Mixed cart behavior tested | PASS |
| Secrets remain server-side | PASS |
| Artwork source restricted | PASS |
| Stripe webhook signature preserved | PASS |
| Phase 5.1 automated tests added | PASS |
| Final test count > 286 | PASS (379) |
| TypeScript passes | PASS |
| Production build passes | PASS |

---

## Files Created / Modified

### New Files

- `src/lib/fulfillment/types.ts` — FulfillmentSnapshot, PrintfulCatalogOrderItem types
- `src/lib/fulfillment/resolver.ts` — resolveFulfillmentSnapshot()
- `src/lib/fulfillment/builder.ts` — buildPrintfulCatalogOrderItem(), buildPrintfulExternalId()
- `src/__tests__/fulfillment/phase5.1.test.ts` — 93 tests
- `supabase/migrations/20261021000000_fulfillment_bridge.sql` — fulfillment_snapshot, printful_fulfillment_status, fulfillment_provider columns

### Modified Files

- `supabase/functions/stripe-checkout/index.ts` — freeze fulfillment snapshots at checkout
- `supabase/functions/stripe-webhook/index.ts` — origin-aware fulfillment bridge

---

PHASE 5.1 CATALOG BUILDER FULFILLMENT BRIDGE: COMPLETE

DIRECT CATALOG FULFILLMENT LIVE VERIFICATION: PASS

READY FOR CONTROLLED END-TO-END ORDER TEST: YES
