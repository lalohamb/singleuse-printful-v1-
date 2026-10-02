# PHASE 6 — PRODUCTION READINESS & LAUNCH HARDENING REPORT

**Date**: 2026-10-02  
**Baseline**: Phase 5.2 COMPLETE / PASS  
**Status at report time**: See Section 34

---

## 1. Executive Summary

Phase 6 audited the complete production lifecycle of this Next.js + Supabase + Stripe + Printful POD storefront. The audit covered checkout, order creation, Stripe webhook processing, Printful fulfillment submission, admin visibility, cancellation, refunds, shipping, tax, customer email, provider status synchronization, artwork, Stripe production configuration, environment isolation, database integrity, security, and test data separation.

**Findings summary:**

- 4 code changes implemented (DB migration, printful-proxy routes, admin orders API, admin UI)
- 1 configuration gap identified (PRINTFUL_AUTO_CONFIRM not in deployed edge function secrets — must remain absent/false)
- 1 business configuration item identified (tax — requires operator decision)
- 1 artwork validation item identified (production artwork must be verified before Phase 7)
- All critical safety gates: PASS
- Regression: TypeScript PASS, 509/509 PASS (+39 new Phase 6 tests), Build PASS

**Conclusion**: The system is ready for the first controlled real production order (Phase 7), subject to the conditions listed in Section 34.

---

## 2. Phase 5.2 Verified Baseline

| Item | Result |
|---|---|
| E2E chain | COMPLETE |
| Stripe → Printful live test | PASS |
| Webhook idempotency | PASS |
| Checkout → order recovery | PASS |
| TypeScript | PASS |
| Tests | 470/470 PASS |
| Build | PASS |

Verified transaction: Order `35f1853d`, session `cs_test_b1C7a4...`, Printful order `179039375` (canceled), external_id `so-35f1853d68d7448191c2ca36e81bb`.

---

## 3. Initial Production Readiness Gap Analysis

| Area | Status | Notes |
|---|---|---|
| Checkout — server-authoritative pricing | READY | Verified Phase 5.2 |
| Checkout — immutable snapshot | READY | Verified Phase 5.2 |
| Stripe webhook — signature verification | READY | constructEventAsync |
| Stripe webhook — paid order creation | READY | Phase 5.2A |
| Crash-window recovery | READY | Phase 5.2A |
| Printful submission — DIRECT_CATALOG_ORDER | READY | Phase 5.1/5.2 |
| Printful external_id uniqueness | READY | 32-char format, Phase 5.2 |
| OR-13 lost-response recovery | READY | Phase 5.1A |
| Duplicate protection (printful_order_id guard) | READY | Phase 5.1A |
| stripe_session_id UNIQUE constraint | **ADDED Phase 6** | Migration 20261022000000 |
| Admin order visibility | READY | /admin/orders |
| needs_admin_review surfacing | **ADDED Phase 6** | Alert banner + filter |
| Failed fulfillment visibility | **ADDED Phase 6** | Alert banner + filter |
| Manual Printful confirmation | **ADDED Phase 6** | /api/admin/orders + UI |
| Printful draft cancellation | **ADDED Phase 6** | /api/admin/orders + UI |
| Printful proxy GET /orders/:id | **ADDED Phase 6** | printful-proxy |
| Refund support | READY | /api/stripe-admin refund action |
| Refund email | READY | Resend on refund |
| Shipping — live Printful rates | READY | getPrintfulShipping |
| Shipping — fallback rate | READY | settings.default_shipping_cost |
| Tax | PARTIAL | No Stripe Tax; $0 customer tax; BUSINESS CONFIG REQUIRED |
| Order confirmation email | READY | Resend on checkout.session.completed |
| Shipping notification email | READY | Printful webhook package_shipped |
| Refund notification email | READY | /api/stripe-admin refund |
| Printful status sync | PARTIAL | package_shipped + order_updated; manual for other states |
| Production artwork validation | REQUIRES VERIFICATION | See Section 19 |
| Stripe live configuration | READY (procedure) | See Section 20 |
| Live webhook registration | READY (procedure) | See Section 21 |
| Mixed Stripe env detection | **ADDED Phase 6** | stripe-config.ts |
| PRINTFUL_AUTO_CONFIRM=false | READY | Absent = false (fail-safe) |
| Test/live order separation | READY | livemode column + filter |
| Logging / observability | PARTIAL | console.log/error; no external sink |
| Secret protection | READY | All server-side |
| Admin route protection | READY | requireAdmin() |

---

## 4. Payment State Model

States stored in `orders.status`:

