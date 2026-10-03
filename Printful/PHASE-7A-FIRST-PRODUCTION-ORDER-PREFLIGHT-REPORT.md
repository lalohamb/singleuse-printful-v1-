# PHASE 7A — FIRST PRODUCTION ORDER PREFLIGHT & GO/NO-GO VERIFICATION REPORT

**Date**: 2026-10-02  
**Baseline**: Phase 6 COMPLETE / CORE COMMERCE SAFETY GATE: PASS  
**Purpose**: Pre-flight verification only. No order placed. No card charged. No manufacturing authorized.

---

## 1. Executive Summary

Phase 7A conducted a complete pre-flight inspection of every production prerequisite for the first controlled real production order.

**Critical finding**: The manufacturing artwork currently attached to the only available Catalog Builder product (`Phase 5.1A US Test Tee`) is a **test/verification design** (`test_design.png`, `Phase 4 Verification Design`) that **fails the production artwork gate**:

- File: 1200×1200 px, 13.8 KB, 2 unique colors
- Effective DPI at Printful's required canvas (1800×2400 px): **100 DPI**
- Printful minimum: **150 DPI**
- Printful recommended: **300 DPI**
- Design name: "Phase 4 Verification Design" — explicitly a verification artifact
- File name: `test_design.png` — explicitly a test file

**All other gates pass or have clear documented procedures.**

**Phase 7 GO/NO-GO: NO-GO** — artwork must be replaced with production-quality artwork before Phase 7 can proceed.

**Positive findings**:
- Phase 6 DB migration applied successfully (stripe_session_id UNIQUE constraint live)
- Printful catalog product 71 (BC3001) and variant 4016 (Black/S) confirmed active
- PRINTFUL_AUTO_CONFIRM: ABSENT — PASS
- Shipping rate confirmed: $4.95 STANDARD for variant 4016 to US
- TypeScript: PASS, 509/509 tests PASS, Build: PASS

---

## 2. Phase 6 Baseline

| Item | Status |
|---|---|
| Phase 6 | COMPLETE |
| Core commerce safety gate | PASS |
| Production configuration gate | CONDITIONAL |
| TypeScript | PASS |
| Tests | 509/509 PASS |
| Build | PASS |
| DB migration 20261022000000 | APPLIED (this phase) |

---

## 3. Repository Inspection

Files inspected during Phase 7A:

| File | Purpose |
|---|---|
| `supabase/functions/stripe-checkout/index.ts` | Checkout session creation, snapshot freezing |
| `supabase/functions/stripe-webhook/index.ts` | Payment confirmation, Printful submission |
| `supabase/functions/printful-proxy/index.ts` | Printful API proxy (GET/confirm/cancel added Phase 6) |
| `supabase/functions/printful-webhook/index.ts` | Printful status sync (shipped, fulfilled, canceled) |
| `src/lib/fulfillment/resolver.ts` | Server-side snapshot resolution |
| `src/lib/fulfillment/builder.ts` | Printful order item builder, external_id |
| `src/lib/fulfillment/types.ts` | FulfillmentSnapshot type definitions |
| `src/lib/stripe-config.ts` | Stripe key management, mode switching, mixed-env detection |
| `src/app/api/admin/orders/route.ts` | Admin confirm/cancel Printful orders |
| `src/app/api/stripe-setup/route.ts` | Stripe key registration and webhook auto-registration |
| `src/app/api/stripe-switch/route.ts` | Mode switching, pushes secrets to Supabase |
| `src/app/api/stripe-admin/route.ts` | Refunds, balance, charges |
| `src/app/admin/orders/page.tsx` | Admin order management UI |
| `src/app/admin/stripe/page.tsx` | Stripe dashboard and key management UI |
| `src/types.ts` | Order, Product, StoreVariant type definitions |
| `supabase/migrations/20261022000000_phase6_stripe_session_unique.sql` | Phase 6 DB migration |
| `supabase/migrations/20261021000000_fulfillment_bridge.sql` | fulfillment_snapshot, printful_fulfillment_status columns |

---

## 4. Selected First Production Candidate

Two active Catalog Builder products exist in the database:

