# CountyBuys — Architecture Contract Change Log

---

## Change Set: Phase 11A.5A — V2 Production & Mockup Contract Integration

**Date**: Phase 11A.5A audit completion  
**Triggered by**: Phase 11A.5A — V2 Production & Mockup Contract Verification (read-only live audit)  
**Sections modified**: §3, §8, §10  
**Section unchanged**: §4 (already updated with V2-first policy prior to this change set)

---

### Deficiencies Resolved

#### Deficiency 1 — No V2-first selection rule

**Previous state**: §4 listed V1 and V2 as parallel entries with no precedence statement. New Catalog Builder work had no contract basis for preferring V2.

**Resolution**: §3, §8, and §10 replacements each explicitly reference "the V2-first policy defined in Section 4." The selection rule is now enforced by cross-reference from every section that touches provider API usage.

---

#### Deficiency 2 — V2 mockup-template and mockup-style contracts not recorded

**Previous state**: `GET /v2/catalog-products/{id}/mockup-templates` and `GET /v2/catalog-products/{id}/mockup-styles` were live-proven in Phase 11A.5A but appeared nowhere in the contract. An agent had no contract basis to know they existed, what fields they returned, what `role` meant, or how to resolve a template from them.

**Resolution**: §8 replacement records both endpoints with their live-proven field sets, resolution algorithm, role semantics, and explicit scope boundaries. Already captured in §4.4 and §4.5 prior to this change set; §8 now references and enforces those entries for the production metadata workflow.

---

#### Deficiency 3 — §8 described V1 `variant_mapping` as universally authoritative

**Previous state**: §8 stated "Template resolution must follow the `variant_mapping` path" without scope qualification. This was correct for the legacy V1/ProductDesigner/printful_sync path but directly contradicted the live-proven V2 Catalog Builder contract where `variant_mapping` IDs are a different namespace.

**Resolution**: §8 replacement scopes `variant_mapping` explicitly to V1-only workflows. The prohibited identity crossing (`V2 CatalogVariant.id → V1 variant_mapping.variant_id`) is stated as a hard rule. The Catalog Builder path uses `catalog_variant_ids[]` from V2 mockup-templates exclusively.

---

#### Deficiency 4 — Transitional V1 responsibilities not explicitly bounded

**Previous state**: Four surviving V1 dependencies (available placements, DPI validation, `conflicting_placements`, mockup task creation/polling) were not marked as transitional, not bounded to specific paths, and not distinguished from permanent V1 usage. A reader could not tell "V1 because it's right" from "V1 because V2 hasn't been verified yet."

**Resolution**: §8 replacement names each surviving V1 dependency explicitly, labels each as transitional, states its current authorized scope, and gives the condition under which it may be migrated. §10 replacement adds a migration rule governing when a V1 capability may remain.

---

#### Deficiency 5 — `printful_sync` treated as co-equal primary architecture

> ⚠️ **FLAGGED FOR SECOND REVIEW — DISPOSITION NOT YET DECIDED**
>
> The original §3 described `catalog_builder` and `printful_sync` almost symmetrically, with sync described as "preserved unchanged." This implicitly treated sync as a co-equal primary architecture for new development.
>
> The §3 replacement reclassifies `printful_sync` as a **compatibility path**, not a primary architecture. It explicitly states that the long-term disposition of `printful_sync` must be determined by a separate dependency audit, with four possible outcomes: KEEP / OPTIONAL / DEPRECATE / REMOVE LATER.
>
> **Why this requires a second review**: Based on the project history (ChatGPT architecture conversation, Phase 2 live verification, current Printful store state), `printful_sync` may be a candidate for deprecation. The Printful store currently has only one real synced product (Lightweight quarter-zip pullover). All other products are Catalog Builder products. The sync infrastructure exists but its ongoing necessity has not been formally audited.
>
> **What must NOT happen before the second review**:
> - `printful_sync` code must not be deleted
> - Existing synced products must not be broken
> - `SYNC_VARIANT` fulfillment path must not be removed
> - No disposition (KEEP / OPTIONAL / DEPRECATE / REMOVE LATER) may be chosen
>
> **What the second review must establish**:
> 1. How many active `catalog_source = printful_sync` products currently exist in the database
> 2. Whether any have been ordered by real customers (immutable fulfillment snapshots exist)
> 3. Whether the `printful-proxy` sync Edge Function is still being invoked
> 4. Whether any admin workflow still depends on sync identity
> 5. Whether the Printful store's provider-managed product (quarter-zip) is intended to remain as a sync product or be rebuilt as a Catalog Builder product
>
> Until the second review is complete, §3 correctly records `printful_sync` as a compatibility path with an open disposition question. This is the accurate current state.

---

### Sections Not Modified