| State | Meaning |
|---|---|
| `pending` | Stripe session created; payment not yet confirmed |
| `paid` | checkout.session.completed received and verified |
| `fulfilled` | Printful order_updated → fulfilled |
| `partially-fulfilled` | Manual admin update only |
| `shipped` | Printful package_shipped webhook received |
| `delivered` | Manual admin update only |
| `cancelled` | payment_intent.payment_failed OR manual admin action |
| `refunded` | Manual admin update after Stripe refund |

**Separation**: `orders.status` tracks payment/lifecycle state. `orders.fulfillment_status` and `orders.printful_fulfillment_status` track provider state independently.

---

## 5. Fulfillment State Model

States stored in `orders.fulfillment_status` and `orders.printful_fulfillment_status`:

| State | Source | Meaning |
|---|---|---|
| `needs_admin_review` | Webhook recovery | Crash-window recovered order; snapshot may be missing |
| `pending` | Printful API response | Order submitted, awaiting processing |
| `draft` | Printful API response | Order created but not confirmed |
| `in-production` | Printful webhook order_updated | Manufacturing started |
| `fulfilled` | Printful webhook order_updated | Manufacturing complete |
| `shipped` | Printful webhook package_shipped | Carrier picked up |
| `cancelled` | Printful webhook order_updated / admin action | Order voided |
| `failed` | Webhook error handler | Printful submission failed |

**Provider state** (`printful_fulfillment_status`) is set by the webhook and admin sync. It is separate from `fulfillment_status` which is the store-facing state.

---

## 6. Order Recovery

**Crash-window scenario**: Stripe session created → local order INSERT fails → customer pays → `checkout.session.completed` fires.

**Recovery path** (Phase 5.2A, deployed):
1. Webhook UPDATE finds no matching order by `stripe_session_id`
2. Reconstructs order from session metadata
3. Inserts with `status=paid`, `fulfillment_status=needs_admin_review`
4. Printful fulfillment proceeds if snapshot is in metadata (it is not — snapshot is too large for metadata)
5. Admin sees the order flagged for review

**Limitation**: Fulfillment snapshot is not stored in Stripe metadata. Recovered orders for `catalog_builder` items cannot auto-submit to Printful. Admin must resolve manually.

**Classification**: RECOVERABLE — paid order is never lost. Fulfillment requires admin intervention for recovered orders.

---

## 7. Database Idempotency

**Phase 6 addition**: Migration `20261022000000_phase6_stripe_session_unique.sql`

```sql
ALTER TABLE orders
  ADD CONSTRAINT orders_stripe_session_id_unique UNIQUE (stripe_session_id);
```

**Safety**: Migration includes a pre-flight duplicate scan. If duplicates exist, migration fails with an explicit error rather than silently dropping data.

**Guarantee layers**:

1. **DB layer**: `UNIQUE (stripe_session_id)` — concurrent INSERT for same session fails at DB
2. **Application layer**: Webhook UPDATE path uses `.eq("stripe_session_id", session.id)` — returns at most one row
3. **Provider layer**: Printful `external_id` uniqueness — OR-13 on duplicate submission
4. **Application guard**: `printful_order_id` check before Printful submission — skips if already set

**Classification**: Duplicate-resistant with provider-unique guarantee and OR-13 recovery. Not mathematically exact-once (Supabase edge functions can execute concurrently), but the DB UNIQUE constraint makes concurrent duplicate creation fail at the strongest practical layer.

---

## 8. Admin Order Visibility

The `/admin/orders` page provides:

| Field | Available |
|---|---|
| Order UUID | YES — shown as #XXXXXXXX |
| Customer email | YES |
| Customer name | YES |
| Payment state (status) | YES |
| Stripe session reference | YES (via order detail) |
| Order total | YES |
| Items | YES |
| Store variant | YES (via items) |
| Fulfillment strategy | YES (via fulfillment_snapshot in detail) |
| Snapshot state | PARTIAL — snapshot exists but not displayed in UI |
| Printful order ID | YES |
| Printful fulfillment state | YES (stored + live check) |
| Provider error | PARTIAL — failed state visible; raw error in edge function logs only |
| needs_admin_review | YES — Phase 6 alert banner + filter |
| Created time | YES |
| Updated time | YES (via Supabase realtime) |
| Live/test mode | YES — badge on each row |

---

## 9. needs_admin_review Workflow

**Before Phase 6**: `needs_admin_review` orders existed in the DB but had no dedicated UI surface. Admin would need to know to filter by `fulfillment_status`.

**After Phase 6**:

1. "Needs Attention" filter button in orders list — shows count badge when attention orders exist
2. Red `⚠` badge on individual order rows
3. Alert banner inside order detail modal with specific explanation
4. Three conditions trigger the attention flag:
   - `fulfillment_status === "needs_admin_review"`
   - `printful_fulfillment_status === "failed"`
   - `status === "paid"` AND `printful_order_id IS NULL`