| Field | Product A | Product B |
|---|---|---|
| UUID | `9f00d7b8-6ec0-4d62-bfa4-c1211c66241f` | `5487d86f-1496-4a42-a64e-b4dc8babdefd` |
| Title | Catalog Builder Verification Hat | Phase 5.1A US Test Tee |
| Slug | catalog-builder-verification-hat | phase-51a-us-test-tee |
| catalog_source | catalog_builder | catalog_builder |
| Status | active | active |
| printful_id | NULL | NULL |
| printful_catalog_id | 638 | 71 |
| Printful product | (hat, catalog 638) | Bella+Canvas 3001 Unisex T-Shirt |

**Product B (`Phase 5.1A US Test Tee`) is the Phase 5.2 verified product** — it was used in the live E2E test that produced Printful draft order 179039375. It is the only product with a verified end-to-end transaction history.

**FIRST PRODUCTION CANDIDATE: `Phase 5.1A US Test Tee`**  
UUID: `5487d86f-1496-4a42-a64e-b4dc8babdefd`

Note: Both products have test/verification names and test artwork. The operator must rename the product and replace the artwork before Phase 7. The product identity chain is otherwise correct.

---

## 5. Product Identity Chain

```
Store Product UUID:     5487d86f-1496-4a42-a64e-b4dc8babdefd
  catalog_source:       catalog_builder
  printful_id:          NULL  ✓
  printful_catalog_id:  71  ✓
  status:               active  ✓
      ↓
Store Variant UUID:     6869ca2f-25cc-4a47-a674-e57ab9391c64
  printful_variant_id:  4016
  label:                Bella+Canvas 3001 (Black / S)
  color:                Black
  size:                 S
  retail_price:         $34.99
  available:            true  ✓
      ↓
Printful Catalog Product ID: 71
  display_name:         Unisex Staple T-Shirt | Bella + Canvas 3001
  brand:                Bella + Canvas
  price:                $11.92 (provider cost)
      ↓
Printful Catalog Variant ID: 4016
  display_name:         Bella + Canvas 3001 (Black / S)
  color:                Black (#0c0c0c)
  size:                 S
  available_as_sample:  true  ✓
```

**Identity chain: VERIFIED**

---

## 6. Variant Verification

| Check | Result |
|---|---|
| catalog_source = catalog_builder | PASS |
| products.printful_id IS NULL | PASS |
| products.printful_catalog_id IS NOT NULL (= 71) | PASS |
| product_variants.printful_variant_id IS NOT NULL (= 4016) | PASS |
| Printful catalog product 71 exists | PASS — BC3001 confirmed via API |
| Printful catalog variant 4016 exists | PASS — Black/S confirmed via API |
| Variant available_as_sample | PASS |
| US destination supported | PASS — shipping rate returned |
| No Sync Product required | PASS — DIRECT_CATALOG_ORDER |
| No Sync Variant required | PASS — DIRECT_CATALOG_ORDER |

---

## 7. Design / Artwork Trace

```
Store Product:    5487d86f-1496-4a42-a64e-b4dc8babdefd
      ↓
product_designs:  2173610a-2099-4cb5-bb15-7f0c8f723377
  design_id:      d180dd4d-0ff8-4cec-90bc-7faf362fb27c
  placement:      front
  technique:      DTG
  is_primary:     true
  configuration:  { version: 1, catalog_product_id: 71 }
      ↓
designs:          d180dd4d-0ff8-4cec-90bc-7faf362fb27c
  name:           Phase 4 Verification Design
  file_name:      test_design.png
  file_type:      image/png
  file_size:      14124 bytes (13.8 KB)
  width:          1200 px
  height:         1200 px
  status:         active
  artwork_url:    https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/
                  public/store-images/artwork/d180dd4d-0ff8-4cec-90bc-7faf362fb27c/original.png
```

**Artwork host**: `xuojbqklykhbawgnnisf.supabase.co` — trusted Supabase Storage ✓

**Artwork is NOT production artwork**: The design name ("Phase 4 Verification Design") and file name ("test_design.png") explicitly identify this as a test/verification artifact created during Phase 4 development. It is not intended for customer-facing manufacturing.

---

## 8. Artwork Technical Inspection

**File downloaded and inspected from Supabase Storage.**

