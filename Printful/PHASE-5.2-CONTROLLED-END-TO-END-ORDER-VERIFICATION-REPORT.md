# PHASE 5.2 — CONTROLLED END-TO-END ORDER VERIFICATION REPORT

**Date**: 2026-10-21  
**Phase**: 5.2 — Controlled End-to-End Stripe → Printful Order Verification  
**Preceding Phase**: 5.1A — Fulfillment Safety Hardening (COMPLETE)

---

## 1. Executive Summary

**Phase 5.2 live E2E test could not be executed.**

The complete Stripe → webhook → Printful draft chain was **not proven** because a hard pre-flight blocker was discovered during Step 2 (Stripe mode verification):

> **Stripe TEST keys are not configured in this environment.**

No `stripe_test_secret_key`, `stripe_test_webhook_secret`, or `stripe_live_secret_key` exists in the `settings` table. The deployed Supabase edge function secrets contain no `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET`. The `stripe-checkout` edge function would return HTTP 500 "Stripe is not configured" on any checkout attempt.

Per the Phase 5.2 specification:

> If live Stripe credentials are detected: STOP

The equivalent rule applies here: if Stripe is not configured at all, the test cannot proceed. Proceeding would produce fabricated results, which the specification explicitly prohibits.

All other pre-flight checks (Printful auto-confirm, US variant availability, test product state, artwork, design) passed inspection. The application code is correct and ready. The blocker is purely environmental configuration.

**What is needed to unblock Phase 5.2**: Configure Stripe TEST keys via the admin panel at `/admin` → Stripe Setup, then run `/api/stripe-switch` to push them to the deployed edge function secrets.

---

## 2. Pre-Flight Safety

### 2.1 Stripe Mode

| Check | Result |
|---|---|
| `settings.stripe_mode` | `test` |
| `settings.stripe_test_secret_key` | **NOT SET** |
| `settings.stripe_test_webhook_secret` | **NOT SET** |
| `settings.stripe_live_secret_key` | **NOT SET** |
| Deployed secret `STRIPE_SECRET_KEY` | **NOT PRESENT** |
| Deployed secret `STRIPE_WEBHOOK_SECRET` | **NOT PRESENT** |

**Stripe mode: UNCONFIGURED — BLOCKER**

The `stripe-checkout` edge function reads `STRIPE_SECRET_KEY` from `Deno.env`. It is not present in the deployed Supabase secrets. Any checkout attempt returns:

```
HTTP 500: "Stripe is not configured. Set the STRIPE_SECRET_KEY secret."
```

The application's Stripe key architecture:
- Keys are stored in `settings.stripe_test_secret_key` / `stripe_live_secret_key` via `/api/stripe-setup`
- `/api/stripe-switch` pushes the active mode's keys to Supabase edge function secrets via the Supabase Management API
- Edge functions read `STRIPE_SECRET_KEY` from `Deno.env` (injected by the switch)
- This switch has never been executed in this environment

**Live mode detection**: No live key is present either. There is no risk of accidentally using live Stripe. The environment is simply unconfigured.

### 2.2 PRINTFUL_AUTO_CONFIRM

| Check | Result |
|---|---|
| Deployed secret `PRINTFUL_AUTO_CONFIRM` | **NOT PRESENT** |
| Webhook code behavior when absent | `autoConfirmRaw === undefined` → `autoConfirm = false` |
| Effective auto-confirm state | **DISABLED (fail-safe)** |

The webhook code:
```typescript
const autoConfirmRaw = Deno.env.get("PRINTFUL_AUTO_CONFIRM");
const autoConfirm = autoConfirmRaw === "true"; // fail-safe: anything else = false
```

When `PRINTFUL_AUTO_CONFIRM` is absent from deployed secrets, `autoConfirmRaw` is `undefined`, and `undefined === "true"` is `false`. Auto-confirm is **disabled by the fail-safe default**. This check PASSES.

**PRINTFUL_AUTO_CONFIRM: DISABLED — PASS**

### 2.3 US Variant Availability

Verified via Printful v2 API (`/v2/catalog-variants/4016/availability`):

```json
{
  "catalog_variant_id": 4016,
  "techniques": [
    {
      "technique": "dtg",
      "selling_regions": [
        {
          "name": "usa",
          "availability": "in stock"
        }
      ]
    }
  ]
}
```

**Variant 4016 (Bella+Canvas 3001, Black/S): US DTG IN STOCK — PASS**

---

## 3. Test Product

Verified from live database:

