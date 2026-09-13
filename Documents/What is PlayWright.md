# What is Playwright?

Playwright is an open-source browser automation framework made by Microsoft. It lets you write code that controls a real browser (Chrome, Firefox, Safari) to test your app the same way a real user would.

## What it does in plain terms

Instead of you manually clicking through your site to check everything works, Playwright does it for you automatically. You write a test like:

```ts
// "Go to the shop, click the first product, add it to cart"
await page.goto("/shop");
await page.locator("a[href^='/product/']").first().click();
await page.getByRole("button", { name: /add to cart/i }).click();
```

...and Playwright opens a real browser, does all those clicks, and tells you if anything broke.

## Why it matters for your site

- **Catches bugs before customers do**
- After every code change, run `npm run test:e2e` and it verifies the whole site still works — shop, cart, checkout, admin, Printify sync
- Takes **screenshots automatically** when something fails so you can see exactly what went wrong

The alternative is manually clicking through every page every time you make a change — which gets tedious fast.

> Think of it as a robot QA tester that never gets tired and runs in seconds.

---

## Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Config — runs against `localhost:3000`, Desktop + Mobile |
| `e2e/storefront.spec.ts` | Homepage, shop, product page, cart, mobile menu |
| `e2e/checkout.spec.ts` | Empty cart, form validation, real shipping quote, order summary |
| `e2e/admin.spec.ts` | Login, dashboard, products, orders, Printify sync, settings, sign out |
| `.env.test` | Admin credentials for tests (gitignored) |

---

## Test Coverage

### Storefront (`storefront.spec.ts`)
- Homepage loads with header and nav
- Shop page displays products
- Category filter updates URL
- Product detail page loads with Add to Cart button
- Cart drawer opens
- Adding a product updates the cart badge
- About page loads
- Mobile menu opens and navigates to shop

### Checkout (`checkout.spec.ts`)
- Empty cart shows empty state with Browse Products link
- Form validation blocks submission when fields are missing
- Fully filled form enables the Pay with Stripe button
- Real shipping quote calculates and displays in order summary
- Changing country triggers a new shipping quote
- Order summary shows subtotal and total

### Admin (`admin.spec.ts`)

**Auth**
- Login page loads
- Invalid credentials show error
- Sign out returns to login

**Dashboard**
- All 4 stat cards visible (Revenue, Orders, Pending, Products)
- Quick action links present (Manage Products, View Orders, Store Settings)

**Products**
- Active / Inactive tabs render with counts
- Inactive tab shows Activate button (or "all active" message)
- Sync Printify button present and shows feedback message
- Search filters active products
- Add Product modal opens with title and price fields
- Creating a product saves and appears in the Active tab

**Orders**
- Status filter dropdown present
- Filtering by status shows results or empty state
- Order detail modal opens with shipping address

**Settings**
- Printify Shop ID field present
- Integration status badges shown for Stripe, MailerLite, Resend, Printify
- Social media section with Save Social Links button
- Save Settings shows saved confirmation
- Save Social Links shows saved confirmation

---

## Running the Tests

Before running, update `.env.test` with your real admin password.

```bash
# 1. Start the dev server
npm run dev

# 2. In a separate terminal — always use Node 20
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

# 3. Run all tests (headless)
npm run test:e2e

# 4. Run with interactive UI
npm run test:e2e:ui

# 5. View the HTML report after a run
npm run test:e2e:report
```
