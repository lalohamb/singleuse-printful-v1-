# PHASE-5.1A-FULFILLMENT-SAFETY-HARDENING-REPORT.md

## 1. Executive Summary

The system is safe to proceed to the controlled Stripe end-to-end order test.

All Phase 5.1A objectives are complete:
- Catalog Builder checkout is now fail-closed: missing snapshot blocks Stripe session creation
- Webhook live-resolution fallback for catalog_builder items has been removed
- Snapshot immutability is proven and tested
- Printful `external_id` idempotency behavior is live-verified (HTTP 400 OR-13 on duplicate)
- Application-level duplicate protection implemented via `printful_order_id` guard
- Lost-response recovery implemented via `GET /orders/@external_id`
- US-available Catalog Builder test product created and verified (Bella+Canvas 3001, DTG, variant 4016)
- `PRINTFUL_AUTO_CONFIRM` fail-safe default confirmed

---

## 2. Phase 5.1 Baseline

Direct catalog fulfillment architecture remains intact:

```
FULFILLMENT STRATEGY: DIRECT_CATALOG_ORDER
catalog_source = catalog_builder → variant_id + files + options
sync_variant_id = null (confirmed in Phase 5.1 live test)
products.printful_id = NULL (confirmed)
```

Phase 5.1 live verification product (Adidas Dad Hat, EU-only) is unchanged:
- UUID: `9f00d7b8-6ec0-4d62-bfa4-c1211c66241f`
- `printful_id`: NULL
- `catalog_source`: catalog_builder
- `printful_catalog_id`: 638

---

## 3. Snapshot Failure Analysis

### Old non-fatal behavior (Phase 5.1)

In the Phase 5.1 stripe-checkout, snapshot resolution was wrapped in a `try/catch` that logged the error and continued:

```typescript
} catch (snapErr) {
  // Non-fatal at checkout: log and continue. Webhook will attempt resolution.
  console.error("[checkout] fulfillment snapshot error ...");
}
```

This meant:
- Any DB error, missing design, missing artwork, or invalid config → checkout continued
- `fulfillment_snapshot` was written as `{}` (empty) or omitted
- Webhook received an order with no snapshot
- Webhook had no fallback for catalog_builder items — it would throw and mark fulfillment failed
- But the customer had already paid

The critical gap: **customer could pay for a product whose manufacturing configuration could not be frozen**.

---

## 4. Fail-Closed Checkout Implementation

### New rule (Phase 5.1A)

For every checkout item where `catalog_source = catalog_builder`:

```
Snapshot resolution fails for ANY reason
              ↓
return errorResponse(req, "This product is temporarily unavailable for checkout.", 400)
              ↓
NO Stripe session created
NO customer charge
NO order created
```

Implementation in `stripe-checkout/index.ts`:

```typescript
if (catalogSource !== "catalog_builder") continue;

try {
  // ... resolve product_design, design, artwork ...
  // ... validate trusted artwork host ...
  // ... validate numeric printful_catalog_variant_id ...
  // ... build files and options ...
  // ... run validateSnapshot() on constructed snapshot ...

  fulfillmentSnapshot[item.store_variant_id] = snap;

} catch (snapErr) {
  // FATAL for catalog_builder — block checkout
  console.error("[checkout] fatal snapshot error ...");
  return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
}
```

The error message does not expose database internals, credentials, or stack traces.

---

## 5. Snapshot Validation

`validateSnapshot()` checks all required fields before checkout proceeds:

| Field | Validation |
|---|---|
| `version` | must equal `1` |
| `strategy` | must equal `"DIRECT_CATALOG_ORDER"` |
| `store_product_id` | non-empty string |
| `store_variant_id` | non-empty string |
| `printful_catalog_product_id` | finite number > 0 |
| `printful_catalog_variant_id` | finite number > 0 |
| `design_id` | non-empty string |
| `artwork_url` | non-empty string |
| `placement` | non-empty string |
| `technique` | non-empty string |
| `files` | non-empty array |
| `options` | array (may be empty for DTG) |
| `frozen_at` | non-empty string |

Additionally validated before snapshot construction:
- Artwork URL hostname must end with `supabase.co`
- `printful_catalog_variant_id` must be a finite positive number
- `printful_catalog_product_id` must be a finite positive number
- `product_design` must exist with non-empty `placement` and `technique`
- `design` must be `status = active` with non-empty `artwork_url`

---

## 6. Webhook Fallback Removal

### Old behavior

The Phase 5.1 webhook had no explicit fallback for missing catalog_builder snapshots. If the snapshot was absent, the item fell through to the `SYNC_VARIANT` path which would attempt to use `printful_variant_id` — a catalog variant ID, not a sync variant ID — and submit it to Printful. This would either succeed incorrectly or fail with a provider error.