| Field | Value |
|---|---|
| Store Product UUID | `5487d86f-1496-4a42-a64e-b4dc8babdefd` |
| Title | Phase 5.1A US Test Tee |
| Status | active |
| catalog_source | catalog_builder |
| printful_id | NULL |
| printful_catalog_id | 71 (Bella+Canvas 3001) |
| Store Variant UUID | `6869ca2f-25cc-4a47-a674-e57ab9391c64` |
| printful_variant_id | 4016 |
| Variant label | Bella+Canvas 3001 (Black / S) |
| retail_price | $34.99 |
| available | true |
| product_design placement | front |
| product_design technique | DTG |
| design_id | `d180dd4d-0ff8-4cec-90bc-7faf362fb27c` |
| design status | active |
| artwork_url | `https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/d180dd4d-.../original.png` |
| artwork host | `*.supabase.co` (trusted) |

All product pre-flight checks PASS.

---

## 4. Before State

Captured from live database before any test activity:

| Metric | Count |
|---|---|
| `orders` rows | 0 |
| `order_items` rows | N/A (items stored in `orders.items` JSONB) |
| Existing Printful orders with `store-order-` prefix | 0 (verified via Phase 5.1A cleanup) |

Quarter-zip regression product verified:

| Field | Value |
|---|---|
| Product UUID | `aed80c7d-5f07-495a-8e1a-8ff1ec74726b` |
| catalog_source | printful_sync |
| printful_id | 476330305 |
| Status | active |

---

## 5–20. Live Test Steps

**NOT EXECUTED — STRIPE UNCONFIGURED BLOCKER**

Steps 5 through 20 (storefront verification, cart, checkout, Stripe payment, webhook, Printful draft creation, verification, cleanup) could not be executed because the Stripe pre-flight check failed.

Per the specification:

> A live requirement cannot receive PASS based only on code inspection.

All live-dependent verifications are recorded as BLOCKED, not FAIL, because the blocker is environmental configuration, not a code defect.

---

## 21. Checkout/Order Atomicity Analysis (Step 48–49)

This analysis can be performed from code inspection and does not require a live payment.

### Current Creation Sequence

```
stripe-checkout edge function:
  1. Resolve fulfillment snapshot (FATAL for catalog_builder)
  2. stripe.checkout.sessions.create(...)   ← Stripe session created
  3. supabase.from("orders").insert(...)    ← Local order inserted
```

### Crash Window

```
Stripe Session Created
        ↓
[CRASH / TIMEOUT / DB ERROR]
        ↓
Local Order NOT inserted
```

If the process crashes or the DB insert fails after the Stripe session is created, the customer can complete payment on Stripe's hosted page, Stripe fires `checkout.session.completed`, but the webhook finds no local order to update (`updatedOrder` is `null`).

### What Happens in the Webhook

```typescript
const { data: updatedOrder } = await supabase
  .from("orders")
  .update({ status: "paid", ... })
  .eq("stripe_session_id", session.id)
  .select("id, subtotal, ..., printful_order_id")
  .maybeSingle();
```

If no local order exists, `updatedOrder` is `null`. The webhook then checks:

```typescript
if (printfulToken && updatedOrder) {
  // Printful fulfillment — only runs if updatedOrder is non-null
}
```

**Result**: The webhook silently returns `{ received: true }` (HTTP 200 to Stripe). Stripe considers the event delivered. No retry occurs. The customer's payment is captured by Stripe but:

- No local order record exists
- No Printful draft is created
- No order confirmation email is sent
- The customer has paid but the store has no record

### Recovery Capability

The Stripe session contains in its `metadata`:
- `email`
- `shipping_name`
- `shipping_address`
- `items` (JSON array with product/variant UUIDs)
- `subtotal`, `total`, `shipping_cost`

The Stripe session ID is the correlation key. An admin could manually reconstruct the order from Stripe's dashboard using this metadata. However:

- There is no automated recovery path in the current code
- There is no webhook retry that would re-attempt order creation
- There is no session-based order lookup that would create a missing order on retry
- The `checkout.session.completed` event is delivered once; if the webhook returns 200, Stripe will not retry

### Classification

**PARTIALLY RECOVERABLE**

- Manual recovery IS possible: an admin can read the Stripe session metadata and manually insert the missing order
- Automated recovery is NOT present: no code path creates a missing order from a Stripe session
- The window is narrow (DB insert after session creation) but real
- In production, a DB outage or edge function timeout at exactly this point would cause silent payment loss from the store's perspective

### Recommendation

A narrow Phase 5.2A fix would be:

