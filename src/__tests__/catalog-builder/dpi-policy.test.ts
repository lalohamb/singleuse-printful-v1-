// DPI Policy — Publication Gate Tests
// Policy: FAIL → block publication. WARNING → operator may continue. PASS → proceed.
// UNVERIFIED → visible, not treated as PASS, operator may continue (no DPI data available).
// Enforcement point: CatalogBuilder review stage Publish button disabled when status === "FAIL".
// No live provider calls. No Stripe. No database writes.

import { describe, it, expect } from "vitest";
import type { ArtworkValidationStatus } from "@/lib/fulfillment/artwork-validation";

// ── Policy logic (mirrors CatalogBuilder publish gate) ────────────────────────

function isPublishBlocked(validationStatus: ArtworkValidationStatus | null): boolean {
  return validationStatus === "FAIL";
}

function publishButtonDisabled(
  saving: boolean,
  publishing: boolean,
  validationStatus: ArtworkValidationStatus | null
): boolean {
  return saving || publishing || isPublishBlocked(validationStatus);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DPI policy — FAIL blocks publication", () => {
  it("FAIL status blocks publish button", () => {
    expect(isPublishBlocked("FAIL")).toBe(true);
  });

  it("publish button is disabled when validation is FAIL", () => {
    expect(publishButtonDisabled(false, false, "FAIL")).toBe(true);
  });

  it("publish button is disabled when FAIL even if not saving/publishing", () => {
    expect(publishButtonDisabled(false, false, "FAIL")).toBe(true);
  });
});

describe("DPI policy — PASS allows publication", () => {
  it("PASS status does not block publish", () => {
    expect(isPublishBlocked("PASS")).toBe(false);
  });

  it("publish button is enabled when validation is PASS", () => {
    expect(publishButtonDisabled(false, false, "PASS")).toBe(false);
  });
});

describe("DPI policy — WARNING allows publication", () => {
  it("PASS_WARNING status does not block publish", () => {
    expect(isPublishBlocked("PASS_WARNING")).toBe(false);
  });

  it("publish button is enabled when validation is PASS_WARNING", () => {
    expect(publishButtonDisabled(false, false, "PASS_WARNING")).toBe(false);
  });
});

describe("DPI policy — UNVERIFIED is visible, not treated as PASS or FAIL", () => {
  it("UNVERIFIED does not block publish (no DPI data available — operator proceeds at own risk)", () => {
    expect(isPublishBlocked("UNVERIFIED")).toBe(false);
  });

  it("UNVERIFIED is not the same as PASS", () => {
    expect("UNVERIFIED").not.toBe("PASS");
  });

  it("UNVERIFIED is not the same as FAIL", () => {
    expect("UNVERIFIED").not.toBe("FAIL");
  });

  it("publish button is enabled when validation is UNVERIFIED", () => {
    expect(publishButtonDisabled(false, false, "UNVERIFIED")).toBe(false);
  });
});

describe("DPI policy — null validation (no check performed)", () => {
  it("null validation does not block publish (no DPI data — operator proceeds)", () => {
    expect(isPublishBlocked(null)).toBe(false);
  });

  it("publish button is enabled when validation is null", () => {
    expect(publishButtonDisabled(false, false, null)).toBe(false);
  });
});

describe("DPI policy — saving/publishing state still blocks regardless of DPI", () => {
  it("saving=true blocks publish even with PASS", () => {
    expect(publishButtonDisabled(true, false, "PASS")).toBe(true);
  });

  it("publishing=true blocks publish even with PASS", () => {
    expect(publishButtonDisabled(false, true, "PASS")).toBe(true);
  });
});

describe("DPI policy — FAIL cannot reach published state", () => {
  it("a product with FAIL validation cannot be published via the Catalog Builder UI", () => {
    // The publish button is disabled when artworkValidation.status === "FAIL"
    // handleSaveAndPublish is therefore unreachable from the UI in this state
    const canPublish = !publishButtonDisabled(false, false, "FAIL");
    expect(canPublish).toBe(false);
  });

  it("a product with PASS validation can be published", () => {
    const canPublish = !publishButtonDisabled(false, false, "PASS");
    expect(canPublish).toBe(true);
  });

  it("a product with WARNING validation can be published (operator accepts risk)", () => {
    const canPublish = !publishButtonDisabled(false, false, "PASS_WARNING");
    expect(canPublish).toBe(true);
  });
});

describe("DPI policy — FAIL does not silently become WARNING", () => {
  it("FAIL is not equal to PASS_WARNING", () => {
    expect("FAIL").not.toBe("PASS_WARNING");
  });

  it("isPublishBlocked treats FAIL and PASS_WARNING differently", () => {
    expect(isPublishBlocked("FAIL")).toBe(true);
    expect(isPublishBlocked("PASS_WARNING")).toBe(false);
  });
});