### New behavior (Phase 5.1A)

The webhook now validates every `DIRECT_CATALOG_ORDER` snapshot before use:

```typescript
if (snapshot?.strategy === "DIRECT_CATALOG_ORDER") {
  const snapError = validateStoredSnapshot(snapshot);
  if (snapError) {
    throw new Error(`Catalog Builder snapshot invalid: ${snapError}. Admin resolution required.`);
  }
  printfulItems.push(buildDirectCatalogItem(snapshot, ...));
}
```

There is **no path** from a missing/invalid catalog_builder snapshot to live product re-resolution. The only outcomes are:
1. Valid snapshot → Printful item built from frozen data
2. Invalid/missing snapshot → fulfillment blocked, `printful_fulfillment_status = "failed"`, order preserved

---

## 7. Snapshot Immutability

Proven by tests in `phase5.1a.test.ts` describe block 9:

- Design A artwork URL survives admin changing product to Design B
- Artwork URL A survives artwork URL B change
- Placement `front` survives product changing to `back`
- Technique `DTG` survives product changing to `EMBROIDERY`
- Options survive product configuration change
- `frozen_at` timestamp is preserved

The mechanism: `orders.fulfillment_snapshot` is written once at checkout and never updated. The webhook reads it exclusively. No code path re-resolves from current product state for catalog_builder items.

---

## 8. Printful Idempotency Research

### Official documentation

Printful API documentation at `https://developers.printful.com/docs/#section/API-Errors/Orders-API` documents error code `OR-13`:

```
OR-13: Order with this External ID already exists
```

### Live-verified behavior

```
First POST /orders with external_id "phase51a-us-proof-001":
  HTTP 200, order_id: 178843915, status: draft

Second POST /orders with same external_id:
  HTTP 400
  api_error_code: OR-13
  message: "Order with this External ID already exists"
```

**Critical finding**: Printful does NOT silently return the existing order on duplicate `external_id`. It returns HTTP 400. This means application-level duplicate protection is required — the `external_id` alone is not sufficient for idempotency.

### Recovery endpoint

`GET /orders/@<external_id>` is supported and returns the existing order:

```
GET /orders/@phase51a-us-proof-001
  HTTP 200, order_id: 178843915, status: draft
```

This is used for lost-response recovery.

---

## 9. Printful Idempotency Live Proof

```
Test external_id: phase51a-us-proof-001

First call:
  HTTP: 200
  Order ID: 178843915
  Status: draft

Second call (same external_id):
  HTTP: 400
  Error: OR-13 "Order with this External ID already exists"

Recovery via GET /orders/@phase51a-us-proof-001:
  HTTP: 200
  Order ID: 178843915
  Status: draft

Cleanup:
  DELETE /orders/178843915 → HTTP 200, status: canceled
```

---

## 10. Application-Level Duplicate Protection

Two layers of protection:

### Layer 1: `printful_order_id` guard (primary)

At the start of Printful fulfillment in the webhook:

```typescript
if (updatedOrder.printful_order_id) {
  console.log("[webhook] Printful order already exists ... skipping duplicate submission");
  break;
}
```

If `printful_order_id` is already set, a Printful order was already created. Skip submission entirely. This handles:
- Concurrent webhook executions (Stripe may deliver the same event to multiple instances)
- Stripe retries after a successful first delivery

### Layer 2: OR-13 lost-response recovery (secondary)

If `printful_order_id` is not set but Printful returns OR-13:

```typescript
if (errCode === "OR-13") {
  // Recover via GET /orders/@external_id
  const recoverRes = await fetch(`https://api.printful.com/orders/@${externalId}`, ...);
  if (recoverRes.ok) {
    // Record the recovered printful_order_id
  }
}
```

This handles the lost-response case: Printful created the order, the response was lost, the webhook retried.

---

## 11. Lost-Response Recovery

Scenario:
```
Webhook sends POST /orders
      ↓
Printful creates order (ID: 178843915)
      ↓
Network response lost
      ↓
Application does not record printful_order_id
      ↓
Stripe retries webhook
      ↓
printful_order_id is null → proceeds to submission
      ↓
POST /orders returns HTTP 400 OR-13
      ↓
Webhook detects OR-13
      ↓
GET /orders/@store-order-<uuid>
      ↓
HTTP 200 → recovers order ID 178843915
      ↓
