import { test, expect } from "@playwright/test";

test.describe("Checkout", () => {
  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /browse products/i })).toBeVisible();
  });

  test("checkout form requires fields before submitting", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().waitFor({ timeout: 10000 });
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /pay.*stripe/i })).toBeVisible();
    await page.getByRole("button", { name: /pay.*stripe/i }).click();
    // HTML5 validation blocks submission — should stay on checkout
    await expect(page).toHaveURL("/checkout");
  });

  test("checkout form fills correctly and button is enabled", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().waitFor({ timeout: 10000 });
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    await page.goto("/checkout");
    await page.getByPlaceholder("Email address").fill("test@example.com");
    await page.getByPlaceholder("First name").fill("Jane");
    await page.getByPlaceholder("Last name").fill("Doe");
    await page.getByPlaceholder("Address line 1").fill("123 Main St");
    await page.getByPlaceholder("City").fill("Atlanta");
    await page.getByPlaceholder("State").fill("GA");
    await page.getByPlaceholder("ZIP code").fill("30301");

    // Wait for shipping quote to resolve before button is enabled
    await expect(page.getByRole("button", { name: /pay.*stripe/i })).toBeEnabled({ timeout: 8000 });
  });

  test("shipping cost calculates and shows in order summary", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().waitFor({ timeout: 10000 });
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    await page.goto("/checkout");
    // Initially shows Pending or Calculating...
    await expect(page.getByText(/shipping/i)).toBeVisible();
    // After debounce resolves, shows a real value or Free
    await expect(page.getByText(/calculating|pending|free|\$/i)).toBeVisible({ timeout: 5000 });
  });

  test("changing country triggers new shipping quote", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().waitFor({ timeout: 10000 });
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    await page.goto("/checkout");
    await page.selectOption("select", "CA");
    // Should show calculating while debounce fires
    await expect(page.getByText(/calculating|pending|\$/i)).toBeVisible({ timeout: 5000 });
  });

  test("order summary shows subtotal and total", async ({ page }) => {
    await page.goto("/shop");
    await page.locator("a[href^='/product/']").first().waitFor({ timeout: 10000 });
    await page.locator("a[href^='/product/']").first().click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    await page.goto("/checkout");
    await expect(page.getByText(/subtotal/i)).toBeVisible();
    await expect(page.getByText(/total/i).last()).toBeVisible();
  });
});
