# E2E Testing Guide

This application uses Playwright for end-to-end testing across the storefront, checkout, customer account pages, and admin dashboards. The tests live in `e2e/` and run against the Next 15 / React 19 app through `playwright.config.ts`.

## Test Files

- `e2e/app-smoke.spec.ts` checks core public routes, primary navigation, shop empty/populated states, and the optional affiliate route.
- `e2e/account.spec.ts` checks guest account access, protected account pages, login, signup, address, phone, and newsletter fields.
- `e2e/admin-dashboards.spec.ts` checks anonymous admin protection, the admin customers API, and credential-gated admin dashboard pages.
- `e2e/admin.spec.ts` checks the admin login page, invalid login behavior, and deeper authenticated admin flows when test credentials are configured.
- `e2e/storefront.spec.ts` checks homepage, newsletter signup, mobile menu, shop states, product detail, and cart flows.
- `e2e/checkout.spec.ts` checks empty checkout, checkout validation, totals, shipping, and item updates.
- `e2e/helpers.ts` contains shared helpers for admin sign-in, product-dependent skips, and basic app error checks.

## NPM Scripts

Run all configured Playwright projects:

```bash
npm run test:e2e
```

Open Playwright UI mode:

```bash
npm run test:e2e:ui
```

Open the last HTML report:

```bash
npm run test:e2e:report
```

List every discovered test without launching browsers:

```bash
npx playwright test --list
```

## Common Commands

Run the full Chromium suite:

```bash
npx playwright test --project=chromium
```

Run only smoke, account, and admin dashboard coverage:

```bash
npx playwright test e2e/app-smoke.spec.ts e2e/account.spec.ts e2e/admin-dashboards.spec.ts --project=chromium
```

Run a single spec:

```bash
npx playwright test e2e/storefront.spec.ts --project=chromium
```

Run with a visible browser:

```bash
npx playwright test e2e/storefront.spec.ts --project=chromium --headed
```

Run the mobile project after WebKit is installed:

```bash
npx playwright install webkit
npx playwright test --project=mobile
```

## Local Server Options

By default, Playwright starts the app with:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

The config supports these environment variables:

- `PLAYWRIGHT_PORT`: changes the port for the Playwright-managed Next dev server.
- `PLAYWRIGHT_BASE_URL`: points tests at a specific running app URL.
- `PLAYWRIGHT_SKIP_WEBSERVER=1`: prevents Playwright from starting its own server.

Use a different port when `3000` is busy:

```bash
PLAYWRIGHT_PORT=3005 npx playwright test --project=chromium
```

Use an already-running app:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3004
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3004 npx playwright test --project=chromium
```

## Credential-Gated Tests

Authenticated admin tests are intentionally skipped unless both credentials are provided:

```bash
TEST_ADMIN_EMAIL=admin@example.com TEST_ADMIN_PASSWORD='password' npx playwright test e2e/admin.spec.ts e2e/admin-dashboards.spec.ts --project=chromium
```

Without these variables, tests still verify:

- the admin login page renders
- invalid admin login behavior
- protected admin routes redirect to sign-in
- `/api/admin/customers` returns `401` anonymously

## Product-Dependent Tests

Some storefront and checkout tests need at least one active product. The helper `firstProductLinkOrSkip()` skips those tests when the catalog is empty, which keeps the suite useful after reset scripts wipe products.

Tests that do not require products still run against empty catalog states and verify the app renders correctly.

## Reports And Artifacts

Playwright writes reports and failed-test artifacts to:

- `playwright-report/`
- `test-results/`

These directories are ignored by Git. Use this command to view the report after a run:

```bash
npm run test:e2e:report
```

## Troubleshooting

If the server cannot bind to port `3000`, use `PLAYWRIGHT_PORT=3005` or another free port.

If a run hangs against `localhost:3000`, check whether another process is occupying that port and run against a known healthy server with `PLAYWRIGHT_BASE_URL`.

If the mobile project fails with a missing WebKit executable, install the browser:

```bash
npx playwright install webkit
```

If admin dashboard tests are skipped, provide `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD`.

If product or cart tests are skipped, seed or create at least one active product.