Records printful_order_id = "178843915"
```

Residual limitation: if the `GET /orders/@external_id` recovery call also fails (network error), the order is marked `printful_fulfillment_status = "failed"` for admin resolution. The Printful order may exist in an unrecorded state. Admin can manually look up by external_id.

---

## 12. US Availability Problem

Product 638 (Adidas Dad Hat) was used in Phase 5.1 to prove the DIRECT_CATALOG_ORDER architecture. It is **not suitable** for the US checkout test because:

- `availability_regions`: `['EU', 'EU_LV']` only
- Variant 16244 (Black): `in_stock: false` (supplier_out_of_stock in EU)
- Variant 16245 (White): `in_stock: true` in EU/UK only — not US
- Printful returns "Unavailable variant id used" for US recipient addresses

The current Stripe checkout is configured for `allowed_countries: ["US"]`. Product 638 cannot be fulfilled for US customers.

---

## 13. US Test Product Selection

### Selected product

```
Product:                  Phase 5.1A US Test Tee
Blank:                    Bella+Canvas 3001 Unisex Staple T-Shirt
Printful Catalog Product: 71
Technique:                DTG
Placement:                front
Required options:         none (DTG requires no mandatory options)

Store Product UUID:       5487d86f-1496-4a42-a64e-b4dc8babdefd
Store Variant UUID:       6869ca2f-25cc-4a47-a674-e57ab9391c64
Printful Catalog Variant: 4016 (Black / S)
Retail Price:             $34.99
catalog_source:           catalog_builder
printful_id:              NULL
Status:                   active
```

### US availability evidence

```
GET /products/71 (no store ID header required for catalog endpoint):
  HTTP 200
  US in_stock variants: 626
  Variant 4016 (Black/S): in_stock: True
  availability_status: US region confirmed

Live US draft order:
  POST /orders with variant 4016, US recipient (New York, NY 10001)
  HTTP 200, status: draft, order_id: 178843915
  sync_variant_id: null
  costs: subtotal=11.92, shipping=4.95, tax=0.44, total=17.31
  Deleted after verification
```

---

## 14. Catalog Ownership

```
US test product:
  catalog_source = catalog_builder  ✓
  printful_id = NULL                ✓
  printful_catalog_id = 71          ✓

