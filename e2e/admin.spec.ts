import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "admin@bodyandsleeves.com";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "changeme";

test.describe("Admin", () => {
  test("admin login page loads", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test("invalid login shows error", async ({ page }) => {
    await page.goto("/admin");
    await page.getByPlaceholder(/email/i).fill("wrong@example.com");
    await page.getByPlaceholder(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/admin");
      await page.getByPlaceholder(/email/i).fill(ADMIN_EMAIL);
      await page.getByPlaceholder(/password/i).fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
    });

    // ── Dashboard ──────────────────────────────────────────────────────────
    test("dashboard shows all 4 stat cards", async ({ page }) => {
      await expect(page.getByText(/total revenue/i)).toBeVisible();
      await expect(page.getByText(/total orders/i)).toBeVisible();
      await expect(page.getByText(/pending orders/i)).toBeVisible();
      await expect(page.getByText(/total products/i)).toBeVisible();
    });

    test("dashboard quick actions links are present", async ({ page }) => {
      await expect(page.getByRole("link", { name: /manage products/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /view orders/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /store settings/i })).toBeVisible();
    });

    // ── Products ───────────────────────────────────────────────────────────
    test("products page loads with active/inactive tabs", async ({ page }) => {
      await page.goto("/admin/products");
      await expect(page.getByRole("button", { name: /active/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /inactive/i })).toBeVisible();
    });

    test("inactive tab shows activate button", async ({ page }) => {
      await page.goto("/admin/products");
      await page.getByRole("button", { name: /inactive/i }).click();
      // If there are inactive products, Activate button should appear
      const activateBtn = page.getByRole("button", { name: /activate/i }).first();
      const emptyMsg = page.getByText(/all products are active/i);
      await expect(activateBtn.or(emptyMsg)).toBeVisible({ timeout: 5000 });
    });

    test("products page has sync printify button", async ({ page }) => {
      await page.goto("/admin/products");
      await expect(page.getByRole("button", { name: /sync printify/i })).toBeVisible();
    });

    test("sync button shows message when shop ID not set", async ({ page }) => {
      await page.goto("/admin/products");
      await page.getByRole("button", { name: /sync printify/i }).click();
      await expect(
        page.getByText(/synced|shop id|not configured|error/i)
      ).toBeVisible({ timeout: 10000 });
    });

    test("can open add product modal", async ({ page }) => {
      await page.goto("/admin/products");
      await page.getByRole("button", { name: /add product/i }).click();
      await expect(page.getByPlaceholder("Product title")).toBeVisible();
      await expect(page.getByPlaceholder("32.00")).toBeVisible();
    });

    test("can create a manual product and it appears in active tab", async ({ page }) => {
      await page.goto("/admin/products");
      await page.getByRole("button", { name: /add product/i }).click();
      await page.getByPlaceholder("Product title").fill("E2E Test Product");
      await page.getByPlaceholder("32.00").fill("29.99");
      await page.getByRole("button", { name: /create product/i }).click();
      // Should appear in active tab
      await expect(page.getByText("E2E Test Product")).toBeVisible({ timeout: 5000 });
    });

    test("product search filters results", async ({ page }) => {
      await page.goto("/admin/products");
      await page.getByPlaceholder(/search products/i).fill("zzznomatch");
      await expect(page.getByText(/no active products found/i)).toBeVisible({ timeout: 5000 });
    });

    // ── Orders ─────────────────────────────────────────────────────────────
    test("orders page loads with status filter", async ({ page }) => {
      await page.goto("/admin/orders");
      await expect(page.getByRole("option", { name: /all status/i })).toBeVisible();
    });

    test("orders status filter works", async ({ page }) => {
      await page.goto("/admin/orders");
      await page.selectOption("select", "pending");
      // Should either show filtered orders or empty state
      await expect(
        page.getByText(/no orders found/i).or(page.locator("table tbody tr").first())
      ).toBeVisible({ timeout: 5000 });
    });

    test("order detail modal opens", async ({ page }) => {
      await page.goto("/admin/orders");
      const eyeBtn = page.locator("button").filter({ has: page.locator("svg") }).first();
      if (await eyeBtn.isVisible()) {
        await eyeBtn.click();
        await expect(page.getByText(/order #/i)).toBeVisible();
        await expect(page.getByText(/shipping address/i)).toBeVisible();
      }
    });

    // ── Settings ───────────────────────────────────────────────────────────
    test("settings page has printify shop ID field", async ({ page }) => {
      await page.goto("/admin/settings");
      await expect(page.getByPlaceholder(/e.g. 12345678/i)).toBeVisible();
    });

    test("settings page shows integration status badges", async ({ page }) => {
      await page.goto("/admin/settings");
      await expect(page.getByText(/stripe/i)).toBeVisible();
      await expect(page.getByText(/mailerlite/i)).toBeVisible();
      await expect(page.getByText(/resend/i)).toBeVisible();
      await expect(page.getByText(/printify/i)).toBeVisible();
    });

    test("settings page has social media section", async ({ page }) => {
      await page.goto("/admin/settings");
      await expect(page.getByText(/social media/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /save social links/i })).toBeVisible();
    });

    test("settings saves successfully", async ({ page }) => {
      await page.goto("/admin/settings");
      await page.getByRole("button", { name: /save settings/i }).click();
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    });

    test("social links save successfully", async ({ page }) => {
      await page.goto("/admin/settings");
      await page.getByRole("button", { name: /save social links/i }).click();
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    });

    // ── Auth ───────────────────────────────────────────────────────────────
    test("admin sign out works", async ({ page }) => {
      await page.goto("/admin/dashboard");
      await page.getByRole("button", { name: /sign out/i }).click();
      await expect(page.getByPlaceholder(/email/i)).toBeVisible({ timeout: 5000 });
    });
  });
});
