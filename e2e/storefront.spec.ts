import { test, expect } from "@playwright/test";

test.describe("Storefront", () => {
  test("homepage loads with hero and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible();
  });

  test("shop page displays products", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.locator("a[href^='/product/']").first()).toBeVisible({ timeout: 10000 });
  });

  test("shop category filter works", async ({ page }) => {
    await page.goto("/shop");
    const categoryLink = page.getByRole("link", { name: /t-shirts/i }).first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await expect(page).toHaveURL(/category=t-shirts/);
    }
  });

  test("product detail page loads", async ({ page }) => {
    await page.goto("/shop");
    const firstProduct = page.locator("a[href^='/product/']").first();
    await firstProduct.waitFor({ timeout: 10000 });
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });

  test("cart drawer opens", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: /open cart/i }).click();
    await expect(page.getByText(/your cart/i)).toBeVisible();
  });

  test("add product to cart updates badge", async ({ page }) => {
    await page.goto("/shop");
    const firstProduct = page.locator("a[href^='/product/']").first();
    await firstProduct.waitFor({ timeout: 10000 });
    await firstProduct.click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.locator("header").getByText("1")).toBeVisible({ timeout: 5000 });
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveURL("/about");
    await expect(page.locator("main, body")).toBeVisible();
  });

  test("mobile menu opens and navigates to shop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByRole("link", { name: /all products/i })).toBeVisible();
    await page.getByRole("link", { name: /all products/i }).click();
    await expect(page).toHaveURL("/shop");
  });
});