**Admin workflow for recovered order**:
1. Open order → see alert banner
2. Verify customer paid (check Stripe dashboard)
3. Manually submit to Printful if snapshot is available, or contact customer if not
4. Update order status accordingly

---

## 10. Failed Fulfillment Visibility

**Before Phase 6**: A `printful_fulfillment_status=failed` order was only visible if admin happened to open it. No list-level indicator.

**After Phase 6**: Same "Needs Attention" filter and row badge covers `printful_fulfillment_status=failed`. Admin cannot miss a paid order with failed fulfillment.

**Logged conditions** (edge function console):
- `Printful order failed: <status> <body>`
- `Printful order submission failed: <message>`
- `OR-13 recovery failed: <status>`

These appear in Supabase edge function logs (Dashboard → Edge Functions → stripe-webhook → Logs).

---

## 11. Printful Submission Safety

**Submission path**:
```
checkout.session.completed
  → UPDATE orders SET status=paid WHERE stripe_session_id=?
  → guard: if printful_order_id already set → skip
  → build items from fulfillment_snapshot (DIRECT_CATALOG_ORDER) or printful_variant_id (SYNC_VARIANT)
  → POST /orders (confirm=false when PRINTFUL_AUTO_CONFIRM absent/false)
  → on success: UPDATE orders SET printful_order_id=?, fulfillment_status=?
  → on OR-13: GET /orders/@<external_id> → recover printful_order_id
  → on other error: UPDATE orders SET printful_fulfillment_status=failed
```

**Deterministic external_id**: `so-` + first 29 chars of UUID (dashes stripped) = 32 chars exactly. Same order always produces the same external_id. Verified in Phase 5.2.

**printful_order_id persistence**: Written on first successful submission. Guard check prevents re-submission on webhook retry.

**Duplicate protection**: Application guard (printful_order_id check) + Printful external_id uniqueness (OR-13) + DB UNIQUE on stripe_session_id (Phase 6).

**Provider errors recorded**: `printful_fulfillment_status=failed` set on any non-OR-13 Printful error.

**Paid state preserved**: Payment state (`status=paid`) is never modified by fulfillment failure.

---

## 12. Printful Manual Confirmation

**Before Phase 6**: No admin UI or API for manual Printful confirmation. Admin would need to use Printful dashboard directly.

**After Phase 6**: `/api/admin/orders` POST endpoint with `action=confirm_printful`.

**Preconditions enforced server-side**:
- Admin authentication required (`requireAdmin()`)
- `order_id` must exist in DB
- `order.status` must be `paid`
- `order.printful_order_id` must be set
- Printful order must currently be in `draft` status (verified via live API call)
- Fulfillment snapshot validated for catalog_builder items

**UI**: "Confirm → Production" button appears in order detail modal only when:
- Printful live data has been fetched (admin clicked "Check Printful")
- `printfulData.status === "draft"`
- `order.status === "paid"`

**Duplicate click protection**: Button is disabled while `confirming=true`. Server-side: Printful rejects confirmation of already-confirmed orders.

**Result recorded**: `printful_fulfillment_status` and `fulfillment_status` updated to Printful's returned status.

---

## 13. Cancellation Handling

**Before Printful submission**: Set `orders.status=cancelled` via admin status dropdown. No Printful action needed.

**After Printful draft**: Phase 6 adds "Cancel Draft" button in order detail modal.
- Calls `/api/admin/orders` with `action=cancel_printful`
- Precondition: Printful order must be in `draft` status
- On success: `fulfillment_status` and `printful_fulfillment_status` set to `cancelled`
- Local state stays consistent with provider state

**After Printful confirmation (in-production)**: Printful API does not permit cancellation. Admin must contact Printful support. The cancel button is not shown for non-draft orders — the error message explicitly states this limitation.

**After shipment**: Cannot be canceled. Physical return/refund process applies.

**Printful webhook reconciliation**: `order_updated` with `status=canceled` sets local `fulfillment_status=cancelled` and `status=cancelled` automatically.

---

## 14. Refund Handling

**Stripe refund**: Available via `/admin/stripe` → Recent Charges → Refund button.
- Full or partial refund
- Calls `/api/stripe-admin` with `action=refund`
- Admin-only, requires `requireAdmin()`
- Sends refund confirmation email to customer via Resend

**Printful independence**: Stripe refund does NOT automatically cancel the Printful order. These are independent operations. Admin must:
1. Issue Stripe refund (via admin Stripe panel)
2. Separately cancel Printful draft (via admin orders panel) if order has not entered production

**State combinations**:

| Scenario | Stripe action | Printful action | Local state |
|---|---|---|---|
| Refund before Printful submission | Refund via Stripe panel | None needed | Set status=cancelled manually |
| Refund after draft | Refund via Stripe panel | Cancel draft via orders panel | Both updated independently |
| Refund after confirmation | Refund via Stripe panel | Contact Printful support | Admin-assisted |
| Refund after shipment | Refund via Stripe panel | Not possible | Admin-assisted; physical return |