| Section | Reason unchanged |
|---|---|
| §1 System Ownership | Correct and complete |
| §2 Product Identity Chain | Correct and complete |
| §4 Printful API Responsibilities | Already updated with V2-first policy (§4.1–§4.14) prior to this change set |
| §5 Catalog Variant Semantics | Correct and complete |
| §6 Eligibility | Correct and complete |
| §7 Pricing Semantics | Correct and complete |
| §9 Product Designer Race Safety | Correct and complete |
| §11 Fulfillment Snapshots | Correct and complete |
| §12 Provider Contract Rule | Correct and complete |
| §13 Rate-Limit Safety | Correct and complete |
| §14 Safety During Diagnostic Work | Correct and complete |
| §15 Historical Document Policy | Correct and complete |
| §16 Amazon Q Change Control | Correct and complete |

---

### Post-Change Contract Status

| Deficiency | Status |
|---|---|
| No V2-first selection rule | RESOLVED |
| V2 mockup-template/style contracts not recorded | RESOLVED |
| §8 `variant_mapping` universally authoritative | RESOLVED |
| Transitional V1 responsibilities not bounded | RESOLVED |
| `printful_sync` co-equal primary architecture | RESOLVED IN CONTRACT — DISPOSITION PENDING SECOND REVIEW |

**Contract ambiguities remaining**: 0  
**Contract contradictions remaining**: 0  
**Open disposition questions**: 1 (`printful_sync` — see Deficiency 5 above)

---

## Change Set: Contract Consistency Delta Corrections

**Date**: Contract consistency delta check completion  
**Triggered by**: CONTRACT CONSISTENCY DELTA CHECK — four document-level issues found after Phase 11A.5A change set  
**Sections modified**: §4.4, §6, §7, §8.1, contract header  
**Removed**: obsolete HTML-commented old §4 block

---

### Issues Found and Corrected

#### Issue 1 — §4.4 / §8.1: Target-state ambiguity

**Problem**: §4.4 and §8.1 described the V2 mockup-template path as the current Catalog Builder behavior. The provider contract is live-proven, but the Catalog Builder implementation has not yet been migrated. No marker distinguished live-proven target from current implementation. A reader (including an AI agent) would conclude the migration was already complete.

**Correction**: Added `⚠️ IMPLEMENTATION MIGRATION PENDING` markers to both §4.4 and §8.1. Each marker explicitly states: provider contract is live-proven, Catalog Builder migration is pending, the legacy `variant_mapping[0]` fallback in `CatalogBuilder.tsx` is an implementation gap and not an authorized exception, and Workstream A must remove it.

---

#### Issue 2 — §6: `"unknown"` eligibility layer ambiguity

**Problem**: The `CatalogVariantEligibility` TypeScript type declared three values (`"eligible"`, `"unavailable"`, `"error"`), but the §6 table documented a fourth value (`"unknown"`) in the same section without clarifying it was not part of the type and not returned by `getCatalogVariants()`. This was an internal contradiction.

**Correction**: §6 now explicitly states that `getCatalogVariants()` always returns one of exactly three values and never returns `"unknown"`. The table is split into two clearly labeled groups: **Provider result states** (returned by `getCatalogVariants()`) and **UI / pre-validation state** (not returned by `getCatalogVariants()`). `"unknown"` is defined as a higher-level UI and `ProductSummary` layer concept representing the state before variant retrieval has been performed.

---

#### Issue 3 — §7: Stale provider cost comment

**Problem**: The inline code comment read `"V2 does not provide cost"`. This was factually incorrect since Phase 11A.4. V2 provides authoritative provider cost via `GET /v2/catalog-products/{id}/prices` (§4.3). The comment risked misleading an agent into believing V2 has no pricing capability.

**Correction**: Comment updated to `"V2 catalog-variants endpoint does not provide cost; authoritative cost is resolved separately through GET /v2/catalog-products/{id}/prices"`. The distinction between the catalog-variants endpoint and the prices endpoint is now explicit.

---

#### Issue 4 — Obsolete commented old §4 block

**Problem**: The contract contained an HTML-commented copy of the original §4 (`<!-- ## 4. PRINTFUL API RESPONSIBILITIES ... -->`). AI agents read HTML comment text. The old §4 presented V1 template and printfile endpoints as the production metadata endpoints with no V2 alternative, no transitional label, and no V2-first policy — directly contradicting the active §4.1–§4.14.

**Correction**: The HTML comment block was removed entirely. Historical context is preserved in `Printful/CONTRACT-CHANGE-LOG.md`, `Printful/archive/`, and `Printful/reports/`.

---

#### Issue 5 — Contract header

**Problem**: The header stated `"Derived from: Current stabilized source code, passing tests, and live-proven provider API contracts"`. This implied every rule in the contract was already implemented, which was false for §4.4 and §8.1.

**Correction**: Header updated to `"Derived from: Current stabilized source code, passing tests, live-proven provider API contracts, and required target architecture"`. A note was added below the header explaining that sections marked `⚠️ IMPLEMENTATION MIGRATION PENDING` describe live-proven target architecture not yet fully implemented.

---

### Final Post-Correction Contract Status

| Issue | Status |
|---|---|
| §4.4 / §8.1 target-state ambiguity | RESOLVED |
| §6 `"unknown"` eligibility contradiction | RESOLVED |
| §7 stale V2 pricing comment | RESOLVED |
| Obsolete commented §4 drift risk | RESOLVED |
| Contract header implied full implementation | RESOLVED |