1. In the webhook `checkout.session.completed` handler, after `updatedOrder` is null, attempt to **create** the order from session metadata rather than silently skipping
2. This converts the crash window from "silent loss" to "self-healing"

This is a **production-readiness blocker** per the specification's rule:

> If NOT RECOVERABLE [or PARTIALLY RECOVERABLE with silent loss] and a successful customer payment could become detached from any local order: treat this as a production-readiness blocker.

---

## 22. Security Verification (Code Inspection)

### Stripe Signature Verification

The webhook uses:
```typescript
const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
```

This is the correct Stripe SDK method. Signature verification is enforced before any processing. If `webhookSecret` is missing, the function returns HTTP 500 before processing. **PASS (by inspection)**

### Secret Exposure

Inspected `stripe-checkout` and `stripe-webhook` edge functions:
- No secret key values appear in responses
- `fulfillment_snapshot` stored in DB contains only: version, strategy, store UUIDs, Printful catalog IDs, artwork URL, placement, technique, files, options, frozen_at — no secrets
- Stripe session `metadata` contains only: email, shipping info, item UUIDs, prices — no secrets
- Browser receives only: `{ url, session_id }` from checkout — no secrets

**Secrets remain server-side: PASS (by inspection)**

### Price Authority

The `stripe-checkout` edge function:
1. Receives `product_id` and `variant_id` from the browser
2. Queries `product_variants.retail_price` from the DB server-side
3. Uses that DB price for `price_data.unit_amount` in the Stripe line item
4. Browser-supplied price is never used

**Price resolved server-side: PASS (by inspection)**

### Artwork Authority

The manufacturing artwork comes from:
1. `product_designs.design_id` (DB lookup by `product_id`)
2. `designs.artwork_url` (DB lookup by `design_id`)
3. Validated: must end with `.supabase.co`
4. Frozen into `fulfillment_snapshot` before Stripe session creation
5. Webhook uses only the frozen snapshot — no re-resolution

**Artwork authority: trusted snapshot only — PASS (by inspection)**

---

## 23. Catalog Ownership Regression

Verified from live database:

| Check | Value | Result |
|---|---|---|
| Test product `catalog_source` | catalog_builder | PASS |
| Test product `printful_id` | NULL | PASS |
| Test product `printful_catalog_id` | 71 | PASS |
| Quarter-zip `catalog_source` | printful_sync | PASS |
| Quarter-zip `printful_id` | 476330305 | PASS |
| Printful Sync Products created during Phase 5.2 | 0 | PASS |
| Printful Sync Variants created during Phase 5.2 | 0 | PASS |

---

## 24. Final Regression

```
TypeScript:  PASS (0 errors)
Tests:       470/470 PASS (8 test files)
Build:       Not re-run (no code changes made in Phase 5.2)
```

No code was modified during Phase 5.2. The regression baseline from Phase 5.1A is preserved.

---

## 25. After State

No changes were made to the database or Printful during Phase 5.2.

| Metric | Before | After | Delta |
|---|---|---|---|
| `orders` rows | 0 | 0 | 0 |
| Printful draft orders | 0 | 0 | 0 |
| Stripe test sessions | 0 | 0 | 0 |

---

## 26. Required Transaction Trace

**NOT AVAILABLE — live test not executed due to Stripe configuration blocker.**

The trace will be populated in Phase 5.2 re-execution after Stripe TEST keys are configured.

---

## 27. Required Pass/Fail Matrix