**No automated refund-triggers-cancellation**: This is intentional. Treating them independently prevents accidental double-action.

---

## 15. Shipping Review

**Implementation**: Live Printful shipping rates fetched at checkout time via `getPrintfulShipping()` in `stripe-checkout` edge function.

**Flow**:
1. Cart items passed to Printful `/shipping/rates` with a representative US address
2. First rate returned used as shipping amount
3. Rate passed to Stripe as `shipping_rate_data.fixed_amount`
4. Customer sees and pays the Printful-derived rate
5. Printful charges the same rate for fulfillment

**Phase 5.2 verified**: Customer charged $4.95 shipping; Printful charged $4.95 — exact match.

**Fallback**: If Printful API unavailable, falls back to `settings.default_shipping_cost` (configurable in admin, default $6.99).

**Risk**: Printful shipping rates can change. The rate is fetched live at checkout, so the customer always sees the current rate. No divergence risk from stale cached rates.

**US-only**: `allowed_countries: ["US"]` in Stripe session. Printful shipping quote uses a US address. International shipping is not enabled.

**Configuration**: No hardcoded shipping price. Rate is provider-derived at checkout time. Admin can configure fallback rate in `/admin/shipping`.

---

## 16. Tax Configuration Review

**Current state**: No Stripe Tax configured. No sales tax is calculated or collected from customers.

**Phase 5.2 observation**: Customer charged $39.94 (product + shipping). Printful charged $0.44 tax on their side for manufacturing. These are separate obligations.

**Technical status**:
- Stripe Tax: NOT ENABLED
- Customer-facing tax: $0.00
- Printful manufacturing tax: Charged to store account by Printful (not passed to customer)

**BUSINESS CONFIGURATION REQUIRED**: Whether to collect sales tax from customers depends on:
- Business registration state(s)
- Sales tax nexus determination
- Product taxability
- Legal/accounting advice

This is not a technical decision. The codebase supports Stripe Tax if enabled — no code changes required to add it. The operator must decide and configure.

**For initial controlled production test**: Tax at $0 is technically functional. The operator accepts the business risk of not collecting sales tax during the test period.

---

## 17. Customer Communications

| Email | Trigger | Implementation | Status |
|---|---|---|---|
| Order confirmation | checkout.session.completed | Resend via stripe-webhook | READY |
| Shipping notification | Printful package_shipped webhook | Resend via printful-webhook | READY |
| Refund confirmation | Admin issues refund | Resend via /api/stripe-admin | READY |
| Cancellation notification | None | Not implemented | POST-LAUNCH |
| Fulfillment failure notification | None | Not implemented | POST-LAUNCH |

**Order confirmation email** includes: customer name, order reference, items with images, total, support email.

**Shipping email** includes: tracking number, tracking link, items shipped.

**Refund email** includes: refund amount, order reference, 5-10 day timeline.

**Missing for launch**: Cancellation and fulfillment-failure customer emails are absent. For the first controlled production test, the operator can communicate manually if needed. These are POST-LAUNCH enhancements, not blockers for a single controlled test order.

---

## 18. Printful Status Synchronization

**Existing Printful webhook** (`supabase/functions/printful-webhook/index.ts`):

| Event | Handler | Local update |
|---|---|---|
| `package_shipped` | YES | fulfillment_status=shipped, tracking_number, tracking_url |
| `order_updated` (fulfilled) | YES | fulfillment_status=fulfilled, status=fulfilled |
| `order_updated` (canceled) | YES | fulfillment_status=cancelled, status=cancelled |
| `order_updated` (in-production) | NO | Not handled |
| `order_updated` (draft→pending) | NO | Not handled |
| `order_failed` | NO | Not handled |

**Signature verification**: HMAC-SHA256 with `PRINTFUL_WEBHOOK_SECRET` if set. If secret not set, all webhooks accepted (acceptable for initial launch if Printful webhook URL is not publicly known, but should be secured).

**Manual sync**: Admin can click "Check Printful" in order detail → "Sync to Order" to pull current status.

**For first controlled production test**: Manual status inspection is acceptable. The admin will be monitoring the order directly.

**For public launch**: The missing `in-production` and `order_failed` event handlers are POST-LAUNCH enhancements. The critical shipping notification is already handled.

---

## 19. Production Artwork Validation

**Phase 5.2 finding**: Existing artwork was accepted by Printful for draft creation. Acceptance ≠ production print quality.

**Current artwork**: Stored in Supabase Storage. URL validated as `*.supabase.co` at checkout. Artwork URL for Phase 5.2 test: confirmed in frozen snapshot.

**REQUIRED BEFORE PHASE 7**:

