# PRINTFUL INTEGRATION REPORT

Generated: 2025-07-10

---

## Repository Inspection

| Item | Value |
|---|---|
| Framework | Next.js 15.5.25 |
| Routing | App Router |
| TypeScript | Enabled (strict mode) |
| Path alias | `@/*` → `src/*` |
| Existing storage | Supabase Storage (`store-images` bucket) |
| Existing auth | Supabase Auth (admin + customer) |
| Existing DB | Supabase PostgreSQL |
| Existing Printful | `supabase/functions/printful-proxy` (sync, orders, shipping) |
| Existing webhook | `supabase/functions/printful-webhook` (shipped, fulfilled, cancelled) |
| Env var convention | `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `PRINTFUL_WEBHOOK_SECRET` |

---

## Phase 0 — Inspection ✅ COMPLETE

- Confirmed App Router, TypeScript strict, no existing product designer
- Confirmed Supabase Storage reusable for artwork (no new vendor needed)
- Confirmed existing `printful-proxy` edge function handles storefront sync/orders — not replaced
- Confirmed `PRINTFUL_API_TOKEN` is the existing env var name (spec uses `PRINTFUL_TOKEN` — kept existing name for consistency)

---

## Phase 1 — Server Lib Layer ✅ COMPLETE

### Implemented

| Capability | Status |
|---|---|
| Printful client | ✅ |
| Catalog retrieval | ✅ |
| Printfile retrieval | ✅ |
| Technique support | ✅ |
| Layout templates | ✅ |
| Variant/template mapping | ✅ |
| Mockup task creation | ✅ |
| Mockup task polling | ✅ |
| Error handling | ✅ |
| Rate-limit handling | ✅ |

### Files Created

```
src/lib/printful/errors.ts       PrintfulApiError class
src/lib/printful/types.ts        All typed interfaces
src/lib/printful/client.ts       printfulGet / printfulPost
src/lib/printful/catalog.ts      getCatalogProducts / getCatalogProduct / getCatalogVariants
src/lib/printful/templates.ts    getPrintfiles / getLayoutTemplates
src/lib/printful/mockups.ts      createMockupTask / getMockupTask
```

---

## Phase 2 — API Routes ✅ COMPLETE

### Routes

| Route | Method | Description |
|---|---|---|
| `/api/printful/products` | GET | Catalog product list |
| `/api/printful/products/[productId]` | GET | Single product + variants |
| `/api/printful/printfiles/[productId]` | GET | Print files + placements |
| `/api/printful/templates/[productId]` | GET | Layout templates (`?technique=&orientation=`) |
| `/api/printful/mockups` | POST | Create mockup generation task |
| `/api/printful/mockups/[taskKey]` | GET | Poll task status |
| `/api/printful/artwork-upload` | POST | Upload artwork to Supabase Storage |

### Files Created

```
src/app/api/printful/products/route.ts
src/app/api/printful/products/[productId]/route.ts
src/app/api/printful/printfiles/[productId]/route.ts
src/app/api/printful/templates/[productId]/route.ts
src/app/api/printful/mockups/route.ts
src/app/api/printful/mockups/[taskKey]/route.ts
src/app/api/printful/artwork-upload/route.ts
```

---

## Phase 3 — Product Designer Components ✅ COMPLETE

### Implemented

| Capability | Status |
|---|---|
| Product designer orchestrator | ✅ |
| Coordinate conversion utilities | ✅ |
| Artwork upload hook | ✅ |
| Product selector | ✅ |
| Variant selector | ✅ |
| Technique selector | ✅ |
| Placement selector + conflict guard | ✅ |
| Design canvas (drag + resize) | ✅ |
| Mockup status + polling | ✅ |
| Mockup preview | ✅ |

### Files Created

```
src/components/product-designer/coordinates.ts         canvasToPrintfulCoordinates / printfulToCanvasCoordinates / clampToPrintArea
src/components/product-designer/useArtworkUpload.ts    File validation + Supabase Storage upload hook
src/components/product-designer/ProductSelector.tsx
src/components/product-designer/VariantSelector.tsx
src/components/product-designer/TechniqueSelector.tsx
src/components/product-designer/PlacementSelector.tsx
src/components/product-designer/DesignCanvas.tsx
src/components/product-designer/MockupStatus.tsx
src/components/product-designer/MockupPreview.tsx
src/components/product-designer/ProductDesigner.tsx
```

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `PRINTFUL_API_TOKEN` | Yes | Server-only. Never `NEXT_PUBLIC_`. |
| `PRINTFUL_STORE_ID` | Optional | Attached as `X-PF-Store-Id` header when set. |
| `PRINTFUL_WEBHOOK_SECRET` | Optional | Used by existing webhook edge function. |

`.env.example` updated with Printful section.

---

## Build Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ PASS — 0 errors |
| `next lint` (new files only) | ✅ PASS — 0 errors, 0 warnings |
| `npm run build` | ✅ PASS — clean production build |

---

## Security Verification

| Check | Result |
|---|---|
| Token server-side only | ✅ PASS — `PRINTFUL_API_TOKEN` read only in `src/lib/printful/client.ts` (server) |
| No `NEXT_PUBLIC_PRINTFUL_*` | ✅ PASS — confirmed absent |
| Token absent from client bundle | ✅ PASS — no client component imports from `lib/printful/client.ts` |
| Product ID validation | ✅ PASS — `parseInt` + `isNaN` + `> 0` on all routes |
| Variant ID validation | ✅ PASS — array + non-empty check in mockups route |
| Technique validation | ✅ PASS — allowlist of 7 known techniques |
| Artwork URL validation | ✅ PASS — must start with `http` before forwarding to Printful |
| Error sanitization | ✅ PASS — `PrintfulApiError.clientMessage` returned; raw errors logged server-side only |
| No stack traces to client | ✅ PASS — all catch blocks return safe string messages |

---

## Phase 4 — Tests ✅ COMPLETE

| Check | Result |
|---|---|
| `npm run test` (vitest) | ✅ PASS — 38 tests across 14 suites |
| Test runner | Vitest 5.0.2 |
| Live API calls | None — all Printful calls mocked via `vi.stubGlobal('fetch', ...)` |

### Test file

```
src/__tests__/printful/printful.test.ts
```

### Test suites (14 required by spec)

| # | Suite | Tests | Result |
|---|---|---|---|
| 1 | Authorization header construction | 4 | ✅ |
| 2 | Product ID validation | 3 | ✅ |
| 3 | Variant ID validation | 3 | ✅ |
| 4 | Template response parsing | 2 | ✅ |
| 5 | Variant-to-template mapping | 3 | ✅ |
| 6 | Technique query construction | 4 | ✅ |
| 7 | Artwork coordinate conversion | 4 | ✅ |
| 8 | Create-task payload construction | 2 | ✅ |
| 9 | Pending task handling | 1 | ✅ |
| 10 | Completed task handling | 1 | ✅ |
| 11 | Failed task handling | 1 | ✅ |
| 12 | Rate-limit response handling | 4 | ✅ |
| 13 | Conflicting placements | 3 | ✅ |
| 14 | Malformed Printful response | 3 | ✅ |

---

## Remaining Work

| Phase | Description | Status |
|---|---|---|
| Phase 4 | Unit tests (14 cases, mocked Printful) | ✅ Done |
| Phase 5 | `persistGeneratedMockups()` — download + store completed mockups to Supabase | ✅ Done |
| Phase 5 | Mockup Generator v2 migration path | ✅ Done — see `Printful/V2-MIGRATION.md` |
| Phase 5 | Options/option_groups UI (mockup style selector) | ✅ Done |
| Phase 5 | Full `npm run build` verification | ✅ PASS |

---

## Usage

Drop `<ProductDesigner />` into any page:

```tsx
import ProductDesigner from "@/components/product-designer/ProductDesigner";

export default function DesignPage() {
  return <ProductDesigner />;
}
```

Requires `PRINTFUL_API_TOKEN` in `.env.local`.

---

## V1 vs V2 Note

Current implementation uses the stable v1 Mockup Generator API
(`/mockup-generator/templates`, `/mockup-generator/create-task`, `/mockup-generator/task`).

All Printful-specific logic is isolated behind `src/lib/printful/`.
The `ProductDesigner` UI does not call Printful directly.
Migrating to Mockup Generator v2 requires only changes to `mockups.ts` and `templates.ts` —
no component rewrites needed.