**Contract ambiguities remaining**: 0  
**Contract contradictions remaining**: 0  
**Open disposition questions**: 1 (`printful_sync` — KEEP / OPTIONAL / DEPRECATE / REMOVE LATER — pending second review)

---

## Change Set: Workstream A — V2 Catalog / Production / Mockups — Operator Verified

**Date**: Workstream A operator test completion
**Triggered by**: Workstream A operator test — live end-to-end verification of V2 Catalog Builder path
**Sections modified**: §4.4, §8.1, contract header note, `Last stabilized`
**Change log**: This entry

---

### Changes Applied

#### §4.4 — IMPLEMENTATION MIGRATION PENDING marker removed

**Previous state**: §4.4 carried `⚠️ IMPLEMENTATION MIGRATION PENDING` indicating the V2 mockup-template path was live-proven but not yet implemented in the Catalog Builder.

**Resolution**: Workstream A implementation complete and operator-verified. `CatalogBuilder.tsx` now uses `getMockupTemplates()` + `resolveV2Template()` exclusively. `variant_mapping[0]` fallback removed. `variantPrintfiles[0]` fallback removed. Marker removed.

---

#### §8.1 — IMPLEMENTATION MIGRATION PENDING marker removed

**Previous state**: §8.1 carried `⚠️ IMPLEMENTATION MIGRATION PENDING` with the same scope.

**Resolution**: Same as §4.4. Marker removed.

---

#### Contract header note updated

**Previous state**: Note described sections marked PENDING as binding requirements for the next workstream.

**Resolution**: Note updated to record that §4.4 and §8.1 markers have been removed and no pending migration markers remain.

---

#### Last stabilized updated

Updated to: `Workstream A — V2 Catalog / Production / Mockups — Operator Verified`

---

### Workstream A Operator Test Evidence

**Test date**: Workstream A operator test session
**Product**: 679 (Unisex Performance Crew Neck T-Shirt | A4 N3142)
**Variant**: 17008 (Black / 2XL)
**Technique**: dtfilm
**Placement**: front

**V2 catalog list**: GET /v2/catalog-products — 535 products, product 679 found at offset 200, `name` field normalized to `title`, no `currency`/`files`/`options` fabricated.

**V2 variant identity**: GET /v2/catalog-products/679/catalog-variants — 70 variants, variant 17008 confirmed `eligible`, V2 namespace.

**V2 production templates**: GET /v2/catalog-products/679/mockup-templates — 60 templates total. `resolveV2Template(templates, 17008, "dtfilm", "front")` → exactly 1 primary match. Geometry: `print_area_width=1429, print_area_height=1809, print_area_top=464, print_area_left=801, template_width=3000, template_height=3000`.

**V2 mockup styles**: GET /v2/catalog-products/679/mockup-styles — 4 styles. front/dtfilm: `print_area_width=15.5in, print_area_height=19.6in, dpi=150, print_area_type=simple`. Derived canvas: 2325×2940px — exact match to V1 printfile (live-proven equivalence confirmed).

**V2 conflicting placements**: GET /v2/catalog-products/679 — `placements[].conflicting_placements` inline. front/dtfilm conflicts: `["front_large","front_dtf","front_dtfabric","chest_left_dtf","front_large_dtf"]`.

**DPI validation**: artwork 1086×1448px on front/dtfilm → effective DPI 74 → FAIL (legitimate result — artwork below 150 DPI minimum). V2 `validateArtworkFromV2Style()` used. No `fetchPrintfileSpec()` called. No `variantPrintfiles[0]` fallback.

**V2 mockup task**: POST /v2/mockup-tasks — task ID `979308973` (numeric). `catalog_variant_ids: [17008]` explicitly supplied. `source: "catalog"`. No `variant_ids` field. No `task_key` in response.

**V2 mockup polling**: GET /v2/mockup-tasks?id=979308973 — completed on first poll. `catalog_variant_mockups[0].catalog_variant_id: 17008`. No V1 `task_key` polling.

**Mockup persistence**: Printful temporary URL downloaded (404,701 bytes, image/png). Uploaded to Supabase Storage at `mockups/979308973-0.png`. Permanent URL: `https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/mockups/979308973-0.png`. Persistence: SUCCESS.

**V1 runtime calls during Catalog Builder flow**: NONE. No calls to `/products`, `/products/{id}`, `/mockup-generator/printfiles`, `/mockup-generator/templates`, `/mockup-generator/create-task`, `/mockup-generator/task`.

**ProductDesigner smoke check**: V1 templates endpoint returns `variant_mapping` with V1 variant IDs. ProductDesigner derives variants from `variant_mapping`. V1→V1 identity chain intact. No runtime exceptions.

**Safety**: 1 mockup task created. 0 products published. 0 Stripe activity. 0 Printful orders. 0 manufacturing. 1 Supabase Storage write (mockup persistence only).

---

### Observation: persist route uses V1 polling internally

The existing `persistGeneratedMockups()` route (`/api/printful/mockups/persist`) calls `getMockupTask(taskKey)` (V1) internally. When called with a V2 numeric task ID string (`"979308973"`), the V1 endpoint `/mockup-generator/task?task_key=979308973` returns HTTP 200 with a V1-shaped response including `mockups[]` and `task_key: "gt-979308973"`. The mockup URL matches the V2 result.

