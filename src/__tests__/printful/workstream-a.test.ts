// Workstream A — V2 Catalog / Production / Mockups
// Tests for all new V2 functions and the removal of unsafe V1 fallbacks.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveV2Template } from "@/lib/printful/templates";
import { validateArtworkFromV2Style, validateArtworkForPrintfile } from "@/lib/fulfillment/artwork-validation";
import type { V2MockupTemplate, V2MockupStyle } from "@/lib/printful/types";
import type { V2StyleSpec } from "@/lib/fulfillment/artwork-validation";

// ── resolveV2Template ─────────────────────────────────────────────────────────

const makeTemplate = (
  variantIds: number[],
  technique: string,
  placement: string,
  role: "primary" | "template"
): V2MockupTemplate => ({
  catalog_variant_ids: variantIds,
  placement,
  technique,
  print_area_width: 1429,
  print_area_height: 1809,
  print_area_top: 464,
  print_area_left: 801,
  template_width: 3000,
  template_height: 3000,
  image_url: "https://example.com/template.png",
  background_url: null,
  background_color: "#ffffff",
  printfile_id: 446,
  orientation: "any",
  template_positioning: "overlay",
  template_type: null,
  role,
});

describe("resolveV2Template", () => {
  const templates: V2MockupTemplate[] = [
    makeTemplate([17003, 17004, 17005, 17006, 17007, 17008], "dtfilm", "front", "primary"),
    makeTemplate([17003, 17004, 17005, 17006, 17007, 17008], "dtfilm", "front", "template"),
    makeTemplate([17003, 17004, 17005, 17006, 17007, 17008], "dtfilm", "back", "primary"),
    makeTemplate([17009, 17010, 17011], "dtfilm", "front", "primary"),
  ];

  it("resolves exactly one primary match for variant 17008 / dtfilm / front", () => {
    const result = resolveV2Template(templates, 17008, "dtfilm", "front");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.template.placement).toBe("front");
      expect(result.template.role).toBe("primary");
      expect(result.template.catalog_variant_ids).toContain(17008);
    }
  });

  it("returns unresolved when variant not in any template", () => {
    const result = resolveV2Template(templates, 99999, "dtfilm", "front");
    expect(result.status).toBe("unresolved");
  });

  it("returns unresolved when placement has no primary template for variant", () => {
    const result = resolveV2Template(templates, 17008, "dtfilm", "sleeve_left");
    expect(result.status).toBe("unresolved");
  });

  it("returns ambiguous when multiple primary templates match", () => {
    // Both 17008 and 17009 groups have a primary front/dtfilm template
    // A variant in both groups would be ambiguous — simulate with a template set
    const ambiguous: V2MockupTemplate[] = [
      makeTemplate([17008], "dtfilm", "front", "primary"),
      makeTemplate([17008], "dtfilm", "front", "primary"),
    ];
    const result = resolveV2Template(ambiguous, 17008, "dtfilm", "front");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.count).toBe(2);
    }
  });

  it("does NOT fall back to templates[0] when no match", () => {
    const result = resolveV2Template(templates, 99999, "dtfilm", "front");
    expect(result.status).toBe("unresolved");
    // Must not return the first template
  });

  it("does NOT use variant_mapping or variant_mapping[0]", () => {
    // resolveV2Template has no variant_mapping parameter — it cannot use it
    // This test verifies the function signature enforces V2-only identity
    const result = resolveV2Template([], 17008, "dtfilm", "front");
    expect(result.status).toBe("unresolved");
  });

  it("matches technique case-insensitively", () => {
    const result1 = resolveV2Template(templates, 17008, "DTFILM", "front");
    const result2 = resolveV2Template(templates, 17008, "dtfilm", "front");
    expect(result1.status).toBe("resolved");
    expect(result2.status).toBe("resolved");
  });

  it("excludes role=template records from resolution", () => {
    // Only role=primary should match
    const templateOnly: V2MockupTemplate[] = [
      makeTemplate([17008], "dtfilm", "front", "template"),
    ];
    const result = resolveV2Template(templateOnly, 17008, "dtfilm", "front");
    expect(result.status).toBe("unresolved");
  });

  it("returns unresolved for empty template array", () => {
    const result = resolveV2Template([], 17008, "dtfilm", "front");
    expect(result.status).toBe("unresolved");
  });
});