| Property | Value |
|---|---|
| File format | PNG |
| Pixel dimensions | 1200 × 1200 px |
| Aspect ratio | 1:1 (square) |
| Color mode | RGBA (8-bit per channel) |
| Alpha channel | YES — 653,179 fully transparent pixels |
| Opaque pixels | 786,821 |
| File size | 13.8 KB |
| Unique opaque colors | 2: RGB(200,160,50) gold-ish, RGB(30,30,30) near-black |
| Content bounding box | (100,100) to (1101,1101) — 1001×1001 px content area |
| Embedded DPI metadata | Not embedded |
| Design name | "Phase 4 Verification Design" |
| File name | test_design.png |

**Content assessment**: 2-color geometric test pattern. Extremely small file size (13.8 KB) for a 1200×1200 image confirms minimal content. This is a programmatically generated test shape, not production artwork.

---

## 9. Printful Production Requirements

**Source**: Printful Mockup Generator Printfiles API for product 71, variant 4016.

| Property | Requirement |
|---|---|
| Placement | front |
| Printfile ID | 1 |
| Required canvas | 1800 × 2400 px |
| DPI | 150 (Printful minimum) |
| Fill mode | fit |
| Can rotate | false |
| Print area (inches) | 12.0 × 16.0 inches |
| Recommended DPI | 300 DPI (Printful recommendation) |

**Available placements for BC3001**: front, front_large, back, sleeve_left, sleeve_right, label_inside, label_outside, label_inside_dtf

---

## 10. Effective DPI Calculation

**Artwork**: 1200 × 1200 px (square)  
**Required canvas**: 1800 × 2400 px (portrait, 3:4 ratio)  
**Fill mode**: `fit` — artwork scaled to fit within canvas without cropping

```
Scale factor = min(1800/1200, 2400/1200) = min(1.50, 2.00) = 1.50

Rendered size on canvas = 1200 × 1.50 = 1800 px wide
                          1200 × 1.50 = 1800 px tall

Rendered print dimensions = 1800/150 × 1800/150 = 12.0 × 12.0 inches

Effective DPI = artwork_pixels / rendered_pixels × canvas_DPI
              = 1200 / 1800 × 150
              = 100 DPI
```

| Metric | Value | Threshold | Result |
|---|---|---|---|
| Effective DPI | 100 | 150 minimum | **FAIL** |
| Effective DPI | 100 | 300 recommended | **FAIL** |
| Canvas size match | 1200×1200 vs 1800×2400 | Must match | **FAIL** |
| Aspect ratio | 1:1 vs 3:4 | Mismatch (letterboxed) | WARNING |

**To meet Printful's 150 DPI minimum at 12×16 inch print area**: artwork must be at least **1800 × 2400 px**.  
**To meet Printful's 300 DPI recommendation**: artwork must be at least **3600 × 4800 px**.

---

## 11. Print Area Compatibility

The current 1200×1200 artwork, when fit into the 1800×2400 canvas:
- Renders at 12×12 inches (not 12×16)
- Leaves 4 inches of vertical space unused (bottom of print area empty)
- Artwork is not clipped, but it does not fill the intended print area
- The 2-color test pattern would print as a small square in the upper portion of the front print area

**Print area compatibility: FAIL** — artwork does not fill the print area and is below minimum DPI.

---

## 12. Fulfillment Snapshot Verification

The `resolveFulfillmentSnapshot()` function in `src/lib/fulfillment/resolver.ts` was inspected. For the selected candidate it would produce:

```json
{
  "version": 1,
  "strategy": "DIRECT_CATALOG_ORDER",
  "store_product_id": "5487d86f-1496-4a42-a64e-b4dc8babdefd",
  "store_variant_id": "6869ca2f-25cc-4a47-a674-e57ab9391c64",
  "printful_catalog_product_id": 71,
  "printful_catalog_variant_id": 4016,
  "design_id": "d180dd4d-0ff8-4cec-90bc-7faf362fb27c",
  "artwork_url": "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/d180dd4d-0ff8-4cec-90bc-7faf362fb27c/original.png",
  "placement": "front",
  "technique": "DTG",
  "files": [{ "type": "front", "url": "https://xuojbqklykhbawgnnisf.supabase.co/..." }],
  "options": [],
  "frozen_at": "<ISO timestamp>"
}
```

**Snapshot generation: WOULD SUCCEED** — all required fields are present and valid.

**However**: The snapshot would freeze the test artwork URL. If Phase 7 proceeds with this artwork, the manufactured product would print the test design. The snapshot mechanism is correct; the artwork content is not.