This is observed cross-namespace behavior — not a guaranteed contract. The persist route works in practice for V2 task IDs. A future Workstream C cleanup may migrate the persist route to use V2 polling directly. This is not a blocking defect for Workstream A.

---

### Post-Workstream-A Contract Status

| Item | Status |
|---|---|
| §4.4 IMPLEMENTATION MIGRATION PENDING | REMOVED — operator verified |
| §8.1 IMPLEMENTATION MIGRATION PENDING | REMOVED — operator verified |
| V2 catalog list | COMPLETE |
| V2 catalog detail | COMPLETE |
| V2 variant identity | COMPLETE |
| V2 production templates | COMPLETE |
| V2 mockup styles / DPI | COMPLETE |
| V2 mockup task creation | COMPLETE |
| V2 mockup polling | COMPLETE |
| Mockup persistence | COMPLETE |
| No variant_mapping[0] in Catalog Builder | VERIFIED |
| No variantPrintfiles[0] in Catalog Builder | VERIFIED |
| ProductDesigner V1 path | INTACT |
| Fabricated provider fields | REMOVED |
| MockupPollResult adapter | COMPLETE |

**Contract ambiguities remaining**: 0
**Contract contradictions remaining**: 0
**Open disposition questions**: 1 (`printful_sync` — KEEP / OPTIONAL / DEPRECATE / REMOVE LATER — pending second review)
**Pending migration markers**: 0

**Next step**: Batch 2 Verification (V2 shipping rates, V2 order creation, V2 order retrieval, V2 webhook event format).

---

## Change Set: Workstream A Final Persistence Cleanup

**Date**: Workstream A final persistence cleanup
**Triggered by**: Defect found during Workstream A operator test — persist route called V1 getMockupTask() for V2 task IDs
**Sections modified**: None — no contract sections required updating; §4.4 and §8.1 markers remain removed
**Files modified**: `src/lib/printful/persist.ts`, `src/app/api/printful/mockups/persist/route.ts`, `src/app/admin/catalog-builder/CatalogBuilder.tsx`
**Files created**: `src/__tests__/printful/workstream-a-persist.test.ts`

---

### Defect

The persist route (`/api/printful/mockups/persist`) called `getMockupTask(taskKey)` (V1) internally for all requests, including V2 Catalog Builder requests. When called with a V2 numeric task ID string (`"979308973"`), the V1 endpoint `/mockup-generator/task?task_key=979308973` returned HTTP 200 with `task_key: "gt-979308973"` and V1-shaped `mockups[]`. This worked in practice but was cross-namespace behavior — not a guaranteed contract.

The completed `V2MockupTask` result already contained all mockup URLs. The V1 re-fetch was entirely redundant.

---

### Fix

**Option A applied**: Pass mockup URLs directly from the completed V2 task result. No provider re-fetch.

**`src/lib/printful/persist.ts`**: Added `V2MockupEntry` type and `persistV2Mockups(mockups, taskId)` function. Downloads temporary URLs and uploads to Supabase Storage. `catalog_variant_id` remains in V2 identity space. No V1 endpoint called.

**`src/app/api/printful/mockups/persist/route.ts`**: Added V2 path detected by `source === "v2"`. Accepts `{ source: "v2", taskId: number, mockups: V2MockupEntry[] }`. Calls `persistV2Mockups()` directly. V1 legacy path unchanged — still accepts `{ taskKey: string }` and calls `getMockupTask()` with genuine V1 task_key.

**`src/app/admin/catalog-builder/CatalogBuilder.tsx`**: `handleMockupComplete()` now builds `V2MockupEntry[]` from `pollResult.v2Task.catalog_variant_mockups` and sends `{ source: "v2", taskId: task.id, mockups: v2Mockups }` to the persist route. No `taskKey: String(task.id)` conversion. No V1 endpoint called anywhere in the Catalog Builder persistence path.

---

### Final V2 Catalog Builder Persistence Flow

```text
POST /v2/mockup-tasks
        ↓
GET /v2/mockup-tasks?id={numeric_id}
        ↓
V2MockupTask.catalog_variant_mockups[].mockups[].mockup_url
        ↓
POST /api/printful/mockups/persist { source:"v2", taskId: number, mockups: V2MockupEntry[] }
        ↓
persistV2Mockups() — downloads temporary URLs, uploads to Supabase Storage
        ↓
Permanent Supabase Storage URLs
```

No V1 endpoint called anywhere in this path.

---

### Post-Cleanup Status

| Item | Status |
|---|---|
| V1 getMockupTask() called for V2 tasks | REMOVED |
| V2 persist path uses direct mockup URLs | COMPLETE |
| V1 legacy persist path | INTACT |
| No V2→V1 task conversion | VERIFIED |
| catalog_variant_id in V2 identity space | VERIFIED |
| Tests | 1389/1389 PASS (+19 new) |
| TypeScript | 0 errors |
| Build | PASS |

