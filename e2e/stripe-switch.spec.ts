import { test, expect } from "@playwright/test";
import { signInAdmin, hasAdminCredentials } from "./helpers";

// These tests require admin credentials and valid Stripe keys saved in the DB.
// Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in your .env.test or environment.

test.describe("Stripe switch API", () => {
  test.beforeEach(async ({ page }) => {
    await signInAdmin(page);
  });

  test("GET /api/stripe-setup returns key status and active mode", async ({ page, request }) => {
    const res = await request.get("/api/stripe-setup");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("active_mode");
    expect(["live", "test"]).toContain(body.active_mode);
    expect(body).toHaveProperty("live.key_configured");
    expect(body).toHaveProperty("test.key_configured");
  });

  test("GET /api/stripe-mode returns active_mode", async ({ request }) => {
    const res = await request.get("/api/stripe-mode");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(["live", "test"]).toContain(body.active_mode);
  });

  test("POST /api/stripe-switch rejects invalid mode", async ({ request }) => {
    const res = await request.post("/api/stripe-switch", {
      data: { mode: "invalid" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid mode/i);
  });

  test("POST /api/stripe-switch rejects unauthenticated request", async ({ request }) => {
    // Fresh request context — no admin session cookie
    const res = await request.post("/api/stripe-switch", {
      data: { mode: "test" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/stripe-switch fails if target mode has no keys saved", async ({ page, request }) => {
    // Get current setup to find a mode that has no keys
    const setupRes = await request.get("/api/stripe-setup");
    const setup = await setupRes.json();

    const unconfiguredMode = !setup.live.key_configured
      ? "live"
      : !setup.test.key_configured
      ? "test"
      : null;

    if (!unconfiguredMode) {
      test.skip(true, "Both modes have keys saved — skipping missing-key guard test.");
      return;
    }

    const res = await request.post("/api/stripe-switch", {
      data: { mode: unconfiguredMode },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/no .* keys saved/i);
  });

  test("POST /api/stripe-switch switches mode and confirms via GET", async ({ page, request }) => {
    const setupRes = await request.get("/api/stripe-setup");
    const setup = await setupRes.json();

    // Need both modes configured to round-trip
    if (!setup.live.key_configured || !setup.test.key_configured) {
      test.skip(true, "Both live and test keys must be saved to run the round-trip switch test.");
      return;
    }

    const currentMode: "live" | "test" = setup.active_mode;
    const targetMode: "live" | "test" = currentMode === "live" ? "test" : "live";

    // Switch to the other mode
    const switchRes = await request.post("/api/stripe-switch", {
      data: { mode: targetMode },
    });
    expect(switchRes.status()).toBe(200);
    const switchBody = await switchRes.json();
    expect(switchBody.ok).toBe(true);
    expect(switchBody.mode).toBe(targetMode);

    // Confirm DB reflects new mode
    const modeRes = await request.get("/api/stripe-mode");
    const modeBody = await modeRes.json();
    expect(modeBody.active_mode).toBe(targetMode);

    // Restore original mode
    await request.post("/api/stripe-switch", { data: { mode: currentMode } });
  });
});

// ── Admin UI smoke test ──────────────────────────────────────────────────────
test.describe("Stripe admin UI", () => {
  test.skip(!hasAdminCredentials, "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD to run.");

  test("stripe page loads and shows active mode badge", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/stripe");
    await expect(page.getByText(/active mode/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/live|test/i).first()).toBeVisible();
  });

  test("stripe page shows key status cards for both modes", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/stripe");
    await expect(page.getByText("LIVE")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("TEST")).toBeVisible();
  });

  test("connect stripe form accepts sk_live_ key format", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/stripe");
    const input = page.locator("input[placeholder*='sk_live_']");
    await input.fill("sk_live_testinputonly");
    await expect(page.getByText(/live key — real payments/i)).toBeVisible();
  });

  test("connect stripe form accepts sk_test_ key format", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/stripe");
    const input = page.locator("input[placeholder*='sk_live_']");
    await input.fill("sk_test_testinputonly");
    await expect(page.getByText(/test key — no real money/i)).toBeVisible();
  });

  test("connect stripe form rejects invalid key format", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/admin/stripe");
    const input = page.locator("input[placeholder*='sk_live_']");
    await input.fill("not_a_valid_key");
    await expect(page.getByText(/invalid key format/i)).toBeVisible();
  });
});