**Snapshot does NOT depend on browser-provided data**: price, Printful variant ID, artwork URL, and fulfillment state are all resolved server-side from the database. ✓

---

## 13. Production Database Migration

**Migration**: `20261022000000_phase6_stripe_session_unique.sql`

**Status before Phase 7A**: PENDING (not applied)

**Action taken**: `npx supabase db push` — applied successfully.

**Verification**: `npx supabase migration list` confirms `20261022000000` now shows remote timestamp.

**Result**: APPLIED SUCCESSFULLY

**Constraint active**: `orders_stripe_session_id_unique UNIQUE (stripe_session_id)` is now enforced in production. Concurrent webhook deliveries for the same Stripe session cannot create duplicate orders at the DB layer.

**Pre-flight duplicate check**: The migration's DO block scanned for existing duplicate `stripe_session_id` values before adding the constraint. No duplicates were found (all 41 test orders have unique session IDs).

---

## 14. Database Idempotency Verification

| Layer | Mechanism | Status |
|---|---|---|
| DB UNIQUE constraint | `orders_stripe_session_id_unique` | ACTIVE (applied this phase) |
| Application guard | `printful_order_id` check before Printful submission | ACTIVE |
| Provider uniqueness | Printful `external_id` = `so-<29-char-uuid>` | ACTIVE |
| OR-13 recovery | GET /orders/@<external_id> on duplicate | ACTIVE |
| Admin attention indexes | `idx_orders_fulfillment_status`, `idx_orders_paid_no_printful` | ACTIVE |

---

## 15. Test / Live Data Isolation

**All 41 existing orders**: `livemode=false` (confirmed by DB query — all have `cs_test_` session IDs).

**Admin filter**: Live/Test filter in `/admin/orders` confirmed present. Test orders show amber "Test" badge. Live orders show green "Live" badge.

**Revenue reporting**: Admin Stripe panel filters by `livemode` matching active Stripe mode. Test orders excluded from live revenue.

**Test order deletion**: Trash icon visible only for `livemode=false` orders. Live orders cannot be deleted from admin UI.

**Phase 5.2 evidence preserved**: Order `35f1853d` (Printful draft 179039375, canceled) remains in DB as audit evidence.

**Test/live isolation: PASS**

---

## 16. Stripe LIVE Configuration

**Current state** (verified from DB):

| Setting | Value |
|---|---|
| `stripe_mode` | test |
| `stripe_live_secret_key` | NOT SET |
| `stripe_live_webhook_secret` | NOT SET |
| `stripe_test_secret_key` | SET (sk_test_...) |
| `stripe_test_webhook_secret` | SET |
| Edge fn `STRIPE_SECRET_KEY` | SET — TEST key (inferred: mode=test, live key not in DB) |
| Edge fn `STRIPE_WEBHOOK_SECRET` | SET — TEST secret |

**Live Stripe keys have not been configured.** This is correct and expected for Phase 7A — live keys must not be configured until Phase 7 is authorized.

**Required operator action before Phase 7**:
1. Obtain live Stripe secret key (`sk_live_...`) from Stripe Dashboard
2. Go to `/admin/stripe` → "Connect Stripe"
3. Enter `sk_live_...` key → click "Save & Activate"
4. System will: save key to DB, auto-register live webhook, push secrets to Supabase edge functions, set `stripe_mode=live`
5. Verify LIVE badge appears in admin panel
6. Verify webhook appears in Stripe Dashboard → Webhooks

**Mixed environment check**: `getStripeConfig()` in `stripe-config.ts` logs an error if key prefix doesn't match active mode. With live key + live mode, no mismatch will occur.

**Stripe LIVE configuration: NOT SET — operator action required before Phase 7**

---

## 17. Stripe LIVE Webhook Verification

**Current state**: No live webhook registered (live key not yet configured).

**Expected live webhook endpoint**:
```
https://xuojbqklykhbawgnnisf.supabase.co/functions/v1/stripe-webhook
```

**Required events** (from actual webhook handler code):
- `checkout.session.completed`
- `payment_intent.payment_failed`

**Auto-registration**: When operator saves live key via `/admin/stripe` → "Save & Activate", the `/api/stripe-setup` route automatically:
1. Checks for existing webhook at the endpoint URL
2. Creates new endpoint if not found (returns signing secret)
3. Saves signing secret to `settings.stripe_live_webhook_secret`
4. Pushes both key and webhook secret to Supabase edge function secrets