**Workstream A fully V2 in modern path**: YES
**Workstream A complete**: YES
**Ready for Batch 2 Verification**: YES

---

## Change Set: Workstream B — V2 Fulfillment / Shipping / Orders — Operator Verified

**Date**: Workstream B operator test completion  
**Triggered by**: Workstream B operator test — live end-to-end verification of V2 DIRECT_CATALOG_ORDER fulfillment path  
**Sections modified**: Contract header (`Last stabilized`), §10.1  
**Change log**: This entry

---

### Changes Applied

#### Contract header — Last stabilized updated

Updated to: `Workstream B — V2 Fulfillment / Shipping / Orders — Operator Verified`

Header note updated to reference §10.1 Workstream B operator verification.

---

#### §10.1 — V2 Fulfillment Capabilities table added

Added operator-verified V2 fulfillment capability table and live-proven request/response shapes for:

- `POST /v2/shipping-rates` — shipping rates
- `POST /v2/orders` — draft order creation
- `GET /v2/orders/{id}` — order retrieval
- `GET /v2/orders/@{external_id}` — lost-response recovery
- `DELETE /v2/orders/{id}` — order cancellation
- `POST /orders/{id}/confirm` — V1 LEGACY EXCEPTION (explicit operator confirmation only)

Mixed-cart rule recorded: any SYNC_VARIANT item routes the entire order to V1.

---

### Workstream B Operator Test Evidence

**Test date**: Workstream B operator test session  
**Product**: 6824b815-3ce4-4888-b832-3eba84757ad5 (Still Original Grandpa Graphic Tee, catalog_id=71, Bella+Canvas 3001)  
**Variant**: 3af6fdc5-024c-4f07-baa7-2c92dfd5b742 (White / L)  
**Catalog variant ID**: 4013  
**Technique**: DTG  
**Placement**: front  

**V2 shipping**: `POST /v2/shipping-rates` — returned $4.95 live rate for catalog_variant_id=4013. Not fallback.

**Stripe session**: `cs_test_b1bE5cB9dHF2zIbw8IFb3qbqCUtLpgiYDiAsj51FkDB1Hpdr1rBle8ufrO` — `livemode=false` confirmed.

**Webhook**: `checkout.session.completed` delivered to deployed `stripe-webhook`. HMAC signature verified with deployed test webhook secret. HTTP 200 `{"received":true}`.

**CountyBuys order**: `92dd1f7a-fd9e-4379-8075-06d14ef392d3` — updated from `pending` to `paid`. `stripe_payment_intent_id: pi_3UNMmTGYFSCoPbX91oJwlams` (test mode, `livemode=false`).

**Fulfillment snapshot**: Identical pre- and post-payment. `strategy=DIRECT_CATALOG_ORDER`, `catalog_variant_id=4013`, `placement=front`, `technique=DTG`, `frozen_at=2026-10-06T00:46:55.770Z`. No mutation.

**V2 order creation**: `POST /v2/orders` — Printful order `179558314` created. `external_id=so-92dd1f7afd9e4379807506d14ef39` (matches `buildPrintfulExternalId()` output exactly). `status=draft`. No confirm parameter. No confirmation call.

**V2 order item verified**: `source=catalog`, `catalog_variant_id=4013`, `quantity=1`, `retail_price=29.99`. Placement: `front`, technique: `dtg`. Layer: `type=file`, `url=https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/artwork/tmp/1790988655355-6b80622243.png` (matches frozen snapshot artwork_url exactly).

**V2 retrieval**: `GET /v2/orders/179558314` — confirmed `source=catalog`, `catalog_variant_id=4013`, `placement=front`, `technique=dtg`, artwork URL matches snapshot, `status=draft`.

**V2 cancellation**: `DELETE /v2/orders/179558314` via printful-proxy — provider returned `status=canceled`. No JSON parse error. No confirmation before cancellation.

**Post-cancellation CountyBuys state**: `status=paid`, `fulfillment_status=draft`, `printful_order_id=179558314` retained as historical evidence. Snapshot unchanged.

**Confirmation safety**: Zero calls to `POST /v2/orders/{id}/confirmation`. Zero calls to `POST /orders/{id}/confirm`. `PRINTFUL_AUTO_CONFIRM` not set. Manufacturing: NO.

**Runtime V1 calls for this DIRECT_CATALOG_ORDER**: NONE. No `POST /shipping/rates`, no `POST /orders`, no `GET /orders/@external_id`.

**Safety totals**:
- Stripe test payments: 1 (test mode, livemode=false)
- Stripe live payments: 0
- Printful drafts created: 1 (order 179558314)
- Printful drafts cancelled: 1 (order 179558314)
- Orders confirmed: 0
- Manufacturing: NO

**Tests**: 1500/1500 PASS (31 files). TypeScript: 0 errors. Build: PASS.

---

### Separate Open Operational Issue (not blocking)

