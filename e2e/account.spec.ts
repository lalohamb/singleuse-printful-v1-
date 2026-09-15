import { expect, test } from "@playwright/test";
import { expectNoAppError } from "./helpers";

test.describe("Customer account", () => {
  test("signed-out dashboard prompts for account access", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText(/guest account/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /sign in to view your account/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create account/i })).toBeVisible();
    await expectNoAppError(page);
  });

  for (const route of ["/account/orders", "/account/profile", "/account/addresses", "/account/preferences"]) {
    test(`${route} is auth-gated for guests`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /create account/i })).toBeVisible();
      await expectNoAppError(page);
    });
  }

  test("login form uses magic-link email flow", async ({ page }) => {
    await page.goto("/account/login");
    await expect(page.getByRole("heading", { name: /sign in to your account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/jordan\.taylor@example\.com/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send sign-in link/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create an account/i })).toBeVisible();
  });

  test("signup form captures profile, address, and newsletter preferences", async ({ page }) => {
    await page.goto("/account/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expect(page.getByPlaceholder(/jordan\.taylor@example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/jordanstyle/i)).toBeVisible();
    await expect(page.getByPlaceholder(/555-0148/i)).toBeVisible();
    await expect(page.getByPlaceholder(/jordan taylor/i)).toBeVisible();
    await expect(page.getByText(/default shipping address/i)).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });
});