**Signature verification**: `stripe.webhooks.constructEventAsync(body, signature, webhookSecret)` — active in stripe-webhook edge function. Rejects any request with invalid signature.

**Live webhook: NOT REGISTERED — will be auto-registered when live key is saved**

---

## 18. Printful Configuration

| Item | Status |
|---|---|
| `PRINTFUL_API_TOKEN` in `.env.local` | SET |
| `PRINTFUL_API_TOKEN` in Supabase edge fn secrets | SET |
| Printful API authentication | PASS (catalog API calls succeeded) |
| Catalog product 71 (BC3001) | EXISTS — confirmed via API |
| Catalog variant 4016 (Black/S) | EXISTS — confirmed via API |
| Variant available_as_sample | true |
| Direct catalog ordering | SUPPORTED — DIRECT_CATALOG_ORDER strategy |
| Sync Product required | NO — catalog_builder uses variant_id directly |
| Sync Variant required | NO |
| `PRINTFUL_STORE_ID` | SET (used for sync only, not required for direct catalog) |

---

## 19. PRINTFUL_AUTO_CONFIRM Verification

**Checked locations**:
1. `.env.local` — `PRINTFUL_AUTO_CONFIRM`: NOT PRESENT
2. Supabase edge function secrets (via Management API) — `PRINTFUL_AUTO_CONFIRM`: NOT PRESENT

**Webhook code** (`stripe-webhook/index.ts`):
```typescript
const autoConfirmRaw = Deno.env.get("PRINTFUL_AUTO_CONFIRM");
const autoConfirm = autoConfirmRaw === "true"; // fail-safe: anything else = false
```

**Resolution**: `undefined === "true"` → `false` → orders created as DRAFT.

**PRINTFUL_AUTO_CONFIRM: ABSENT — PASS**

The first real order will stop at Printful DRAFT. No automatic manufacturing will occur.

---

## 20. Admin Production Controls

**`/admin/orders` verified features**:

| Feature | Status |
|---|---|
| Needs Attention filter button with count | PRESENT (Phase 6) |
| needs_admin_review alert banner | PRESENT (Phase 6) |
| failed fulfillment alert banner | PRESENT (Phase 6) |
| paid + no Printful order alert | PRESENT (Phase 6) |
| "Check Printful" button | PRESENT |
| "Sync to Order" button | PRESENT |
| "Confirm → Production" button | PRESENT (Phase 6) — shown only when Printful status = draft AND order status = paid |
| "Cancel Draft" button | PRESENT (Phase 6) — shown only when Printful status = draft |
| Live/Test mode filter | PRESENT |
| Test order deletion | PRESENT (livemode=false only) |

**"Confirm → Production" preconditions** (enforced server-side in `/api/admin/orders`):
- Admin authentication: `requireAdmin()` ✓
- `order.status === "paid"` ✓
- `order.printful_order_id` must be set ✓
- Printful order must be in `draft` status (verified via live API call) ✓
- Fulfillment snapshot validated for catalog_builder items ✓

**"Cancel Draft" preconditions**:
- Admin authentication: `requireAdmin()` ✓
- `order.printful_order_id` must be set ✓
- Printful order must be in `draft` status (verified via live API call) ✓

**Neither operation was executed during Phase 7A.**

---

## 21. Refund / Cancellation Rollback

**Phase 7 rollback procedure** (if anything is wrong after payment but before confirmation):

```
Printful DRAFT exists
    ↓
Admin: /admin/orders → order detail → Check Printful
    ↓
Verify status = draft
    ↓
Click "Cancel Draft"
    ↓
Printful order canceled
    ↓
Local fulfillment_status = cancelled
    ↓
Admin: /admin/stripe → Recent Charges → Refund
    ↓
Stripe refund issued
    ↓
Customer receives refund email (via Resend)
```

**Stripe refund**: Available via `/admin/stripe` → Recent Charges → Refund button. Full or partial. Admin-protected (`requireAdmin()`). Sends customer email.

**Printful cancellation**: Available via `/admin/orders` → order detail → "Cancel Draft". Admin-protected. Only works while Printful order is in draft status.

