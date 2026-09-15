import { expect, type Page, test } from "@playwright/test";

export const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL;
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
export const hasAdminCredentials = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

export async function signInAdmin(page: Page) {
  test.skip(!hasAdminCredentials, "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run authenticated admin E2E tests.");

  await page.goto("/admin");
  await page.locator("input[type='email']").fill(ADMIN_EMAIL!);
  await page.locator("input[type='password']").fill(ADMIN_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
}

export async function firstProductLinkOrSkip(page: Page) {
  await page.goto("/shop");
  const productLink = page.locator("a[href^='/product/']").first();
  const hasProduct = await productLink.isVisible({ timeout: 10000 }).catch(() => false);
  test.skip(!hasProduct, "No active products are available in the test database.");
  return productLink;
}

export async function expectNoAppError(page: Page) {
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText(/application error|runtime error|unhandled/i)).toHaveCount(0);
}
