# ARCHITECTURE AUDIT

Generated: 2025-07-10
Framework: Next.js 15.5.25 — App Router — TypeScript strict

---

## 1. SYSTEM MAP

```
Browser
  └── Next.js App (src/)
        ├── Storefront pages       /shop, /product/[id], /checkout, /track, /account/*
        ├── Admin pages            /admin/*
        ├── Affiliate pages        /affiliates/*
        ├── API routes             /api/*
        └── Product Designer       /components/product-designer/

Next.js API routes
  ├── /api/printful/*            Printful Catalog + Mockup Generator (new)
  ├── /api/stripe-*              Stripe key management + mode switching
  ├── /api/upload                Admin media upload
  ├── /api/resend                Resend email proxy
  ├── /api/mailerlite            MailerLite proxy
  └── /api/affiliates/*          Affiliate tracking + payouts

Supabase Edge Functions
  ├── printful-proxy             Store sync, order creation, shipping rates
  ├── printful-webhook           Shipment + fulfillment events
  ├── stripe-checkout            Checkout session creation
  └── stripe-webhook             Payment confirmation + order creation

External Services
  ├── Printful                   Print-on-demand fulfillment
  ├── Stripe                     Payments
  ├── Supabase                   PostgreSQL + Auth + Storage + Edge Functions
  ├── Resend                     Transactional email
  └── MailerLite                 Email marketing
```

---

## 2. DATA FLOW

### Purchase flow
```
Customer → /checkout
  → CartProvider (localStorage)
  → createStripeCheckout() in lib/supabase.ts
  → supabase/functions/stripe-checkout (Edge Function)
  → Stripe Checkout Session
  → /checkout/success
  → supabase/functions/stripe-webhook
      → creates order in DB
      → calls printful-proxy /orders
      → Printful fulfillment
  → supabase/functions/printful-webhook
      → updates order tracking/status
      → sends shipping email via Resend
```

### Product sync flow
```
Admin → /admin/settings (Integrations)
  → validates store ID via printful-proxy/stores
  → triggers sync via printful-proxy POST /sync
      → fetches all store products from Printful
      → upserts into products table
      → deletes removed products
```

### Product designer flow (new)
```
User → ProductDesigner component
  → /api/printful/products          (catalog)
  → /api/printful/products/[id]     (variants)
  → /api/printful/printfiles/[id]   (placements, options)
  → /api/printful/templates/[id]    (layout geometry)
  → /api/printful/artwork-upload    (Supabase Storage)
  → /api/printful/mockups           (create task)
  → /api/printful/mockups/[taskKey] (poll)
  → /api/printful/mockups/persist   (store permanently)
```

---

## 3. LAYER RESPONSIBILITIES

| Layer | Location | Responsibility |
|---|---|---|
| Pages | `src/app/*/page.tsx` | Server components, data fetching, layout |
| Client components | `src/app/*/components/`, `src/components/` | UI, interactivity |
| API routes | `src/app/api/*/route.ts` | Input validation, auth, service calls |
| Lib | `src/lib/` | Business logic, service clients, utilities |
| Edge functions | `supabase/functions/` | Privileged server ops (Deno runtime) |
| Types | `src/types.ts` | Shared application types |

---

## 4. AUTHENTICATION ARCHITECTURE

Two separate auth systems coexist:

### Admin auth (`src/lib/require-admin.ts`)
- Reads Supabase session from cookie or `Authorization: Bearer` header
- Validates JWT via service role client (cannot be spoofed)
- Checks `admins` table for membership
- Returns `NextResponse | null` — used as a guard at the top of API routes
- **Gap:** `artwork-upload` and all `printful/*` API routes do NOT call `requireAdmin()`. Anyone with network access can upload artwork or query the Printful catalog. See Section 7.

### Customer auth (`src/lib/customer-auth.tsx`)
- Supabase Auth with cookie-based session persistence
- Custom chunked-cookie storage to handle large JWTs
- Used for `/account/*` pages

### Admin UI auth (`src/lib/admin-auth.tsx`)
- `ProtectedAdmin` component wraps all `/admin/*` pages
- Client-side check — server-side `requireAdmin()` is the real enforcement

