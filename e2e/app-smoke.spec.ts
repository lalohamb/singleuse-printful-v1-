import { expect, test } from "@playwright/test";
import { expectNoAppError } from "./helpers";

const publicRoutes = [
  { path: "/", label: "home" },
  { path: "/shop", label: "shop" },
  { path: "/about", label: "about" },
  { path: "/privacy-policy", label: "privacy policy" },
  { path: "/refund-policy", label: "refund policy" },
  { path: "/terms-of-service", label: "terms of service" },
  { path: "/checkout", label: "checkout" },
  { path: "/checkout/success", label: "checkout success" },
  { path: "/account", label: "customer account" },
  { path: "/account/login", label: "account login" },
  { path: "/account/signup", label: "account signup" },
];

test.describe("Application smoke", () => {
  for (const route of publicRoutes) {
    test(`${route.label} route renders`, async ({ page }) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expectNoAppError(page);
    });
  }

  test("homepage exposes primary storefront navigation", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("link", { name: /all products/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /about/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /account|my account/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /open cart/i })).toBeVisible();
  });

  test("shop handles both empty and populated catalogs", async ({ page }) => {
    await page.goto("/shop", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /all products/i })).toBeVisible();
    await expect(page.getByText(/sort by/i)).toBeVisible();
    await expect(
      page.locator("a[href^='/product/']").first().or(page.getByText(/no products found/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("affiliate program is either available or intentionally disabled", async ({ page }) => {
    const response = await page.goto("/affiliates", { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 200;
    expect([200, 404]).toContain(status);
    if (status === 200) {
      await expect(page.getByRole("link", { name: /apply now/i }).first()).toBeVisible();
    }
  });
});