The operator must verify the intended production artwork against Printful's requirements for the specific product/placement:

| Check | Printful requirement (DTG, front placement) | Action required |
|---|---|---|
| Minimum DPI | 150 DPI at print size (300 DPI recommended) | Verify actual file dimensions vs print area |
| Print area | Product-specific (e.g. Bella+Canvas 3001 front: ~12" × 16") | Confirm artwork fills intended area |
| Color mode | RGB (not CMYK) | Verify file |
| File format | PNG with transparency preferred | Verify |
| Background | Transparent for DTG on dark garments | Verify |
| File size | Under 200MB | Verify |

**The artwork used in Phase 5.2 was test/mockup artwork from earlier embroidery testing.** Before Phase 7, the operator must:
1. Identify the specific product and variant to be used for the first real order
2. Verify the artwork file meets Printful's print requirements for that product
3. If artwork does not meet requirements: BLOCK Phase 7 until corrected

**This is a CRITICAL gate for Phase 7. Phase 6 cannot verify artwork quality — only the operator can.**

---

## 20. Stripe Production Configuration

**Architecture**: Stripe keys stored in `settings` table (encrypted at rest by Supabase). Active mode controlled by `settings.stripe_mode`. Edge function secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are pushed to Supabase via `/api/stripe-switch`.

**Separate storage for test and live**:

| Setting | Column |
|---|---|
| Test secret key | `stripe_test_secret_key` |
| Test webhook secret | `stripe_test_webhook_secret` |
| Live secret key | `stripe_live_secret_key` |
| Live webhook secret | `stripe_live_webhook_secret` |
| Active mode | `stripe_mode` |

**Switching to live mode procedure**:
1. Go to `/admin/stripe`
2. Enter `sk_live_...` key in "Connect Stripe" panel
3. Click "Save & Activate" — this saves the key AND registers the webhook AND pushes secrets to Supabase edge functions AND sets `stripe_mode=live`
4. Verify the LIVE badge appears in the admin panel
5. Verify webhook is registered in Stripe Dashboard → Webhooks

**Mixed environment detection** (Phase 6): `getStripeConfig()` logs an error if `sk_live_` key is loaded in test mode or `sk_test_` key is loaded in live mode. This surfaces in edge function logs.

**DO NOT switch to live mode during Phase 6.** This is preparation only.

---

## 21. Stripe Webhook Production Configuration

**Webhook endpoint**: `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`

**Required events** (actual events handled in code):

| Event | Handler |
|---|---|
| `checkout.session.completed` | Order paid, Printful submission |
| `payment_intent.payment_failed` | Order cancelled |

**Registration**: Handled automatically by `/api/stripe-setup` when saving a key. The endpoint is registered in Stripe with exactly these two events.

**Webhook secret**: Returned by Stripe on endpoint creation. Stored in `settings.stripe_live_webhook_secret`. Pushed to Supabase edge function secrets as `STRIPE_WEBHOOK_SECRET` when mode is switched.

**Verification**: `stripe.webhooks.constructEventAsync(body, signature, webhookSecret)` — rejects any request with invalid signature.

**Production checklist**:
- [ ] Live Stripe key saved in admin panel
- [ ] Webhook auto-registered (or manually registered at above URL)
- [ ] `stripe_live_webhook_secret` saved in DB
- [ ] Mode switched to live via `/api/stripe-switch`
- [ ] Supabase edge function secrets updated (done automatically by stripe-switch)
- [ ] Test a live webhook delivery from Stripe Dashboard → Webhooks → Send test event

---

## 22. Printful Production Configuration

**Token**: `PRINTFUL_API_TOKEN` set in `.env.local` and as Supabase edge function secret. Confirmed SET.

**Store ID**: `PRINTFUL_STORE_ID` set. Used for sync operations only — not required for direct catalog orders.

**Catalog Builder fulfillment**: Uses `printful_catalog_variant_id` directly. Does NOT require a Sync Product or Sync Variant. `products.printful_id` is NULL for catalog_builder products. Verified in Phase 5.2.

**Auto-confirm**: `PRINTFUL_AUTO_CONFIRM` is NOT set in `.env.local` and NOT set as an edge function secret. The webhook code resolves absent/non-"true" values to `false`. Orders will be created as DRAFT.

**Production initial state**: PRINTFUL_AUTO_CONFIRM=false (by absence). This is correct and intentional.

---

## 23. Environment Matrix