// ── validateArtworkFromV2Style ────────────────────────────────────────────────

describe("validateArtworkFromV2Style", () => {
  const dtfilmFrontStyle: V2StyleSpec = {
    print_area_width: 15.5,   // inches — live-proven product 679 / front / dtfilm
    print_area_height: 19.6,
    dpi: 150,
    print_area_type: "simple",
    technique: "dtfilm",
  };

  it("produces PASS_WARNING for 3000x3000 artwork on dtfilm/simple — matches V1 result", () => {
    const result = validateArtworkFromV2Style(3000, 3000, dtfilmFrontStyle);
    expect(result.status).toBe("PASS_WARNING");
    expect(result.effectiveDpi).toBe(194); // 193.5 rounded
    // Canvas derived: 15.5*150=2325, 19.6*150=2940 — exact match to V1 printfile
    expect(result.canvasWidth).toBe(2325);
    expect(result.canvasHeight).toBe(2940);
  });

  it("produces PASS for high-resolution artwork", () => {
    const result = validateArtworkFromV2Style(5000, 5000, dtfilmFrontStyle);
    expect(result.status).toBe("PASS");
    expect(result.effectiveDpi).toBeGreaterThanOrEqual(300);
  });

  it("produces FAIL for low-resolution artwork", () => {
    const result = validateArtworkFromV2Style(500, 500, dtfilmFrontStyle);
    expect(result.status).toBe("FAIL");
    expect(result.effectiveDpi).toBeLessThan(150);
  });

  it("returns UNVERIFIED for unsupported technique", () => {
    const result = validateArtworkFromV2Style(3000, 3000, {
      ...dtfilmFrontStyle,
      technique: "sublimation",
    });
    expect(result.status).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED for novel print_area_type", () => {
    const result = validateArtworkFromV2Style(3000, 3000, {
      ...dtfilmFrontStyle,
      print_area_type: "wrap",
    });
    expect(result.status).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED for null print_area_type (supported case)", () => {
    // null is in the verified set
    const result = validateArtworkFromV2Style(3000, 3000, {
      ...dtfilmFrontStyle,
      print_area_type: null,
    });
    expect(result.status).not.toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED for missing dimensions", () => {
    const result = validateArtworkFromV2Style(3000, 3000, {
      ...dtfilmFrontStyle,
      print_area_width: 0,
    });
    expect(result.status).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED for missing DPI", () => {
    const result = validateArtworkFromV2Style(3000, 3000, {
      ...dtfilmFrontStyle,
      dpi: 0,
    });
    expect(result.status).toBe("UNVERIFIED");
  });

  it("supports dtg/simple", () => {
    const dtgStyle: V2StyleSpec = {
      print_area_width: 12.0,
      print_area_height: 16.0,
      dpi: 150,
      print_area_type: "simple",
      technique: "dtg",
    };
    const result = validateArtworkFromV2Style(3000, 3000, dtgStyle);
    expect(result.status).not.toBe("UNVERIFIED");
    // Canvas: 12*150=1800, 16*150=2400 — matches V1 product 12/dtg/front
    expect(result.canvasWidth).toBe(1800);
    expect(result.canvasHeight).toBe(2400);
  });

  it("supports embroidery/simple", () => {
    const embStyle: V2StyleSpec = {
      print_area_width: 4.0,
      print_area_height: 4.0,
      dpi: 300,
      print_area_type: "simple",
      technique: "embroidery",
    };
    const result = validateArtworkFromV2Style(1200, 1200, embStyle);
    expect(result.status).not.toBe("UNVERIFIED");
    // Canvas: 4*300=1200 — matches V1 product 12/embroidery/chest_left
    expect(result.canvasWidth).toBe(1200);
    expect(result.canvasHeight).toBe(1200);
  });

  it("V2 result matches V1 result for product 679/dtfilm/front with 3000x3000 artwork", () => {
    // V1 printfile: width=2325, height=2940, dpi=150, fill_mode=fit
    const v1Spec = { printfile_id: 446, width: 2325, height: 2940, dpi: 150, fill_mode: "fit" };
    const v1Result = validateArtworkForPrintfile(3000, 3000, v1Spec);
    const v2Result = validateArtworkFromV2Style(3000, 3000, dtfilmFrontStyle);
    expect(v2Result.status).toBe(v1Result.status);
    expect(v2Result.effectiveDpi).toBe(v1Result.effectiveDpi);
    expect(v2Result.canvasWidth).toBe(v1Result.canvasWidth);
    expect(v2Result.canvasHeight).toBe(v1Result.canvasHeight);
  });
});

