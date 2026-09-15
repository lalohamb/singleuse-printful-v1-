# What Changed - E2E - 2026-09-15

This note documents the latest E2E implementation added for the Next 15 / React 19 storefront and admin application.

## Summary

The E2E suite now covers the major customer, storefront, checkout, and admin surfaces with Playwright. The tests are designed to work in both seeded and reset database states, and deeper admin dashboard tests are gated behind explicit test credentials.

## New Coverage

- Added customer account tests in `e2e/account.spec.ts`.
- Added broad application smoke tests in `e2e/app-smoke.spec.ts`.
- Added admin protection and dashboard tests in `e2e/admin-dashboards.spec.ts`.
- Added shared helpers in `e2e/helpers.ts`.

## Updated Coverage

- Updated `e2e/admin.spec.ts` to use the current admin login form selectors.
- Updated `e2e/storefront.spec.ts` to handle empty catalogs, current mobile navigation, and the current header search behavior.
- Updated `e2e/checkout.spec.ts` so product-backed checkout cases skip clearly when no active products exist.

## Playwright Config Updates

`playwright.config.ts` now supports:

- `PLAYWRIGHT_PORT`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_SKIP_WEBSERVER`

This makes it easier to run E2E tests when port `3000` is busy or when testing against an already-running local server.

## Skip Behavior

Authenticated admin tests skip unless both variables are set:

```bash
TEST_ADMIN_EMAIL=admin@example.com
TEST_ADMIN_PASSWORD=password
```

Product-dependent storefront and checkout tests skip when no active product is available in `/shop`.

## Verification From This Implementation

The latest local validation included:

- `npx tsc --noEmit --pretty false` passed.
- `npm run lint` passed with existing warnings.
- `npx playwright test --list` passed and found 190 tests across 6 files.
- Full Chromium E2E passed with 55 passed and 40 skipped.
- Admin-focused Chromium rerun passed with 21 passed and 20 skipped.

The mobile project could not be fully verified because the local Playwright WebKit browser was not installed. Install it with:

```bash
npx playwright install webkit
```

Then run:

```bash
npx playwright test --project=mobile
```

## Changed Files In The E2E Implementation

- `.gitignore`
- `playwright.config.ts`
- `e2e/helpers.ts`
- `e2e/app-smoke.spec.ts`
- `e2e/account.spec.ts`
- `e2e/admin-dashboards.spec.ts`
- `e2e/admin.spec.ts`
- `e2e/storefront.spec.ts`
- `e2e/checkout.spec.ts`

Related reset-script and SQL files were already updated separately to support the account/customer work:

- `scripts/reset.sh`
- `supabase/reset.sql`
- `supabase/sql/02_reset.sql`