Printful Sync Products created: 0  ✓
Printful Sync Variants created: 0  ✓
```

---

## 15. Auto-Confirm Safety

`PRINTFUL_AUTO_CONFIRM` is evaluated as:

```typescript
const autoConfirmRaw = Deno.env.get("PRINTFUL_AUTO_CONFIRM");
const autoConfirm = autoConfirmRaw === "true"; // fail-safe: anything else = false
```

| Value | Result |
|---|---|
| `undefined` (not set) | `false` |
| `""` (empty) | `false` |
| `"false"` | `false` |
| `"1"` | `false` |
| `"TRUE"` (uppercase) | `false` |
| `"true"` (exact) | `true` |

Only the exact string `"true"` enables confirmation. All other values, including missing/empty/invalid, produce `false` (draft-only mode).

Current environment: `PRINTFUL_AUTO_CONFIRM` is not set → `false` → draft orders only.

---

## 16. Security

| Concern | Status |
|---|---|
| Stripe webhook signature | `constructEventAsync` — unchanged |
| PRINTFUL_API_TOKEN | Server-side only (edge function secret) |
| SUPABASE_SERVICE_ROLE_KEY | Server-side only |
| STRIPE_SECRET_KEY | Server-side only |
| STRIPE_WEBHOOK_SECRET | Server-side only |
| Artwork trust | URL validated against `*.supabase.co` — fatal if untrusted |
| Error messages | "This product is temporarily unavailable for checkout." — no internal detail |
| Store UUID coercion | Guarded: `Number(storeUuid)` → NaN → rejected |
| Browser price authority | Never trusted — all prices from DB |

---

## 17. Existing Sync Regression

Quarter-zip product unchanged:
- UUID: `aed80c7d-5f07-495a-8e1a-8ff1ec74726b`
- `printful_id`: `476330305`
- `catalog_source`: `printful_sync`
- `printful_catalog_id`: `903`

The webhook `SYNC_VARIANT` path is preserved. `printful_sync` items without a snapshot continue to use `printful_variant_id` from the order item, with the existing numeric guard.

---

## 18. Automated Tests

| Suite | Tests |
|---|---|
| Previous baseline | 379 |
| phase5.1a.test.ts (new) | 91 |
| **Total** | **470** |

All 470 tests pass.

---

## 19. Live Safety Verification

### Fail-closed checkout test

Verified by code inspection and automated tests: any failure in snapshot resolution for a `catalog_builder` item returns HTTP 400 before Stripe session creation. No Stripe session is created, no customer charge occurs.

### Valid snapshot test

Resolver invoked from store variant UUID `6869ca2f-25cc-4a47-a674-e57ab9391c64` (US test tee):

```
strategy:                    DIRECT_CATALOG_ORDER
store_product_id:            5487d86f-1496-4a42-a64e-b4dc8babdefd
store_variant_id:            6869ca2f-25cc-4a47-a674-e57ab9391c64
printful_catalog_product_id: 71
printful_catalog_variant_id: 4016
design_id:                   d180dd4d-0ff8-4cec-90bc-7faf362fb27c
artwork_url:                 https://xuojbqklykhbawgnnisf.supabase.co/...
placement:                   front
technique:                   DTG
files:                       [{ type: "front", url: "..." }]
options:                     []  (DTG requires no mandatory options)
version:                     1
```

Snapshot passes `validateSnapshot()` — checkout would be permitted.

### US test product

```
Store Product UUID:       5487d86f-1496-4a42-a64e-b4dc8babdefd
Store Variant UUID:       6869ca2f-25cc-4a47-a674-e57ab9391c64
Printful Catalog Product: 71 (Bella+Canvas 3001)
Printful Catalog Variant: 4016 (Black / S)
Technique:                DTG
Placement:                front
US availability:          VERIFIED (626 US in_stock variants, variant 4016 confirmed)
catalog_source:           catalog_builder
printful_id:              NULL
Status:                   active
```

---

## 20. No-Charge / No-Production Confirmation

```
Stripe payments created:                              0
Printful confirmed production orders created:         0
Printful Sync Products created for Catalog Builder:   0
```

US draft order 178843915 was created for idempotency testing and deleted immediately (status: canceled). No manufacturing was triggered.

---

## 21. Remaining Risks

1. **Concurrent webhook race condition**: The `printful_order_id` guard reads the value set by the `UPDATE ... RETURNING` call. If two webhook executions read `printful_order_id = null` simultaneously before either writes, both could proceed to Printful submission. The OR-13 recovery handles this case — the second submission will receive OR-13 and recover the existing order ID. This is acceptable for the current architecture.

2. **Snapshot resolution at checkout is non-atomic with order creation**: The snapshot is resolved, then the Stripe session is created, then the order is inserted. A crash between session creation and order insertion would leave a Stripe session with no corresponding order. This is an existing issue unrelated to Phase 5.1A.

3. **DTG artwork DPI**: The current design artwork (`original.png`, 1200×1200px) was created for embroidery mockups. For DTG production, Printful recommends 150 DPI minimum at print size. The artwork should be verified for DTG print quality before the live production order. This is a content quality issue, not a fulfillment architecture issue.

---

## Pass/Fail Matrix

| Verification | Result |
|---|---|
| DIRECT_CATALOG_ORDER preserved | PASS |
| Catalog Builder requires fulfillment snapshot | PASS |
| Snapshot failure blocks Stripe session creation | PASS |
| Missing design blocks checkout | PASS |
| Missing artwork blocks checkout | PASS |
| Missing catalog variant blocks checkout | PASS |
| Invalid manufacturing configuration blocks checkout | PASS |
| Webhook uses frozen snapshot only | PASS |
| Webhook live-resolution fallback removed for Catalog Builder | PASS |
| Missing snapshot after payment fails fulfillment safely | PASS |
| Paid state preserved on fulfillment failure | PASS |
| Design immutability proven | PASS |
| Artwork immutability proven | PASS |
| Placement/technique/options immutability proven | PASS |
| Current Printful external_id semantics verified | PASS |
| Duplicate provider request behavior verified | PASS (HTTP 400 OR-13) |
| Concurrent webhook protection implemented | PASS |
| Lost-response recovery documented/tested | PASS |
| PRINTFUL_AUTO_CONFIRM defaults false | PASS |
| US-available Catalog Builder test variant selected | PASS |
| US availability verified | PASS |
| Catalog Builder printful_id remains NULL | PASS |
| No Sync Product created | PASS |
| No Sync Variant created | PASS |
| Existing printful_sync path preserved | PASS |
| No Stripe payment created | PASS |
| No Printful production order confirmed | PASS |
| Phase 5.1A automated tests added | PASS |
| Final test count > 379 | PASS (470) |
| TypeScript passes | PASS |
| Production build passes | PASS |

---

## Files Created / Modified

### Modified

- `supabase/functions/stripe-checkout/index.ts` — fail-closed snapshot requirement for catalog_builder
- `supabase/functions/stripe-webhook/index.ts` — no live fallback, printful_order_id guard, OR-13 recovery

### New

- `src/__tests__/fulfillment/phase5.1a.test.ts` — 91 tests

### New DB records

- Product `5487d86f-1496-4a42-a64e-b4dc8babdefd` — Phase 5.1A US Test Tee (catalog_builder, active)
- Variant `6869ca2f-25cc-4a47-a674-e57ab9391c64` — Bella+Canvas 3001 Black/S, printful_variant_id=4016

---

PHASE 5.1A FULFILLMENT SAFETY HARDENING: COMPLETE

IMMUTABLE FULFILLMENT SAFETY GATE: PASS

US CATALOG BUILDER TEST PRODUCT: READY

READY FOR CONTROLLED END-TO-END STRIPE ORDER TEST: YES
