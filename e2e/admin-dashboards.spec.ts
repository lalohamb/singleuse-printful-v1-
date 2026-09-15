import { expect, test } from "@playwright/test";
import { expectNoAppError, hasAdminCredentials, signInAdmin } from "./helpers";

const protectedAdminRoutes = [
  "/admin/dashboard",
  "/admin/products",
  "/admin/categories",
  "/admin/orders",
  "/admin/customers",
  "/admin/email",
  "/admin/stripe",
  "/admin/mailerlite",
  "/admin/affiliates",
  "/admin/affiliates/payouts",
  "/admin/seo",
  "/admin/shipping",
  "/admin/media",
  "/admin/policies",
  "/admin/settings/store-information",
  "/admin/settings/integrations",
  "/admin/settings/newsletter-popup",
  "/admin/danger",
];

const authenticatedAdminPages = [
  { path: "/admin/dashboard", marker: /total revenue|orders are/i },
  { path: "/admin/products", marker: /sync printify|add product/i },
  { path: "/admin/categories", marker: /categories|search products/i },
  { path: "/admin/orders", marker: /all status|how orders work/i },
  { path: "/admin/customers", marker: /account creators|customer accounts|customers/i },
  { path: "/admin/email", marker: /send email|broadcast/i },
  { path: "/admin/stripe", marker: /stripe|payments/i },
  { path: "/admin/mailerlite", marker: /mailerlite|subscribers/i },
  { path: "/admin/affiliates", marker: /affiliate/i },
  { path: "/admin/affiliates/payouts", marker: /payout/i },
  { path: "/admin/seo", marker: /production url|seo/i },
  { path: "/admin/shipping", marker: /shipping/i },
  { path: "/admin/media", marker: /media|search files/i },
  { path: "/admin/policies", marker: /privacy|refund|terms/i },
  { path: "/admin/settings/store-information", marker: /store name|store information/i },
  { path: "/admin/settings/integrations", marker: /printify shop id|integrations/i },
  { path: "/admin/settings/newsletter-popup", marker: /newsletter/i },
  { path: "/admin/danger", marker: /danger/i },
];

test.describe("Admin protection", () => {
  test("admin customers API rejects anonymous users", async ({ request }) => {
    const response = await request.get("/api/admin/customers");
    expect(response.status()).toBe(401);
  });

  for (const route of protectedAdminRoutes) {
    test(`${route} requires admin sign-in`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/admin$/, { timeout: 8000 }).catch(() => undefined);
      await expect(page.getByPlaceholder(/admin@genderapparel|email/i)).toBeVisible({ timeout: 8000 });
    });
  }
});

test.describe("Admin dashboards", () => {
  test.skip(!hasAdminCredentials, "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run authenticated admin dashboard E2E tests.");

  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("sidebar exposes all major admin sections", async ({ page }) => {
    for (const label of [
      "Dashboard",
      "Products",
      "Categories",
      "Orders - Printify",
      "Customers",
      "Email - Resend",
      "Stripe - Payments",
      "MailerLite",
      "Affiliates",
      "Affiliate Payouts",
      "SEO",
      "Shipping",
      "Media",
      "Policies",
    ]) {
      await expect(page.getByRole("link", { name: new RegExp(label, "i") })).toBeVisible();
    }
  });

  test("all admin dashboard pages render after login", async ({ page }) => {
    for (const adminPage of authenticatedAdminPages) {
      await page.goto(adminPage.path);
      await expect(page.locator("body")).toContainText(adminPage.marker, { timeout: 15000 });
      await expectNoAppError(page);
    }
  });
});