**Both operations verified as present and admin-protected. Neither was executed during Phase 7A.**

---

## 22. Shipping Verification

**Live Printful shipping rate query** (executed during Phase 7A):

```
POST https://api.printful.com/shipping/rates
Recipient: Los Angeles, CA 90001, US
Items: [{ variant_id: 4016, quantity: 1 }]
```

**Response**:
```
STANDARD:                $4.95 — Flat Rate (Est. delivery: Oct 8–10)
STANDARD_CARBON_OFFSET:  $5.04 — Standard rate with CO2 offsetting
```

**Checkout behavior**: `getPrintfulShipping()` in stripe-checkout returns the first rate ($4.95). This is passed to Stripe as `shipping_rate_data.fixed_amount`. Customer pays exactly what Printful charges.

**Fallback**: `settings.default_shipping_cost` (configurable in `/admin/shipping`, default $6.99). Used only if Printful API is unavailable.

**US-only**: `allowed_countries: ["US"]` in Stripe session. ✓

**Shipping: PASS — $4.95 STANDARD confirmed for variant 4016 to US**

---

## 23. Tax Configuration Status

**Current technical state**:
- Stripe Tax: NOT CONFIGURED
- Customer-facing tax: $0.00
- Printful manufacturing tax: Charged to store account by Printful (not passed to customer)

**This is unchanged from Phase 6.** No code changes were made to tax configuration.

**BUSINESS CONFIGURATION REQUIRED**: Sales tax collection depends on business registration, nexus determination, product taxability, and legal/accounting advice. This is not a technical decision.

**For the first controlled production test**: Tax at $0 is technically functional. The operator accepts the business risk.

**Tax does not block Phase 7 for a single operator-controlled test.**

---

## 24. Customer Communications

| Email | Trigger | Status |
|---|---|---|
| Order confirmation | checkout.session.completed | READY — Resend via stripe-webhook |
| Shipping notification | Printful package_shipped webhook | READY — Resend via printful-webhook |
| Refund confirmation | Admin issues refund | READY — Resend via /api/stripe-admin |
| Cancellation notification | None | POST-LAUNCH |
| Fulfillment failure notification | None | POST-LAUNCH |

**For Phase 7**: Order confirmation and shipping notification are automated. If rollback is needed, the operator can communicate manually.

---

## 25. Monitoring Plan

**Phase 7 operator monitoring checklist**:

### Immediately after payment

| Location | What to check | Expected |
|---|---|---|
| Stripe Dashboard → Payments | New charge | `succeeded`, `livemode=true` |
| Supabase → `/admin/orders` | New order | `status=paid`, `livemode=true` |
| Supabase → Edge Functions → stripe-webhook → Logs | Webhook execution | No errors, Printful order created |
| `/admin/orders` → order detail → Check Printful | Printful status | `draft` |
| Customer email inbox | Order confirmation | Received from store email |

### Expected state transitions

```
Customer pays
    ↓ (seconds)
Stripe: charge succeeded, livemode=true
    ↓ (seconds)
stripe-webhook fires: checkout.session.completed
    ↓
Local order: status=paid, livemode=true
    ↓
Printful: POST /orders (confirm=false)
    ↓
Printful: status=draft
    ↓
Local order: printful_order_id=<id>, fulfillment_status=draft
    ↓
STOP — no automatic manufacturing
```

### After manual confirmation (Phase 7 step 20)

```
Admin: Confirm → Production
    ↓
Printful: status=pending → in-production
    ↓ (hours to days)
Printful: package_shipped webhook
    ↓
Local order: fulfillment_status=shipped, tracking_number set
    ↓
Customer: shipping email with tracking link
```

### Warning conditions requiring immediate attention

| Condition | Location | Action |
|---|---|---|
| No local order after payment | /admin/orders | Check stripe-webhook logs; look for needs_admin_review |
| No Printful order after 5 min | /admin/orders → Check Printful | Check stripe-webhook logs for Printful error |
| Printful status ≠ draft | /admin/orders → Check Printful | Do NOT confirm; investigate |
| Needs Attention badge on order | /admin/orders | Open order, read alert banner |

---

## 26. Regression Results

```
TypeScript:  PASS  (npx tsc --noEmit — 0 errors)
Tests:       509/509 PASS  (9 test files)
Build:       PASS  (npm run build)
```