---

## 5. DATABASE ARCHITECTURE

All data lives in Supabase PostgreSQL. Key tables:

| Table | Purpose |
|---|---|
| `products` | Synced from Printful. `printful_id` is the sync key. |
| `orders` | Created by stripe-webhook. Linked to Printful via `printful_order_id`. |
| `settings` | Single-row store configuration. Stripe keys stored here (encrypted at rest by Supabase). |
| `admins` | Admin user IDs. Checked by `requireAdmin()`. |
| `categories` | Product categories with gradient/image support. |
| `customer_profiles` | Extended customer data beyond Supabase Auth. |
| `affiliates` | Affiliate accounts, codes, commissions. |
| `email_events` | Resend webhook events for tracking. |

**Gap:** No `mockup_tasks` or `persisted_mockups` table. The `persistGeneratedMockups()` function stores files to Supabase Storage but does not record metadata in the DB. If you want to associate mockups with products or orders, a migration is needed.

---

## 6. STORAGE ARCHITECTURE

Single Supabase Storage bucket: `store-images`

| Folder | Contents | Uploaded by |
|---|---|---|
| `uploads/` | Admin media (hero, story, logo images) | `/api/upload` (admin-only) |
| `artwork/` | Customer artwork for mockup generation | `/api/printful/artwork-upload` (unauthenticated) |
| `mockups/` | Persisted completed mockup images | `/api/printful/mockups/persist` |

**Gap:** `artwork/` folder is publicly writable by anyone. No cleanup mechanism exists for abandoned artwork uploads (files uploaded but mockup never generated).

---

## 7. SECURITY FINDINGS

### HIGH — Printful API routes are unauthenticated

All routes under `/api/printful/` have no auth guard. This means:

- Any user can query your full Printful catalog (`/api/printful/products`)
- Any user can create mockup generation tasks (costs Printful API quota)
- Any user can upload files to your Supabase Storage bucket

**Fix:** Add `requireAdmin()` to mutation routes at minimum. For the product designer, decide whether it is admin-only or customer-facing, then apply the appropriate guard.

Affected routes:
```
src/app/api/printful/mockups/route.ts          POST — create task
src/app/api/printful/mockups/persist/route.ts  POST — persist mockups
src/app/api/printful/artwork-upload/route.ts   POST — upload files
```

Read routes (`GET /products`, `GET /templates`, etc.) are lower risk but still expose your Printful catalog structure.

### MEDIUM — Artwork upload has no rate limiting

`/api/printful/artwork-upload` accepts 50 MB files with no rate limit, no authentication, and no cleanup. A bad actor could fill your Supabase Storage bucket.

**Fix:** Add auth guard or at minimum a per-IP rate limit. Add a cleanup job for orphaned artwork files older than 24 hours.

### MEDIUM — `supabase.ts` is marked `"use client"` but contains server logic

`src/lib/supabase.ts` has `"use client"` at the top but exports `getShippingQuote()` and `createStripeCheckout()` which are called from client components. `createStripeCheckout()` uses `window` directly. This works but means the Supabase anon key is visible in the browser bundle — which is expected and acceptable for the anon key, but the pattern conflates client and server concerns.

**Note:** `SUPABASE_SERVICE_ROLE_KEY` is never in this file. The anon key exposure is by design.

### LOW — `debug-auth` route exists in production

`src/app/api/debug-auth/route.ts` is present. Verify it does not expose session data or user information in production.

### LOW — `.env.local` contains real credentials committed to the workspace