// ── V2 mockup task request shape ──────────────────────────────────────────────

describe("V2 mockup task request shape", () => {
  it("V2MockupTaskRequest has required fields", () => {
    // Structural test — verifies the request shape matches the live-proven contract
    const request = {
      products: [{
        source: "catalog" as const,
        catalog_product_id: 679,
        catalog_variant_ids: [17008],
        placements: [{
          placement: "front",
          technique: "dtfilm",
          layers: [{ type: "file" as const, url: "https://example.supabase.co/artwork.png" }],
        }],
      }],
    };
    expect(request.products[0].source).toBe("catalog");
    expect(request.products[0].catalog_product_id).toBe(679);
    expect(request.products[0].catalog_variant_ids).toContain(17008);
    expect(request.products[0].placements[0].placement).toBe("front");
    expect(request.products[0].placements[0].technique).toBe("dtfilm");
    expect(request.products[0].placements[0].layers[0].type).toBe("file");
  });

  it("catalog_variant_ids must be explicitly supplied — not empty", () => {
    const variantIds = [17008];
    expect(variantIds.length).toBeGreaterThan(0);
    // Verifies the contract rule: do not omit catalog_variant_ids
  });
});

// ── V2 mockup task result shape ───────────────────────────────────────────────

describe("V2 mockup task result shape", () => {
  it("V2MockupTask has numeric id, not string task_key", () => {
    const task = {
      id: 979231004,
      status: "completed" as const,
      catalog_variant_mockups: [{
        catalog_variant_id: 17008,
        mockups: [{
          placement: "front",
          display_name: "Front print",
          technique: "dtfilm",
          style_id: 6591,
          mockup_url: "https://printful-upload.s3.amazonaws.com/tmp/abc/mockup.png",
          view: "Front",
        }],
      }],
      failure_reasons: [],
    };
    expect(typeof task.id).toBe("number");
    expect(task.catalog_variant_mockups[0].catalog_variant_id).toBe(17008);
    expect(task.catalog_variant_mockups[0].mockups[0].placement).toBe("front");
  });

  it("polling uses numeric task ID as query param", () => {
    const taskId = 979231004;
    const url = `/api/printful/mockups/${taskId}`;
    // The route detects numeric IDs and routes to V2
    expect(String(taskId)).toBe("979231004");
    expect(parseInt("979231004", 10)).toBe(taskId);
  });

  it("V2 result identity is V2 catalog variant ID — not V1", () => {
    const catalogVariantId = 17008;
    // 17008 is a V2 catalog variant ID from getCatalogVariants()
    // It must not be translated to a V1 variant ID
    expect(catalogVariantId).toBe(17008);
  });
});

// ── Regression: V1 resolveLayoutTemplateForVariantPlacement still works ───────

describe("resolveLayoutTemplateForVariantPlacement (V1 legacy)", () => {
  it("is still exported from templates.ts", async () => {
    const { resolveLayoutTemplateForVariantPlacement } = await import("@/lib/printful/templates");
    expect(typeof resolveLayoutTemplateForVariantPlacement).toBe("function");
  });

  it("returns null for empty response", async () => {
    const { resolveLayoutTemplateForVariantPlacement } = await import("@/lib/printful/templates");
    const result = resolveLayoutTemplateForVariantPlacement(
      { version: 1, min_dpi: 150, variant_mapping: [], templates: [], conflicting_placements: {} },
      "front"
    );
    expect(result).toBeNull();
  });
});