No regressions introduced during Phase 7A. The only action taken was applying the Phase 6 DB migration.

---

## 27. Remaining Risks

| Risk | Severity | Status |
|---|---|---|
| **Production artwork FAIL** | CRITICAL | Must replace before Phase 7 |
| Live Stripe keys not configured | HIGH | Expected — configure when Phase 7 authorized |
| Tax not collected | HIGH | BUSINESS CONFIG REQUIRED |
| Product/design names are test names | MEDIUM | Rename before Phase 7 for clean audit trail |
| No external log aggregation | MEDIUM | Supabase logs sufficient for single test |
| Cancellation customer email absent | LOW | Manual communication acceptable |
| Printful in-production cancellation not possible via API | LOW | Documented; admin contacts Printful support |

---

## 28. Phase 7 Exact Execution Plan

**DO NOT EXECUTE UNTIL PHASE 7 IS SEPARATELY AUTHORIZED.**

### Pre-Phase 7 operator actions (complete before executing)

- [ ] **Replace artwork**: Upload production-quality artwork (minimum 1800×2400 px at 150 DPI, recommended 3600×4800 px at 300 DPI) for the selected product via admin designs panel
- [ ] **Verify new artwork**: Confirm new artwork meets Printful requirements (see Section 9)
- [ ] **Configure live Stripe keys**: Go to `/admin/stripe` → enter `sk_live_...` → "Save & Activate"
- [ ] **Verify live mode**: Confirm LIVE badge in admin Stripe panel
- [ ] **Verify live webhook**: Confirm webhook registered in Stripe Dashboard
- [ ] **Confirm PRINTFUL_AUTO_CONFIRM absent**: Verify not set in Supabase edge function secrets

### Phase 7 execution steps

1. Open production storefront
2. Navigate to the approved product (Phase 5.1A US Test Tee — or renamed equivalent)
3. Select variant: Bella+Canvas 3001, Black, Size S
4. Add quantity: 1
5. Verify displayed retail price: $34.99
6. Click "Add to Cart" → proceed to checkout
7. Verify Stripe checkout page shows LIVE mode (no "TEST MODE" banner)
8. Enter operator's real payment card and shipping address
9. Complete payment
10. Verify Stripe Dashboard → Payments shows new live charge (`livemode=true`)
11. Go to `/admin/orders` → verify exactly ONE new order with `livemode=true`, `status=paid`
12. Open order detail → verify fulfillment_snapshot matches approved candidate:
    - strategy: DIRECT_CATALOG_ORDER
    - printful_catalog_variant_id: 4016
    - placement: front
    - technique: DTG
    - artwork_url: (new production artwork URL)
13. Click "Check Printful" → verify Printful status = `draft`
14. **STOP — do not confirm yet**
15. Manually verify in order detail:
    - [ ] Product: Bella+Canvas 3001 Unisex T-Shirt
    - [ ] Variant: Black / S
    - [ ] Quantity: 1
    - [ ] Recipient: operator's name and address
    - [ ] Artwork: production artwork (not test_design.png)
    - [ ] Placement: front
    - [ ] Technique: DTG
    - [ ] Retail amount: $34.99
    - [ ] Shipping: $4.95
    - [ ] Provider cost: ~$11.92 + shipping
16. If ANYTHING is wrong: click "Cancel Draft" → issue Stripe refund if needed → STOP
17. If everything is correct: click "Confirm → Production"
18. Verify Printful status transitions from `draft` → `pending` or `in-production`
19. Monitor Printful Dashboard for production progress
20. Verify shipping notification email received when shipped
21. Verify tracking information in `/admin/orders`
22. Receive physical product
23. Inspect: garment, print quality, print size, placement, color accuracy, artwork sharpness, packaging, overall customer experience

---

## 29. GO / NO-GO Matrix

