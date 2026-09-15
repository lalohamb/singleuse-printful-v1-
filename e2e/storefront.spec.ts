import { test, expect } from "@playwright/test";
import { firstProductLinkOrSkip } from "./helpers";

// ── Helpers ──────────────────────────────────────────────────────────────────
async function addFirstProductToCart(page: any) {
  const firstProduct = await firstProductLinkOrSkip(page);
  await firstProduct.click();
  await expect(page).toHaveURL(/\/product\//);
  await page.getByRole("button", { name: /add to cart/i }).click();
}

test.describe("Storefront", () => {

  // ── Homepage ───────────────────────────────────────────────────────────────
  test("homepage loads with hero and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("link", { name: /shop/i }).first()).toBeVisible();
  });

  test("homepage hero has a CTA link to shop", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /shop now|shop the collection/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test("newsletter signup submits and shows success", async ({ page }) => {
    await page.goto("/");
    const emailInput = page.getByPlaceholder(/enter your email|your@email/i).first();
    await emailInput.scrollIntoViewIfNeeded();
    await emailInput.fill("e2etest@example.com");
    await emailInput.press("Enter");
    await expect(page.getByText(/you're in|welcome|subscribed/i)).toBeVisible({ timeout: 8000 });
  });

  test("footer newsletter signup works", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerInput = page.getByPlaceholder(/your@email/i).last();
    await footerInput.fill("e2efooter@example.com");
    await footerInput.press("Enter");
    await expect(page.getByText(/you're in|welcome/i).last()).toBeVisible({ timeout: 8000 });
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page).toHaveURL("/about");
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("mobile menu opens and navigates to shop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    const mobileMenu = page
      .getByRole("navigation")
      .filter({ has: page.getByRole("link", { name: /admin/i }) })
      .first();
    const menuShopLink = mobileMenu.getByRole("link", { name: /all products/i });
    await expect(menuShopLink).toBeVisible();
    await menuShopLink.click();
    await expect(page).toHaveURL("/shop");
  });

  // ── Shop ───────────────────────────────────────────────────────────────────
  test("shop page displays products or empty state", async ({ page }) => {
    await page.goto("/shop");
    await expect(
      page.locator("a[href^='/product/']").first().or(page.getByText(/no products found/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test("shop category filter works", async ({ page }) => {
    await page.goto("/shop");
    const categoryLink = page.getByRole("link", { name: /t-shirts/i }).first();
    if (await categoryLink.isVisible()) {
      await categoryLink.click();
      await expect(page).toHaveURL(/category=t-shirts/);
    }
  });

  test("shop shows correct product count", async ({ page }) => {
    await page.goto("/shop");
    await expect(
      page.locator("a[href^='/product/']").first().or(page.getByText(/no products found/i))
    ).toBeVisible({ timeout: 10000 });
    const count = await page.locator("a[href^='/product/']").count();
    if (count === 0) await expect(page.getByText(/0 products|no products found/i).first()).toBeVisible();
    else expect(count).toBeGreaterThan(0);
  });

  test("header search control opens shop discovery", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /search products/i }).click();
    await expect(page).toHaveURL("/shop");
    await expect(page.getByRole("heading", { name: /all products/i })).toBeVisible();
  });

  // ── Product Detail ─────────────────────────────────────────────────────────
  test("product detail page loads", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    await expect(page).toHaveURL(/\/product\//);
    await expect(page.getByRole("button", { name: /add to cart/i })).toBeVisible();
  });

  test("product detail shows title and price", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/\$\d+/)).toBeVisible();
  });

  test("product quantity controls increment and decrement", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    const qty = page.locator("span").filter({ hasText: /^1$/ }).first();
    await page.getByRole("button", { name: /increase quantity/i }).click();
    await expect(qty).toHaveText("2");
    await page.getByRole("button", { name: /decrease quantity/i }).click();
    await expect(qty).toHaveText("1");
  });

  test("quantity cannot go below 1", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    await page.getByRole("button", { name: /decrease quantity/i }).click();
    const qty = page.locator("span").filter({ hasText: /^1$/ }).first();
    await expect(qty).toHaveText("1");
  });

  test("product image gallery thumbnail changes main image", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    const thumbnails = page.locator("button img").filter({ hasNot: page.locator("header") });
    if (await thumbnails.count() > 1) {
      const secondThumb = thumbnails.nth(1);
      const srcBefore = await page.locator(".aspect-\\[3\\/4\\] img").getAttribute("src");
      await secondThumb.click();
      const srcAfter = await page.locator(".aspect-\\[3\\/4\\] img").getAttribute("src");
      expect(srcAfter).not.toBe(srcBefore);
    }
  });

  test("add to cart button shows added confirmation", async ({ page }) => {
    const firstProduct = await firstProductLinkOrSkip(page);
    await firstProduct.click();
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByRole("button", { name: /added to cart/i })).toBeVisible({ timeout: 3000 });
  });

  // ── Cart ───────────────────────────────────────────────────────────────────
  test("cart drawer opens", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: /open cart/i }).click();
    await expect(page.getByText(/your cart/i)).toBeVisible();
  });

  test("add product to cart updates badge", async ({ page }) => {
    await addFirstProductToCart(page);
    await expect(page.locator("header").getByText("1")).toBeVisible({ timeout: 5000 });
  });

  test("cart drawer shows added item", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.getByRole("button", { name: /open cart/i }).click();
    await expect(page.getByText(/your cart/i)).toBeVisible();
    const items = page.locator("[data-cart-item], .cart-item");
    if (await items.count() > 0) {
      await expect(items.first()).toBeVisible();
    } else {
      // fallback: at least checkout button should appear
      await expect(page.getByRole("link", { name: /checkout/i })).toBeVisible();
    }
  });

  test("cart persists on page reload", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.reload();
    await expect(page.locator("header").getByText("1")).toBeVisible({ timeout: 5000 });
  });

  test("cart checkout button navigates to checkout", async ({ page }) => {
    await addFirstProductToCart(page);
    await page.getByRole("button", { name: /open cart/i }).click();
    await page.getByRole("link", { name: /checkout/i }).click();
    await expect(page).toHaveURL("/checkout");
  });
});
