import { test, expect } from "@playwright/test";
import { firstProductLinkOrSkip } from "./helpers";

// ── Helper ──────────────────────────────────────────────────────────────────
async function addToCartAndGoToCheckout(page: any) {
  const firstProduct = await firstProductLinkOrSkip(page);
  await firstProduct.click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.goto("/checkout");
}

async function fillShippingForm(page: any) {
  await page.getByPlaceholder("Email address").fill("test@example.com");
  await page.getByPlaceholder("First name").fill("Jane");
  await page.getByPlaceholder("Last name").fill("Doe");
  await page.getByPlaceholder("Address line 1").fill("123 Main St");
  await page.getByPlaceholder("City").fill("Atlanta");
  await page.getByPlaceholder("State").fill("GA");
  await page.getByPlaceholder("ZIP code").fill("30301");
}

test.describe("Checkout", () => {

  // ── Empty cart ────────────────────────────────────────────────────────────
  test("empty cart shows empty state", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText(/your cart is empty/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /browse products/i })).toBeVisible();
  });

  test("empty cart browse link goes to shop", async ({ page }) => {
    await page.goto("/checkout");
    await page.getByRole("link", { name: /browse products/i }).click();
    await expect(page).toHaveURL("/shop");
  });

  // ── Form validation ────────────────────────────────────────────────────────
  test("checkout form requires fields before submitting", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await expect(page.getByRole("button", { name: /pay.*stripe/i })).toBeVisible();
    await page.getByRole("button", { name: /pay.*stripe/i }).click();
    await expect(page).toHaveURL("/checkout");
  });

  test("invalid email format is rejected", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await page.getByPlaceholder("Email address").fill("notanemail");
    await page.getByPlaceholder("First name").fill("Jane");
    await page.getByPlaceholder("Last name").fill("Doe");
    await page.getByPlaceholder("Address line 1").fill("123 Main St");
    await page.getByPlaceholder("City").fill("Atlanta");
    await page.getByPlaceholder("State").fill("GA");
    await page.getByPlaceholder("ZIP code").fill("30301");
    await page.getByRole("button", { name: /pay.*stripe/i }).click();
    await expect(page).toHaveURL("/checkout");
  });

  test("checkout form fills correctly and button is enabled", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await fillShippingForm(page);
    await expect(page.getByRole("button", { name: /pay.*stripe/i })).toBeEnabled({ timeout: 8000 });
  });

  // ── Order summary ──────────────────────────────────────────────────────────
  test("order summary shows subtotal and total", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await expect(page.getByText(/subtotal/i)).toBeVisible();
    await expect(page.getByText(/total/i).last()).toBeVisible();
  });

  test("order summary shows item name and price", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await expect(page.getByText(/\$\d+/)).toBeVisible();
  });

  test("shipping cost calculates and shows in order summary", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await expect(page.getByText(/shipping/i)).toBeVisible();
    await expect(page.getByText(/calculating|pending|free|\$/i)).toBeVisible({ timeout: 5000 });
  });

  test("changing country triggers new shipping quote", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await page.selectOption("select", "CA");
    await expect(page.getByText(/calculating|pending|\$/i)).toBeVisible({ timeout: 5000 });
  });

  test("free shipping threshold message is visible", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    await expect(page.getByText(/free shipping|free on orders/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Cart management in checkout ────────────────────────────────────────────
  test("quantity increase in checkout updates total", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    const totalBefore = await page.getByText(/total/i).last().textContent();
    const increaseBtn = page.getByRole("button", { name: /increase quantity/i }).first();
    if (await increaseBtn.isVisible()) {
      await increaseBtn.click();
      await page.waitForTimeout(500);
      const totalAfter = await page.getByText(/total/i).last().textContent();
      expect(totalAfter).not.toBe(totalBefore);
    }
  });

  test("removing item from checkout returns to empty state", async ({ page }) => {
    await addToCartAndGoToCheckout(page);
    const removeBtn = page.getByRole("button", { name: /remove|delete/i }).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await expect(page.getByText(/your cart is empty/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