| Gate | Result | Evidence | Blocking? |
|---|---|---|---|
| Production candidate selected | PASS | Phase 5.1A US Test Tee — UUID 5487d86f | YES |
| Product identity verified | PASS | catalog_source=catalog_builder, printful_id=NULL, catalog_id=71 | YES |
| Store variant mapping verified | PASS | variant 6869ca2f → printful_variant_id=4016 | YES |
| Catalog Builder ownership model | PASS | printful_id=NULL, DIRECT_CATALOG_ORDER | YES |
| Manufacturing artwork identified | PASS | design d180dd4d, artwork_url confirmed accessible | YES |
| Artwork is not mockup | **FAIL** | File name: test_design.png; Design: "Phase 4 Verification Design" | YES |
| Artwork dimensions verified | **FAIL** | 1200×1200 px; required 1800×2400 px minimum | YES |
| Effective DPI verified | **FAIL** | 100 DPI effective; minimum 150 DPI required | YES |
| Print area compatibility | **FAIL** | Artwork fills 12×12 of 12×16 inch area; below minimum DPI | YES |
| Artwork production quality | **FAIL** | 2-color test pattern, 13.8 KB, not production artwork | YES |
| Fulfillment snapshot generation | PASS | Resolver would produce valid DIRECT_CATALOG_ORDER snapshot | YES |
| Phase 6 DB migration applied | PASS | 20261022000000 applied successfully this phase | YES |
| stripe_session_id UNIQUE verified | PASS | Migration applied; constraint active | YES |
| Test/live data isolation | PASS | livemode column active; all 41 test orders livemode=false | YES |
| Stripe LIVE key configured | NOT SET | Live key not yet entered — operator action required | YES |
| stripe_mode=live | NOT SET | Currently test — will change when live key saved | YES |
| LIVE webhook registered | NOT SET | Will auto-register when live key saved | YES |
| LIVE webhook secret active | NOT SET | Will be set when live key saved | YES |
| Stripe environment consistency | PASS | No mismatch; test mode with test key | YES |
| PRINTFUL_AUTO_CONFIRM absent/false | PASS | ABSENT from .env.local and Supabase secrets | YES |
| Printful API authentication | PASS | Catalog API calls succeeded | YES |
| Catalog variant available | PASS | Variant 4016 confirmed active, available_as_sample=true | YES |
| Admin manual confirmation | PASS | /api/admin/orders confirm_printful — all preconditions enforced | YES |
| Admin draft cancellation | PASS | /api/admin/orders cancel_printful — draft-only enforced | YES |
| Refund capability | PASS | /admin/stripe refund + customer email | YES |
| US shipping rate available | PASS | $4.95 STANDARD confirmed for variant 4016 | YES |
| Tax status documented | BUSINESS CONFIG REQUIRED | No Stripe Tax; $0 customer tax | NO* |
| Customer confirmation path | PASS | Resend order confirmation via stripe-webhook | YES |
| Shipping notification path | PASS | Resend shipping email via printful-webhook | YES |
| Monitoring plan prepared | PASS | Section 25 — exact checklist | YES |
| TypeScript | PASS | 0 errors | YES |
| Automated tests | PASS | 509/509 | YES |
| Production build | PASS | npm run build PASS | YES |

*Tax remains a public-launch business configuration decision.

---

## 30. Final Decision

**Artwork gate is the sole blocking issue.** All other gates either pass or have clear documented operator procedures (live Stripe keys, which must not be configured until Phase 7 is authorized).

**Required before Phase 7 can proceed**:

1. **Replace manufacturing artwork** with production-quality artwork:
   - Minimum: 1800 × 2400 px at 150 DPI (Printful minimum)
   - Recommended: 3600 × 4800 px at 300 DPI
   - Format: PNG with transparency
   - Color mode: RGB
   - Content: actual production design intended for customer manufacturing
   - Upload via admin designs panel → update design `d180dd4d` or create new design and re-link via product_designs

2. **Configure live Stripe keys** (when Phase 7 is separately authorized):
   - `/admin/stripe` → enter `sk_live_...` → "Save & Activate"

---

PHASE 7A FIRST PRODUCTION ORDER PREFLIGHT: COMPLETE

PRODUCTION ARTWORK GATE: FAIL

PRODUCTION DATABASE GATE: PASS

STRIPE LIVE CONFIGURATION GATE: UNVERIFIED (not yet configured — expected; operator action required before Phase 7)

STRIPE LIVE WEBHOOK GATE: UNVERIFIED (not yet registered — will auto-register when live key saved)

PRINTFUL SAFETY GATE: PASS

PRINTFUL AUTO-CONFIRM: DISABLED

REGRESSION: PASS

PHASE 7 CONTROLLED REAL ORDER: NO-GO (artwork must be replaced before Phase 7)