The `.env.local` file visible in the workspace contains live `PRINTFUL_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Ensure this file is in `.gitignore` and never pushed to a remote repository.

---

## 8. DUAL PRINTFUL INTEGRATION — OVERLAP ANALYSIS

There are now two separate Printful integration layers. They serve different purposes and should NOT be merged, but the overlap must be understood.

| Concern | Edge Function (`printful-proxy`) | Next.js API (`/api/printful/`) |
|---|---|---|
| Runtime | Deno (Supabase Edge) | Node.js (Next.js) |
| Auth | Supabase anon key (caller) | None currently |
| Token source | `Deno.env.PRINTFUL_API_TOKEN` | `process.env.PRINTFUL_API_TOKEN` |
| Products | Store products (`/store/products`) | Catalog products (`/products`) |
| Sync | Full DB upsert + delete | Not applicable |
| Orders | Creates Printful orders | Not applicable |
| Shipping | Rates calculation | Not applicable |
| Mockups | Not applicable | Full mockup generator |
| Templates | Not applicable | Layout templates |

**These are different APIs.** The edge function uses `/store/products` (your synced store products). The Next.js routes use `/products` (the full Printful catalog). They are complementary, not duplicates.

**Potential confusion point:** The admin Integrations page calls `printful-proxy/stores` to validate the store ID. The product designer calls `/api/printful/products` for the catalog. A developer unfamiliar with the codebase may not realize these are different endpoints serving different purposes.

**Recommendation:** Add a comment to both entry points documenting this distinction.

---

## 9. STRIPE ARCHITECTURE

Stripe keys are stored in the `settings` DB table (not env vars), enabling live/test mode switching from the admin panel without redeployment. This is a deliberate design choice.

Flow:
```
Admin sets keys → /admin/stripe → /api/stripe-setup → settings table
Mode switch → /api/stripe-switch → settings.stripe_mode
Checkout → stripe-checkout edge function → reads settings table → uses correct key
```

**Note:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in `.env.local` appear to be empty. The live keys are in the DB. The env vars are fallbacks only.

---

## 10. AFFILIATE SYSTEM

A complete affiliate system exists:

- Affiliates sign up at `/affiliates/signup`
- Tracking cookie set via `/api/affiliates/track`
- `AffiliateTracker` component reads cookie and sets `window.__affiliateCode`
- `createStripeCheckout()` passes `affiliate_code` to the edge function
- `stripe-webhook` records the conversion
- Admin manages payouts at `/admin/affiliates/payouts`

**Gap:** Affiliate commission is recorded but there is no automated payout mechanism. Payouts appear to be manual.

---

## 11. SETTINGS ARCHITECTURE

All store configuration lives in a single `settings` row. Settings are loaded client-side via `useSettings()` hook in admin sections. The pattern is:

```
useSettings() → fetch /api/seo or direct Supabase query
  → local form state
  → SaveBar component
  → save() → Supabase update
```

This works but means every admin settings section independently fetches the full settings row. There is no shared settings context across admin sections.

---

## 12. MISSING PIECES / RECOMMENDED NEXT STEPS

| Priority | Item | Notes |
|---|---|---|
| HIGH | Auth guard on Printful mutation routes | `requireAdmin()` on POST routes at minimum |
| HIGH | Auth guard or rate limit on artwork-upload | Prevent storage abuse |
| MEDIUM | `mockup_tasks` DB table | Track task keys, status, associated product/user |
| MEDIUM | `persisted_mockups` DB table | Associate stored mockup URLs with products |
| MEDIUM | Artwork cleanup job | Delete orphaned `artwork/` files older than 24h |
| MEDIUM | Product designer page | No page exists at a route yet — `ProductDesigner` component is built but not placed |
| LOW | Remove or protect `debug-auth` route | Verify it is safe in production |
| LOW | Settings context | Share loaded settings across admin sections instead of re-fetching |
| LOW | Affiliate payout automation | Currently manual |
| LOW | `supabase.ts` split | Separate client-only and shared utilities |

---

## 13. WHAT IS SOLID

- Clean separation between Edge Functions (privileged, Deno) and Next.js API routes (Node.js)
- Stripe mode switching without redeployment is well-designed
- `requireAdmin()` is a clean, reusable server-side guard
- Cart is fully client-side with localStorage persistence — no server round-trips
- Printful lib layer (`src/lib/printful/`) is properly isolated — no Printful logic leaks into components
- Coordinate conversion utilities are pure functions, independently testable
- 38 unit tests covering all critical Printful integration paths
- TypeScript strict mode enforced throughout
- No `any` in new code except one documented Supabase generic workaround