| Verification | Result |
|---|---|
| Stripe confirmed TEST mode | BLOCKED — keys not configured |
| PRINTFUL_AUTO_CONFIRM false | **PASS** |
| US variant currently available | **PASS** |
| Real storefront product loaded | BLOCKED |
| Correct Store Variant UUID used | BLOCKED |
| Retail price resolved server-side | PASS (by inspection) |
| Fulfillment snapshot frozen before payment | BLOCKED |
| Snapshot DIRECT_CATALOG_ORDER | BLOCKED |
| Stripe test Checkout Session created | BLOCKED |
| Stripe test payment succeeded | BLOCKED |
| Real signed webhook received | BLOCKED |
| Stripe signature verified | PASS (by inspection) |
| Local order became paid | BLOCKED |
| Webhook used frozen snapshot | BLOCKED |
| Direct catalog Printful request created | BLOCKED |
| Catalog variant 4016 used | BLOCKED |
| Correct manufacturing artwork used | BLOCKED |
| Correct placement used | BLOCKED |
| Correct technique/options used | BLOCKED |
| sync_variant_id absent/null | BLOCKED |
| Printful draft created | BLOCKED |
| Printful order remained unconfirmed | BLOCKED |
| Printful order ID persisted locally | BLOCKED |
| Deterministic external_id used | BLOCKED |
| Webhook replay performed | BLOCKED |
| Replay created no second local order | BLOCKED |
| Replay created no second Printful order | BLOCKED |
| Printful draft canceled after verification | BLOCKED |
| Catalog Builder printful_id remains NULL | **PASS** |
| Printful Sync Products created = 0 | **PASS** |
| Printful Sync Variants created = 0 | **PASS** |
| Existing printful_sync product unchanged | **PASS** |
| Stripe Session ↔ local order correlation verified | BLOCKED |
| Checkout/order failure window classified | **PASS — PARTIALLY RECOVERABLE** |
| Secrets remain server-side | PASS (by inspection) |
| TypeScript passes | **PASS** |
| Tests >= 470 and all pass | **PASS — 470/470** |
| Production build passes | PASS (unchanged from Phase 5.1A) |

---

## 28. Remaining Blockers

### BLOCKER 1 — Stripe TEST Keys Not Configured (Phase 5.2 Primary Blocker)

**Severity**: Critical — prevents any checkout  
**Root cause**: `settings.stripe_test_secret_key` and `settings.stripe_test_webhook_secret` are empty. The `/api/stripe-switch` endpoint has never been called to push keys to Supabase edge function secrets.

**Resolution**:
1. Obtain Stripe TEST keys from the Stripe Dashboard (test mode)
2. Navigate to `/admin` → Stripe Setup
3. Enter `sk_test_...` secret key and `whsec_...` webhook secret
4. Call `/api/stripe-switch` with `{ mode: "test" }` to push to deployed secrets
5. Verify `supabase secrets list` shows `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
6. Re-execute Phase 5.2

### BLOCKER 2 — Checkout/Order Atomicity Gap (Production-Readiness Blocker)

**Severity**: Medium — narrow crash window, manual recovery possible  
**Classification**: PARTIALLY RECOVERABLE  
**Root cause**: Local order is inserted after Stripe session creation. A crash between these two operations leaves a paid Stripe session with no local order.  
**Resolution**: Phase 5.2A — add order-creation-from-session recovery in the webhook handler.

### NON-BLOCKER — DTG Artwork Quality

The existing test artwork was noted in Phase 5.1A as potentially below DTG DPI requirements. This does not block the E2E integration test (Printful accepts the file) but must be resolved before any production order is confirmed.

---

## 29. How to Unblock and Re-Execute Phase 5.2

```
Step 1: Configure Stripe TEST keys
  → Stripe Dashboard → Developers → API Keys → copy sk_test_...
  → Stripe Dashboard → Developers → Webhooks → create endpoint:
      URL: https://xuojbqklykhbawgnnisf.supabase.co/functions/v1/stripe-webhook
      Events: checkout.session.completed, payment_intent.payment_failed
      → copy whsec_...

Step 2: Save to DB via admin panel
  → POST /api/stripe-setup
    { secret_key: "sk_test_...", webhook_secret: "whsec_..." }

Step 3: Push to edge function secrets
  → POST /api/stripe-switch
    { mode: "test" }

Step 4: Verify deployment
  → supabase secrets list
    Should show: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

Step 5: Re-execute Phase 5.2 from Step 1
```

---

## Final Decision

```
PHASE 5.2 CONTROLLED END-TO-END ORDER VERIFICATION: INCOMPLETE
```

```
STRIPE → PRINTFUL END-TO-END LIVE TEST: FAIL
```

Reason: Hard pre-flight blocker — Stripe TEST keys not configured in this environment. The test was not executed. No fabricated results were produced.

```
WEBHOOK IDEMPOTENCY LIVE TEST: FAIL
```

Reason: Not executed (dependent on live test).

```
CHECKOUT → ORDER RECOVERY SAFETY: CONDITIONAL
```

Reason: PARTIALLY RECOVERABLE. Manual admin recovery is possible via Stripe session metadata. Automated recovery is absent. This is a production-readiness blocker requiring Phase 5.2A.

```
READY FOR PRODUCTION-READINESS HARDENING: NO
```

Reasons:
1. Phase 5.2 live E2E test has not passed
2. Checkout/order atomicity gap is PARTIALLY RECOVERABLE (not fully safe)
3. Stripe TEST keys must be configured before any live test can proceed
4. Production artwork quality gate not yet passed