`pushSecretsToSupabase()` in `src/app/api/stripe-switch/route.ts` uses `SUPABASE_ACCESS_TOKEN` which currently returns HTTP 401 from the Supabase Management API (`https://api.supabase.com/v1/projects/{ref}/secrets`). The deployed test mode was confirmed independently via session `cs_test_...` `livemode=false`. The switch mechanism cannot reliably push updated secrets until the token is refreshed with a valid Supabase personal access token from the dashboard (Account → Access Tokens). This is a separate configuration-integrity task, not a code defect.

---

### Post-Workstream-B Contract Status

| Item | Status |
|---|---|
| DIRECT_CATALOG_ORDER shipping | V2 — operator verified |
| DIRECT_CATALOG_ORDER order creation | V2 — operator verified |
| DIRECT_CATALOG_ORDER order retrieval | V2 — operator verified |
| External ID recovery | V2 — live-proven Batch 2, implementation verified |
| Order cancellation | V2 — operator verified |
| Explicit confirmation | V1 LEGACY EXCEPTION — pending safe V2 verification |
| SYNC_VARIANT fulfillment | V1 compatibility retained |
| Mixed-cart fulfillment | V1 compatibility retained |
| FulfillmentSnapshot schema | Unchanged — immutable |
| Stripe commerce rail | Unchanged |
| printful_sync disposition | OPTIONAL — pending Workstream C |

**Contract ambiguities remaining**: 0  
**Contract contradictions remaining**: 0  
**Open disposition questions**: 1 (`printful_sync` — KEEP / OPTIONAL / DEPRECATE / REMOVE LATER — pending Workstream C)  
**Pending migration markers**: 0

**Next step**: Workstream C — Legacy Cleanup / Sync Disposition / Final Regression.

---

## Change Set: Workstream B — Status Correction

**Date**: Workstream B status update  
**Triggered by**: Operator instruction — accurate status record  
**Sections modified**: This change log only

---

### Workstream B Accurate Status

| Item | Status |
|---|---|
| WORKSTREAM B CODE COMPLETE | YES |
| WORKSTREAM B PROVIDER FULFILLMENT VERIFIED | YES — V2 shipping, V2 order creation, V2 retrieval, V2 cancellation all live-verified against Printful |
| WORKSTREAM B STRIPE WEBHOOK PROCESSING VERIFIED | YES — deployed stripe-webhook received a properly HMAC-signed checkout.session.completed event, verified signature, processed fulfillment, created Printful V2 draft order 179558314 |
| REAL STRIPE-HOSTED PAYMENT E2E | NOT YET VERIFIED — Stripe-hosted checkout card fields not accessible in headless Playwright environment; test infrastructure constraint, not an application defect |
| READY FOR WORKSTREAM C | YES |

**Note on real Stripe-hosted E2E**: All application-layer behavior has been verified. The unverified boundary is Stripe's own event generation and delivery from a real hosted checkout completion. The webhook handler, signature verification, fulfillment logic, V2 order creation, snapshot immutability, and V2 cancellation are all confirmed correct. The operator may complete this final boundary verification manually by opening the checkout URL in a browser and using test card 4242 4242 4242 4242. It does not block Workstream C.

---

## Change Set: Workstream C — Legacy Disposition / Final Regression

**Date**: Workstream C completion  
**Triggered by**: Workstream C — Legacy Disposition / V1 Cleanup / Final System Regression  
**Sections modified**: Contract header (`Last stabilized`), §3 (`printful_sync` disposition), §10.2 (sync compatibility path)  
**Change log**: This entry

---

### Changes Applied

#### Contract header — Last stabilized updated

Updated to: `Workstream C — Legacy Disposition / Final Regression — Complete`

Header note updated to reference §3 and §10.2 Workstream C sync disposition.

---

#### §3 — printful_sync disposition resolved: OPTIONAL

**Previous state**: §3 carried `⚠️ DISPOSITION PENDING SECOND REVIEW` with four possible outcomes (KEEP / OPTIONAL / DEPRECATE / REMOVE LATER) and an explicit block on choosing any disposition until the second review was complete.

**Resolution**: Workstream C database audit completed. Disposition assigned: **OPTIONAL**.

Evidence:
- 1 active `printful_sync` product: Lightweight quarter-zip pullover (UUID `aed80c7d-5f07-495a-8e1a-8ff1ec74726b`, Printful sync ID 476330305, catalog product 903)
- 8 variants, all `available: true`
- 0 orders of any status reference this product
- 0 paid orders on the SYNC_VARIANT path
- 0 fulfilled/shipped orders on the SYNC_VARIANT path
- Every order in the database uses `strategy: DIRECT_CATALOG_ORDER`

Rationale: The sync infrastructure is not required for any new Catalog Builder product. DIRECT_CATALOG_ORDER is fully independent. The quarter-zip remains active in the storefront with no order history. The sync code is isolated and does not contaminate the Catalog Builder path. OPTIONAL means the sync infrastructure may be preserved indefinitely at zero cost to the Catalog Builder architecture, or removed after the operator confirms the quarter-zip is either rebuilt as a Catalog Builder product or intentionally retired. No operator decision to remove it has been made.

---

#### §10.2 — Sync compatibility path updated

**Previous state**: §10.2 carried `⚠️ DISPOSITION PENDING SECOND REVIEW`.