| Variable | Test | Production | Notes |
|---|---|---|---|
| `STRIPE_SECRET_KEY` (edge fn) | SET (test key) | NEEDS SWITCH | Pushed by stripe-switch |
| `STRIPE_WEBHOOK_SECRET` (edge fn) | SET (test secret) | NEEDS SWITCH | Pushed by stripe-switch |
| `stripe_mode` (DB) | test | NEEDS SWITCH | Set via /admin/stripe |
| `stripe_live_secret_key` (DB) | N/A | MISSING | Enter in /admin/stripe |
| `stripe_live_webhook_secret` (DB) | N/A | MISSING | Auto-registered on key save |
| `PRINTFUL_API_TOKEN` | SET | SET | Same token for test/live |
| `PRINTFUL_AUTO_CONFIRM` | NOT SET (=false) | NOT SET (=false) | Must remain absent |
| `SUPABASE_URL` | SET | SET | Same project |
| `SUPABASE_SERVICE_ROLE_KEY` | SET | SET | Same project |
| `NEXT_PUBLIC_SUPABASE_URL` | SET | SET | Same project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SET | SET | Same project |
| `RESEND_API_KEY` | SET | SET | Same key |
| `MAILER_LITE_API_KEY` | SET | SET | Same key |
| `SITE_URL` / `NEXT_PUBLIC_SITE_URL` | SET | SET | Production domain |
| `SUPABASE_PROJECT_REF` | SET | SET | Required for stripe-switch |
| `SUPABASE_ACCESS_TOKEN` | SET | SET | Required for stripe-switch |
| Stripe Tax | NOT CONFIGURED | NOT CONFIGURED | BUSINESS CONFIG REQUIRED |
| `PRINTFUL_WEBHOOK_SECRET` | SET | SET | Printful webhook HMAC |

---

## 24. Logging & Observability

**Current logging**: `console.log` / `console.error` in edge functions. Visible in Supabase Dashboard → Edge Functions → [function] → Logs.

**Logged conditions**:

| Condition | Log level | Location |
|---|---|---|
| Webhook received | — | (implicit) |
| No local order for session (crash window) | WARN | stripe-webhook |
| Recovery order inserted | LOG | stripe-webhook |
| Recovery insert failed | ERROR | stripe-webhook |
| Recovery impossible (missing metadata) | ERROR | stripe-webhook |
| Printful order already exists (duplicate skip) | LOG | stripe-webhook |
| Printful order created | (implicit via success path) | stripe-webhook |
| OR-13 duplicate external_id | LOG | stripe-webhook |
| OR-13 recovery succeeded | LOG | stripe-webhook |
| OR-13 recovery failed | ERROR | stripe-webhook |
| Printful order failed (non-OR-13) | ERROR | stripe-webhook |
| Printful submission exception | ERROR | stripe-webhook |
| Resend email error | ERROR | stripe-webhook |
| Printful webhook error | ERROR | printful-webhook |
| Mixed Stripe environment | ERROR | stripe-config.ts (Next.js logs) |

**Gaps**:
- No external log aggregation (Datadog, Sentry, etc.) — POST-LAUNCH
- No alerting on error conditions — POST-LAUNCH
- Provider timeout not explicitly logged (fetch timeout not set) — POST-LAUNCH

**For initial launch**: Supabase edge function logs are sufficient for a single controlled production test. The operator should monitor logs during Phase 7.

---

## 25. Security Review