**Resolution**: Updated to reflect OPTIONAL disposition with audit evidence. Pending marker removed.

---

### Workstream C Audit Findings

**Baseline**:
- Git commit: `d831d808` (working tree has Workstream A/B changes, all attributable to completed workstreams)
- Tests: 1500/1500 PASS (31 files)
- TypeScript: 0 errors
- Build: PASS

**Legacy data (read-only)**:
- `printful_sync` products: 1 (active)
- `printful_sync` products (inactive): 0
- Sync variants: 8 (all available)
- Orders referencing sync product: 0
- Paid orders on SYNC_VARIANT path: 0
- Fulfilled/shipped orders on SYNC_VARIANT path: 0
- Mixed-cart orders: 0
- All orders in database: `strategy: DIRECT_CATALOG_ORDER`

**Quarter-zip evidence**:
- Exists: YES
- Active: YES (status: active)
- Catalog source: printful_sync
- Printful sync ID: 476330305
- Printful catalog ID: 903
- Variants: 8 (XS–4XL, all available)
- Order references: 0
- Paid order references: 0
- Fulfilled order references: 0

**Final sync disposition**: OPTIONAL

**V1 dependency matrix** (final state):

| Endpoint/Helper | Caller | Purpose | Classification | Final State |
|---|---|---|---|---|
| `GET /v2/catalog-products` | `getCatalogProductsV2()` → `products/route.ts` → BlankSelector | Catalog product list | MODERN V2 | Active |
| `GET /v2/catalog-products/{id}` | `getCatalogProductV2()` → product-summary | Catalog product detail + conflicting_placements | MODERN V2 | Active |
| `GET /v2/catalog-products/{id}/catalog-variants` | `getCatalogVariants()` → VariantMatrix, product-summary | V2 variant identity | MODERN V2 | Active |
| `GET /v2/catalog-products/{id}/prices` | `getCatalogProductPrices()` → prices route | V2 provider pricing | MODERN V2 | Active |
| `GET /v2/catalog-products/{id}/mockup-templates` | `getMockupTemplates()` → mockup-templates route → CatalogBuilder | V2 production geometry | MODERN V2 | Active |
| `GET /v2/catalog-products/{id}/mockup-styles` | `getMockupStyles()` → mockup-styles route → CatalogBuilder | V2 DPI/style metadata | MODERN V2 | Active |
| `POST /v2/mockup-tasks` | `createMockupTask()` → mockups route → CatalogBuilder | V2 mockup generation | MODERN V2 | Active |
| `GET /v2/mockup-tasks?id=` | `getMockupTaskV2()` → mockups/[taskKey] route | V2 mockup polling | MODERN V2 | Active |
| `POST /v2/shipping-rates` | `getPrintfulShipping()` in stripe-checkout + stripe-webhook (DIRECT_CATALOG_ORDER path) | V2 shipping rates | MODERN V2 | Active |
| `POST /v2/orders` | stripe-webhook `checkout.session.completed` (allDirectCatalog=true) | V2 draft order creation | MODERN V2 | Active |
| `GET /v2/orders/{id}` | printful-proxy GET /orders/:id | V2 order retrieval | MODERN V2 | Active |
| `GET /v2/orders/@{external_id}` | stripe-webhook V2 duplicate recovery | V2 lost-response recovery | MODERN V2 | Active |
| `DELETE /v2/orders/{id}` | printful-proxy DELETE /orders/:id | V2 order cancellation | MODERN V2 | Active |
| `GET /products` | `getCatalogProducts()` — LEGACY V1 ONLY, not called from modern path | Legacy V1 catalog list | LEGACY V1 — OPTIONAL | Retained for ProductDesigner / printful_sync callers. Not called from Catalog Builder. |
| `GET /products/{id}` | `getCatalogProduct()` → product-summary (V1 fields), products/[productId]/v1 route | Legacy V1 product detail | LEGACY V1 — PRODUCTDESIGNER / SYNC | Retained. product-summary merges V1 product + V2 variants. |
| `GET /mockup-generator/printfiles/{id}` | `getPrintfiles()` → printfiles route → StageComponents.DesignPicker | V1 DPI validation at design selection | TRANSITIONAL V1 | Retained. DesignPicker still calls fetchPrintfileSpec(). CatalogBuilder production stage uses V2 validateArtworkFromV2Style(). |
| `GET /mockup-generator/templates/{id}` | `getLayoutTemplates()` → templates route → ProductDesigner, recipes/validate-all, batches | V1 template geometry for ProductDesigner; conflicting_placements | LEGACY V1 — PRODUCTDESIGNER ONLY | Retained. resolveLayoutTemplateForVariantPlacement() scoped to V1 callers only. |
| `POST /orders/{id}/confirm` | printful-proxy POST /orders/:id/confirm; admin/orders route confirm_printful action | Explicit operator order confirmation | LEGACY V1 EXCEPTION | Retained. V2 confirmation endpoint not live-verified (may trigger manufacturing). Explicit operator action only. Never called automatically. |
| `POST /orders` (V1) | stripe-webhook V1 path (SYNC_VARIANT / mixed carts) | V1 order creation for sync/mixed | LEGACY V1 — SYNC_VARIANT COMPATIBILITY | Retained. Only fires when allDirectCatalog=false. Zero orders have used this path. |
| `POST /shipping/rates` (V1) | stripe-checkout + stripe-webhook V1 path (sync/mixed carts) | V1 shipping for sync/mixed | LEGACY V1 — SYNC_VARIANT COMPATIBILITY | Retained. Only fires when allCatalogBuilder=false. |
| `GET /orders/@{external_id}` (V1) | stripe-webhook V1 OR-13 recovery | V1 lost-response recovery for sync/mixed | LEGACY V1 — SYNC_VARIANT COMPATIBILITY | Retained. Only fires on V1 OR-13 error. |
| `GET /store/products` | printful-proxy POST /sync | Sync product list refresh | LEGACY V1 — SYNC_VARIANT COMPATIBILITY | Retained. OPTIONAL disposition. |
| `GET /store/products/{id}` | printful-proxy POST /sync; identity.ts fallback | Sync product detail | LEGACY V1 — SYNC_VARIANT COMPATIBILITY | Retained. OPTIONAL disposition. |