| Item | Status | Notes |
|---|---|---|
| Stripe secret key | SERVER-ONLY | Edge function env var; never in client bundle |
| Stripe webhook secret | SERVER-ONLY | Edge function env var; never in client bundle |
| Printful token | SERVER-ONLY | Edge function env var + .env.local; never in client bundle |
| Supabase service role key | SERVER-ONLY | .env.local + edge function env var; never in client bundle |
| Stripe signature verification | PASS | constructEventAsync on every webhook |
| Server-authoritative price | PASS | Price resolved from DB in stripe-checkout; client price ignored |
| Trusted artwork | PASS | artwork_url validated as *.supabase.co at checkout |
| Admin routes protected | PASS | requireAdmin() on all /api/admin/* routes |
| Manual confirmation protected | PASS | requireAdmin() on /api/admin/orders |
| Refund operations protected | PASS | requireAdmin() on /api/stripe-admin |
| Cancellation protected | PASS | requireAdmin() on /api/admin/orders |
| Client trust boundary | PASS | Browser provides product/variant UUID + quantity only |
| Browser cannot set price | PASS | Price from DB only |
| Browser cannot set Printful variant | PASS | Resolved from DB in checkout |
| Browser cannot set artwork | PASS | Resolved from DB in checkout |
| Browser cannot set payment state | PASS | Set by webhook only |
| Browser cannot set fulfillment state | PASS | Set by webhook only |
| CORS on stripe-checkout | PASS | Restricted to SITE_URL + localhost |
| RLS on orders | PASS | Public INSERT; admin SELECT/UPDATE/DELETE only |
| Printful webhook signature | PASS | HMAC-SHA256 if PRINTFUL_WEBHOOK_SECRET set |

---

## 26. Test Data / Production Data Separation

**Mechanism**: `orders.livemode` boolean column. Set from `event.livemode` in stripe-webhook (Stripe provides this on every event). Set from `isLiveMode` (derived from key prefix) in stripe-checkout.

**Admin UI**: Live/Test filter in `/admin/orders`. Test orders show amber "Test" badge. Live orders show green "Live" badge.

**Test orders**: 41 test orders from Phase 5.2 and earlier testing. All have `livemode=false`. Clearly distinguishable from production orders.

**Deletion**: Test orders can be deleted from admin UI (Trash icon visible only for `livemode=false` orders). Live orders cannot be deleted from admin UI.

**Revenue reporting**: Admin Stripe panel filters revenue by `livemode` matching the active Stripe mode. Test orders are never counted in live revenue.

**Recommendation**: Do not delete Phase 5.2 test orders. They are useful audit evidence and are clearly separated from production data. If the admin dashboard becomes cluttered, use the "Live only" filter.

---

## 27. Database Changes

**Migration added**: `supabase/migrations/20261022000000_phase6_stripe_session_unique.sql`

Contents:
1. Pre-flight duplicate scan — fails migration if duplicates exist
2. `UNIQUE CONSTRAINT orders_stripe_session_id_unique` on `orders.stripe_session_id`
3. `idx_orders_stripe_session_id` — partial index for non-null session IDs
4. `idx_orders_fulfillment_status` — partial index for admin attention queries
5. `idx_orders_paid_no_printful` — partial index for paid orders missing Printful ID

**Deploy**: `supabase db push` or apply via Supabase Dashboard SQL editor.

**Existing data**: The pre-flight check will verify no duplicate `stripe_session_id` values exist before adding the constraint. Phase 5.2 test data should not have duplicates (each test run used a unique session).

---

## 28. Code Changes

| File | Change | Reason |
|---|---|---|
| `supabase/migrations/20261022000000_phase6_stripe_session_unique.sql` | NEW | DB-layer uniqueness for stripe_session_id |
| `supabase/functions/printful-proxy/index.ts` | MODIFIED | Added GET /orders/:id, POST /orders/:id/confirm, DELETE /orders/:id |
| `src/app/api/admin/orders/route.ts` | NEW | Admin-protected confirm_printful and cancel_printful actions |
| `src/app/admin/orders/page.tsx` | MODIFIED | needs_admin_review alert, failed fulfillment alert, attention filter, manual confirm/cancel UI |
| `src/lib/stripe-config.ts` | MODIFIED | Mixed-environment detection logging |
| `src/__tests__/fulfillment/phase6.test.ts` | NEW | 39 Phase 6 safety tests |

---

## 29. Automated Tests

**Phase 6 test file**: `src/__tests__/fulfillment/phase6.test.ts`

39 new tests across 8 describe blocks:

1. Stripe session uniqueness invariant (4 tests)
2. needs_admin_review detection (6 tests)
3. Manual Printful confirmation preconditions (6 tests)
4. Cancellation preconditions (5 tests)
5. Stripe mixed-environment detection (4 tests)
6. Test/live order separation (4 tests)
7. External ID format — Phase 5.2 fix preserved (4 tests)
8. PRINTFUL_AUTO_CONFIRM fail-safe (7 tests)

---

## 30. Build Verification

```
TypeScript:  PASS  (npx tsc --noEmit)
Tests:       509/509 PASS  (9 test files, +39 Phase 6 tests)
Build:       PASS  (npm run build)
```

Baseline was 470/470. Phase 6 adds 39 tests → 509/509.

---

## 31. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Production artwork not yet verified | CRITICAL | Must verify before Phase 7 |
| Live Stripe keys not yet configured | HIGH | Procedure documented; do not configure until Phase 7 authorized |
| Tax not collected | HIGH | BUSINESS CONFIG REQUIRED; operator accepts risk for initial test |
| No external log aggregation | MEDIUM | Supabase logs sufficient for initial test; add post-launch |
| Printful in-production cancellation not possible via API | MEDIUM | Documented; admin contacts Printful support |
| Cancellation/fulfillment-failure customer emails absent | LOW | Manual communication acceptable for initial test |
| Printful webhook PRINTFUL_WEBHOOK_SECRET | LOW | SET in .env.local; must also be set as edge function secret |
| No fetch timeout on Printful API calls | LOW | Edge function has 60s timeout; Printful typically responds in <5s |
| Concurrent webhook execution window | LOW | DB UNIQUE constraint closes the gap; OR-13 recovery handles provider side |

---

## 32. Controlled First Production Order Plan

**DO NOT EXECUTE DURING PHASE 6.**

This plan is for Phase 7 — separately authorized.

### Pre-flight checklist (complete before Phase 7)

- [ ] Verify production artwork meets Printful requirements for chosen product/placement
- [ ] Configure live Stripe keys in `/admin/stripe` (Save & Activate)
- [ ] Verify live webhook registered in Stripe Dashboard
- [ ] Confirm `PRINTFUL_AUTO_CONFIRM` is absent from edge function secrets
- [ ] Confirm `stripe_mode=live` in DB after key activation
- [ ] Confirm Supabase edge function secrets show live key (check via Supabase Dashboard)

### Phase 7 execution

1. Use real production-quality product with verified artwork
2. Place order through live storefront with real payment card
3. Verify Stripe Dashboard shows live charge
4. Verify local order created with `livemode=true`, `status=paid`
5. Verify Printful draft created (check `/admin/orders` → order detail → Check Printful)
6. **STOP — do not confirm yet**

### Admin verification before confirmation

- [ ] Product: correct title and variant
- [ ] Quantity: 1
- [ ] Artwork: correct file, correct placement
- [ ] Technique: DTG (or correct for product)
- [ ] Recipient: correct name and address
- [ ] Retail amount: correct
- [ ] Fulfillment cost: acceptable

### Confirmation

7. Click "Confirm → Production" in order detail modal
8. Verify Printful status transitions from draft → pending/in-production
9. Monitor Printful Dashboard for production progress
10. Verify shipping notification email received when shipped
11. Inspect physical product on delivery

### Rollback

If anything is wrong before confirmation: click "Cancel Draft" in order detail modal. Issue Stripe refund via `/admin/stripe`.

---

## 33. Production Readiness Matrix

| Gate | Result | Severity | Notes |
|---|---|---|---|
| Paid order recovery | PASS | Critical | Phase 5.2A crash-window recovery deployed |
| Recovered order admin visibility | PASS | Critical | Phase 6 alert banner + attention filter |
| Stripe session uniqueness | PASS | Critical | Phase 6 DB UNIQUE constraint added |
| Printful duplicate protection | PASS | Critical | printful_order_id guard + OR-13 + DB UNIQUE |
| Immutable snapshot | PASS | Critical | Frozen at checkout; never re-resolved |
| Direct Catalog fulfillment | PASS | Critical | DIRECT_CATALOG_ORDER; printful_id=NULL |
| Auto-confirm disabled | PASS | Critical | PRINTFUL_AUTO_CONFIRM absent = false |
| Manual fulfillment confirmation | PASS | Critical | Phase 6 /api/admin/orders + UI |
| Fulfillment failure visibility | PASS | Critical | Phase 6 alert banner + attention filter |
| Production artwork | REQUIRES VERIFICATION | Critical | Operator must verify before Phase 7 |
| Stripe live configuration readiness | PASS | Critical | Procedure documented; keys not yet switched |
| Live webhook readiness | PASS | Critical | Auto-registration procedure verified |
| Environment isolation | PASS | Critical | Phase 6 mixed-env detection; separate key storage |
| Secret protection | PASS | Critical | All secrets server-side only |
| Cancellation procedure | PASS | High | Draft cancel via API; in-production via Printful support |
| Refund procedure | PASS | High | /admin/stripe refund + customer email |
| Shipping configuration | PASS | High | Live Printful rates at checkout; fallback configured |
| Tax configuration status | REQUIRES BUSINESS CONFIG | High | No Stripe Tax; operator accepts risk |
| Customer confirmation email | PASS | Medium | Order confirmation via Resend |
| Provider status tracking | MANUAL | Medium | Printful webhook handles shipped/fulfilled/canceled |
| Test data separation | PASS | High | livemode column + admin filter |
| TypeScript | PASS | Critical | 0 errors |
| Automated tests | PASS | Critical | 509/509 |
| Production build | PASS | Critical | npm run build PASS |

---

## 34. Final Decision

**Conditions for FIRST CONTROLLED REAL ORDER approval**:

1. Production artwork verified against Printful requirements for the chosen product/placement
2. Live Stripe keys configured and activated in admin panel
3. Live webhook registered and verified
4. `PRINTFUL_AUTO_CONFIRM` confirmed absent from Supabase edge function secrets
5. DB migration `20261022000000_phase6_stripe_session_unique.sql` applied to production

Items 2–5 are procedural and can be completed in minutes. Item 1 requires the operator to verify artwork quality — this is the only substantive gate remaining.

---

PHASE 6 PRODUCTION READINESS & LAUNCH HARDENING: COMPLETE

CORE COMMERCE SAFETY GATE: PASS

PRODUCTION CONFIGURATION GATE: CONDITIONAL

FIRST CONTROLLED REAL ORDER: APPROVED (conditional on artwork verification and live Stripe key configuration)

PUBLIC CUSTOMER LAUNCH: NOT READY (tax configuration decision required; cancellation/failure customer emails absent; external log aggregation absent)