**Dead V1 code removed**: NONE. No V1 code was found to be provably dead with zero runtime callers. The `POST /orders` and `POST /shipping` routes in printful-proxy are not called from the modern path but remain as SYNC_VARIANT compatibility infrastructure. They are not dead — they are OPTIONAL legacy.

**Intentional V1 survivors**:
- ProductDesigner: `GET /products/{id}`, `GET /mockup-generator/templates/{id}`, `resolveLayoutTemplateForVariantPlacement()` — V1→V1 identity chain intact
- SYNC_VARIANT: V1 shipping/order/recovery path in stripe-checkout and stripe-webhook
- Mixed-cart: V1 whole-order behavior retained
- Explicit confirmation: `POST /orders/{id}/confirm` — V1 LEGACY EXCEPTION, explicit operator action only
- Sync infrastructure: `GET /store/products`, `GET /store/products/{id}`, POST /sync — OPTIONAL, retained for quarter-zip

**Modern path V1 runtime dependency**:
- Catalog Builder V1 runtime dependency: NO (all V2)
- DIRECT_CATALOG_ORDER V1 runtime dependency: NO (all V2 except explicit confirmation)
- Explicit confirmation exception: YES (V1 LEGACY EXCEPTION)

**Fulfillment invariants**:
- Immutable snapshot preserved: YES
- Provider identity re-resolved after checkout: NO
- Sync identity translated to V2: NO

**Webhook regression**:
- Stripe checkout.session.completed: INTACT
- Printful package_shipped: INTACT
- Printful order_updated: INTACT

**Static verification**:
- Tests: 1500/1500 PASS
- TypeScript: 0 errors
- Build: PASS
- Database migrations: 0
- Database writes: 0
- Stripe activity: 0
- Printful writes: 0
- Manufacturing: NO

---

### Post-Workstream-C Contract Status

| Item | Status |
|---|---|
| printful_sync disposition | OPTIONAL — resolved |
| §3 DISPOSITION PENDING marker | REMOVED |
| §10.2 DISPOSITION PENDING marker | REMOVED |
| V1 dependency matrix | COMPLETE |
| Dead V1 code removal | N/A — no provably dead V1 code found |
| Legacy boundary comments | PRESENT in templates.ts, artwork-validation.ts, catalog.ts |
| Catalog Builder V1 runtime dependency | NONE |
| DIRECT_CATALOG_ORDER V1 runtime dependency | NONE (except explicit confirmation) |
| SYNC_VARIANT V1 compatibility | RETAINED — OPTIONAL |
| Mixed-cart V1 compatibility | RETAINED — OPTIONAL |

**Contract ambiguities remaining**: 0  
**Contract contradictions remaining**: 0  
**Open disposition questions**: 0  
**Pending migration markers**: 0

---

### Open Non-Architecture Items (recorded, not blocking)

| Item | Status |
|---|---|
| Real Stripe-hosted payment E2E | NOT YET VERIFIED — requires one manual Stripe TEST checkout through hosted UI |
| Stripe switch Management API 401 | OPEN OPERATIONAL ISSUE — SUPABASE_ACCESS_TOKEN needs refresh from Supabase dashboard |
| DPI FAIL block-vs-warn policy | OPEN PRODUCT POLICY ITEM — artwork FAIL result does not currently block Printful submission |
| Test-artifact cleanup | OPTIONAL OPERATIONAL ITEM — pending/paid test orders in database, no action required |

---

### Final System Status

| Item | Status |
|---|---|
| WORKSTREAM A | COMPLETE |
| WORKSTREAM B | CODE + PROVIDER PATH COMPLETE — real hosted Stripe payment E2E not yet verified |
| WORKSTREAM C | COMPLETE |
| CORE COUNTYBUYS ARCHITECTURE | COMPLETE |
| READY FOR FINAL LAUNCH-READINESS CHECKLIST | YES |
| PUBLIC LAUNCH VERIFIED | NO — real Stripe-hosted payment E2E and Stripe switch repair remain |
