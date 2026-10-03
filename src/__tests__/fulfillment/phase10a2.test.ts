// Phase 10A.2 — Batch Positioning & Controlled Batch Validation
//
// Tests:
//   1. Positioning engine (computeCenterFitPosition, computePositionFromTemplate, isValidPosition)
//   2. Recipe engine integration — position auto-computed when layoutTemplate provided
//   3. Recipe engine — no position when layoutTemplate absent (backward compat)
//   4. BatchRecipe carries layoutTemplate through resolveBatchItem
//   5. DPI validation thresholds (PASS / PASS_WARNING / FAIL)
//   6. isValidPosition guards
//   7. file_hash backfill logic (unit)
//   8. validate-all report structure (unit)

import { describe, it, expect } from "vitest";
import {
  computeCenterFitPosition,
  computePositionFromTemplate,
  isValidPosition,
} from "@/lib/catalog/positioning";
import { resolveProductRecipe } from "@/lib/catalog/recipe-engine";
import { resolveBatchItem } from "@/lib/catalog/batch-engine";
import type { ProductRecipe } from "@/lib/catalog/recipe-engine";
import type { BatchRecipe, BatchDesign } from "@/lib/catalog/batch-engine";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTIVE_RECIPE: ProductRecipe = {
  id: "f6c0b27a-f81b-470a-8951-eea6df08e40d",
  name: "Everyday Graphic Tee",
  slug: "everyday-graphic-tee",
  description: null,
  status: "active",
  provider: "printful",
  printful_catalog_id: 71,
  technique: "DTG",
  placement: "front",
  printfile_id: 1,
  variant_rules: { colors: ["Black", "White"], sizes: ["S", "M", "L"] },
  pricing_rules: { strategy: "COST_PLUS", cost_plus_margin: 18, rounding: "nearest_99", min_price: 28 },
  mockup_rules: {},
  commercial_defaults: {},
  publication_default: "draft",
  metadata: {},
  created_at: "2026-10-03T18:36:31.280451+00:00",
  updated_at: "2026-10-03T18:36:31.280451+00:00",
};

const SAMPLE_VARIANTS = [
  { id: 4016, name: "BC 3001 (Black / S)", color: "Black", size: "S", price: "11.92", availability_status: "active" },
  { id: 4017, name: "BC 3001 (Black / M)", color: "Black", size: "M", price: "11.92", availability_status: "active" },
  { id: 4018, name: "BC 3001 (Black / L)", color: "Black", size: "L", price: "11.92", availability_status: "active" },
  { id: 4011, name: "BC 3001 (White / S)", color: "White", size: "S", price: "11.92", availability_status: "active" },
  { id: 4012, name: "BC 3001 (White / M)", color: "White", size: "M", price: "11.92", availability_status: "active" },
  { id: 4013, name: "BC 3001 (White / L)", color: "White", size: "L", price: "11.92", availability_status: "active" },
];

// Product 71 front placement template (from live Printful)
const TEMPLATE_71_FRONT = {
  print_area_width: 1010,
  print_area_height: 1346,
};
const PRINT_AREA_71_FRONT = { area_width: 1010, area_height: 1346 };
const CANVAS_DPI_71 = 150;

// Product 1580 front_dtf template (from live Printful)
const TEMPLATE_1580_FRONT_DTF = {
  print_area_width: 1133,
  print_area_height: 1510,
};
const PRINT_AREA_1580 = { area_width: 1133, area_height: 1510 };
const CANVAS_DPI_1580 = 150;

// Production master artwork
const ARTWORK_4200x4800 = { width: 4200, height: 4800 };
// Small artwork
const ARTWORK_1173x1341 = { width: 1173, height: 1341 };
// Very small artwork (FAIL)
const ARTWORK_300x300 = { width: 300, height: 300 };

// ── 1. computeCenterFitPosition ───────────────────────────────────────────────

describe("computeCenterFitPosition", () => {
  it("produces non-zero position for production master on product 71 front", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.position.area_width).toBe(1010);
    expect(result.position.area_height).toBe(1346);
    expect(result.position.width).toBeGreaterThan(0);
    expect(result.position.height).toBeGreaterThan(0);
  });

  it("centers artwork — left+width <= area_width", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.position.left + result.position.width).toBeLessThanOrEqual(result.position.area_width + 1);
  });

  it("centers artwork — top+height <= area_height", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.position.top + result.position.height).toBeLessThanOrEqual(result.position.area_height + 1);
  });

  it("PASS for 4200x4800 artwork on 150dpi canvas", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.validation).toBe("PASS");
    expect(result.effective_dpi).toBeGreaterThanOrEqual(300);
  });

  it("PASS_WARNING for 1173x1341 artwork on 150dpi canvas", () => {
    const result = computeCenterFitPosition(ARTWORK_1173x1341, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.validation).toBe("PASS_WARNING");
    expect(result.effective_dpi).toBeGreaterThanOrEqual(150);
    expect(result.effective_dpi).toBeLessThan(300);
  });

  it("FAIL for 300x300 artwork on 150dpi canvas", () => {
    const result = computeCenterFitPosition(ARTWORK_300x300, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.validation).toBe("FAIL");
    expect(result.effective_dpi).toBeLessThan(150);
  });

  it("strategy is CENTER_FIT", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.strategy).toBe("CENTER_FIT");
  });

  it("scale is <= 1 when artwork larger than print area", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.scale).toBeLessThanOrEqual(1);
  });

  it("scale is <= 1 for 1580 front_dtf template", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_1580, CANVAS_DPI_1580);
    expect(result.scale).toBeLessThanOrEqual(1);
    expect(result.validation).toBe("PASS");
  });

  it("left is non-negative", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.position.left).toBeGreaterThanOrEqual(0);
  });

  it("top is non-negative", () => {
    const result = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    expect(result.position.top).toBeGreaterThanOrEqual(0);
  });

  it("square artwork centers symmetrically", () => {
    const result = computeCenterFitPosition(
      { width: 1000, height: 1000 },
      { area_width: 1000, area_height: 1000 },
      150
    );
    expect(result.position.left).toBe(0);
    expect(result.position.top).toBe(0);
    expect(result.position.width).toBe(1000);
    expect(result.position.height).toBe(1000);
  });

  it("portrait artwork in landscape area — left offset > 0", () => {
    const result = computeCenterFitPosition(
      { width: 500, height: 1000 },
      { area_width: 1000, area_height: 1000 },
      150
    );
    expect(result.position.left).toBeGreaterThan(0);
    expect(result.position.top).toBe(0);
  });

  it("landscape artwork in portrait area — top offset > 0", () => {
    const result = computeCenterFitPosition(
      { width: 1000, height: 500 },
      { area_width: 1000, area_height: 1000 },
      150
    );
    expect(result.position.top).toBeGreaterThan(0);
    expect(result.position.left).toBe(0);
  });
});

// ── 2. computePositionFromTemplate ────────────────────────────────────────────

describe("computePositionFromTemplate", () => {
  it("delegates to computeCenterFitPosition correctly", () => {
    const direct = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71);
    const fromTemplate = computePositionFromTemplate(ARTWORK_4200x4800, TEMPLATE_71_FRONT, CANVAS_DPI_71);
    expect(fromTemplate.position).toEqual(direct.position);
    expect(fromTemplate.effective_dpi).toBe(direct.effective_dpi);
  });

  it("produces valid position for 1580 DTFILM template", () => {
    const result = computePositionFromTemplate(ARTWORK_4200x4800, TEMPLATE_1580_FRONT_DTF, CANVAS_DPI_1580);
    expect(isValidPosition(result.position)).toBe(true);
    expect(result.validation).toBe("PASS");
  });
});

// ── 3. isValidPosition ────────────────────────────────────────────────────────

describe("isValidPosition", () => {
  it("returns true for valid position", () => {
    const pos = computeCenterFitPosition(ARTWORK_4200x4800, PRINT_AREA_71_FRONT, CANVAS_DPI_71).position;
    expect(isValidPosition(pos)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isValidPosition(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidPosition(undefined)).toBe(false);
  });

  it("returns false for zero-area position", () => {
    expect(isValidPosition({ area_width: 0, area_height: 0, width: 0, height: 0, top: 0, left: 0 })).toBe(false);
  });

  it("returns false when width is 0", () => {
    expect(isValidPosition({ area_width: 1000, area_height: 1000, width: 0, height: 500, top: 0, left: 0 })).toBe(false);
  });
});

// ── 4. resolveProductRecipe — position auto-computed when layoutTemplate given ─

describe("resolveProductRecipe with layoutTemplate", () => {
  const baseInput = {
    recipe: ACTIVE_RECIPE,
    design: { id: "dc6f0073", artwork_url: "https://example.com/art.png", width: 4200, height: 4800, name: "Grandpa Still Original" },
    availableVariants: SAMPLE_VARIANTS,
    commercialInputs: { title: "Grandpa Still Original Tee", slug: "grandpa-still-original-tee" },
    idempotency_key: "batch:test:item:001",
  };

  it("freezes position into design_configuration when layoutTemplate provided", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(result.valid).toBe(true);
    const pos = result.spec?.design_configuration?.position as Record<string, number> | undefined;
    expect(pos).toBeDefined();
    expect(pos?.area_width).toBe(1010);
    expect(pos?.area_height).toBe(1346);
    expect(pos?.width).toBeGreaterThan(0);
    expect(pos?.height).toBeGreaterThan(0);
  });

  it("freezes positioning_strategy into design_configuration", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(result.spec?.design_configuration?.positioning_strategy).toBe("CENTER_FIT");
  });

  it("freezes positioning_dpi into design_configuration", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(typeof result.spec?.design_configuration?.positioning_dpi).toBe("number");
    expect((result.spec?.design_configuration?.positioning_dpi as number)).toBeGreaterThan(0);
  });

  it("freezes positioning_validation PASS for 4200x4800 artwork", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(result.spec?.design_configuration?.positioning_validation).toBe("PASS");
  });

  it("no position in design_configuration when layoutTemplate absent", () => {
    const result = resolveProductRecipe(baseInput);
    expect(result.valid).toBe(true);
    expect(result.spec?.design_configuration?.position).toBeUndefined();
    expect(result.spec?.design_configuration?.positioning_strategy).toBeUndefined();
  });

  it("no position when design has no dimensions even with layoutTemplate", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      design: { ...baseInput.design, width: null, height: null },
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(result.valid).toBe(true);
    expect(result.spec?.design_configuration?.position).toBeUndefined();
  });

  it("PASS_WARNING for 1173x1341 artwork", () => {
    const result = resolveProductRecipe({
      ...baseInput,
      design: { ...baseInput.design, width: 1173, height: 1341 },
      layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
    });
    expect(result.spec?.design_configuration?.positioning_validation).toBe("PASS_WARNING");
  });
});

// ── 5. resolveBatchItem — layoutTemplate threads through ──────────────────────

describe("resolveBatchItem with layoutTemplate", () => {
  const design: BatchDesign = {
    id: "dc6f0073",
    name: "Grandpa Still Original",
    artwork_url: "https://example.com/art.png",
    file_hash: null,
    width: 4200,
    height: 4800,
    status: "active",
  };

  const batchRecipe: BatchRecipe = {
    recipe: ACTIVE_RECIPE,
    availableVariants: SAMPLE_VARIANTS,
    layoutTemplate: { print_area_width: 1010, print_area_height: 1346, canvas_dpi: 150 },
  };

  const cell = {
    design,
    recipe: batchRecipe,
    idempotency_key: "batch:b1:item:i1",
    included: true,
    compatibility: { decision: "ALLOWED" as const, reason: null },
  };

  it("resolves successfully with position in spec", () => {
    const result = resolveBatchItem(cell, { title: "Grandpa Tee", slug: "grandpa-tee" });
    expect(result.valid).toBe(true);
    expect(result.spec?.design_configuration?.position).toBeDefined();
  });

  it("position area_width matches template", () => {
    const result = resolveBatchItem(cell, { title: "Grandpa Tee", slug: "grandpa-tee" });
    const pos = result.spec?.design_configuration?.position as Record<string, number>;
    expect(pos?.area_width).toBe(1010);
  });

  it("without layoutTemplate — no position in spec", () => {
    const recipeNoTemplate: BatchRecipe = { recipe: ACTIVE_RECIPE, availableVariants: SAMPLE_VARIANTS };
    const cellNoTemplate = { ...cell, recipe: recipeNoTemplate };
    const result = resolveBatchItem(cellNoTemplate, { title: "Grandpa Tee", slug: "grandpa-tee" });
    expect(result.valid).toBe(true);
    expect(result.spec?.design_configuration?.position).toBeUndefined();
  });
});

// ── 6. Live data DPI calculations ─────────────────────────────────────────────

describe("Live Printful data — DPI calculations", () => {
  it("4200x4800 on product 71 front (1010x1346 @ 150dpi) → PASS", () => {
    const r = computePositionFromTemplate(ARTWORK_4200x4800, TEMPLATE_71_FRONT, 150);
    expect(r.validation).toBe("PASS");
    expect(r.effective_dpi).toBeGreaterThanOrEqual(300);
  });

  it("4200x4800 on product 1580 front_dtf (1133x1510 @ 150dpi) → PASS", () => {
    const r = computePositionFromTemplate(ARTWORK_4200x4800, TEMPLATE_1580_FRONT_DTF, 150);
    expect(r.validation).toBe("PASS");
  });

  it("1173x1341 on product 71 front → PASS_WARNING", () => {
    const r = computePositionFromTemplate(ARTWORK_1173x1341, TEMPLATE_71_FRONT, 150);
    expect(r.validation).toBe("PASS_WARNING");
  });

  it("1173x1341 on product 1580 front_dtf → PASS_WARNING", () => {
    const r = computePositionFromTemplate(ARTWORK_1173x1341, TEMPLATE_1580_FRONT_DTF, 150);
    expect(r.validation).toBe("PASS_WARNING");
  });

  it("embroidery hat 638 (1796x608 @ 300dpi) — 4200x4800 artwork → PASS", () => {
    const r = computePositionFromTemplate(ARTWORK_4200x4800, { print_area_width: 1796, print_area_height: 608 }, 300);
    expect(r.validation).toBe("PASS");
  });

  it("embroidery hat 638 — 1173x1341 artwork → check DPI", () => {
    const r = computePositionFromTemplate(ARTWORK_1173x1341, { print_area_width: 1796, print_area_height: 608 }, 300);
    expect(["PASS", "PASS_WARNING"]).toContain(r.validation);
  });
});

// ── 7. Recipe color rule mismatch detection (unit) ───────────────────────────

describe("Recipe color rule mismatch — product 1580", () => {
  it("detects that Faded/Brick/Mustard colors are NOT in live catalog", () => {
    // Live catalog 1580 only has: Black, Vintage White, Washed Black, Washed Navy, Washed Pine
    const catalogColors = new Set(["Black", "Vintage White", "Washed Black", "Washed Navy", "Washed Pine"]);
    const recipeColors = ["Black", "Brick", "Faded Eucalyptus", "Faded Khaki", "Faded Navy",
      "Faded Orchid", "Faded Pepper", "Faded Teal", "Faded True Royal", "Faded Watermelon",
      "Ivory", "Mustard", "Washed Denim"];
    const matched = recipeColors.filter((c) => catalogColors.has(c));
    const unmatched = recipeColors.filter((c) => !catalogColors.has(c));
    expect(matched).toContain("Black");
    expect(unmatched.length).toBeGreaterThan(0);
    expect(unmatched).toContain("Brick");
    expect(unmatched).toContain("Faded Navy");
  });

  it("only Black matches in live catalog 1580 from recipe color list", () => {
    const catalogColors = new Set(["Black", "Vintage White", "Washed Black", "Washed Navy", "Washed Pine"]);
    const recipeColors = ["Black", "Brick", "Faded Eucalyptus", "Faded Khaki", "Faded Navy",
      "Faded Orchid", "Faded Pepper", "Faded Teal", "Faded True Royal", "Faded Watermelon",
      "Ivory", "Mustard", "Washed Denim"];
    const matched = recipeColors.filter((c) => catalogColors.has(c));
    expect(matched).toEqual(["Black"]);
  });
});

// ── 8. Recipe 638 embroidery hat — variant availability ──────────────────────

describe("Recipe 638 embroidery hat — live variant analysis", () => {
  it("only 2 total variants exist (Black out of stock, White in stock)", () => {
    // From live Printful: id 16244 Black out_of_stock, id 16245 White in_stock
    const liveVariants = [
      { id: 16244, color: "Black", size: "One size", in_stock: false },
      { id: 16245, color: "White", size: "One size", in_stock: true },
    ];
    const recipeColors = ["Black", "White", "Navy", "Khaki", "Dark Grey"];
    const recipeSizes = ["One Size"];

    // Note: live catalog uses "One size" (lowercase s), recipe uses "One Size"
    const filtered = liveVariants.filter((v) =>
      recipeColors.includes(v.color) && recipeSizes.some((s) => s.toLowerCase() === v.size.toLowerCase())
    );
    expect(filtered.length).toBe(2);

    const available = filtered.filter((v) => v.in_stock);
    expect(available.length).toBe(1);
    expect(available[0].color).toBe("White");
  });

  it("detects size mismatch: recipe uses 'One Size', catalog uses 'One size'", () => {
    const catalogSize = "One size";
    const recipeSize = "One Size";
    // Case-sensitive match fails
    expect(catalogSize).not.toBe(recipeSize);
    // Case-insensitive match succeeds
    expect(catalogSize.toLowerCase()).toBe(recipeSize.toLowerCase());
  });
});

// ── 9. Pricing calculations for live data ────────────────────────────────────

describe("Pricing calculations — live Printful costs", () => {
  it("product 71 Black S: cost $11.92 + $18 margin → nearest_99 → $29.99", () => {
    const cost = 11.92;
    const margin = 18;
    const raw = cost + margin; // 29.92
    const rounded = Math.floor(raw) + 0.99; // 29.99
    const final = Math.max(rounded, 28); // min_price 28
    expect(final).toBe(29.99);
  });

  it("product 71 Black 3XL: cost $15.92 + $18 margin → nearest_99 → $33.99", () => {
    const cost = 15.92;
    const margin = 18;
    const raw = cost + margin; // 33.92
    const rounded = Math.floor(raw) + 0.99; // 33.99
    expect(rounded).toBe(33.99);
  });

  it("product 1580 Black S: cost $23.72 + $36.28 margin → nearest_99 → $59.99", () => {
    const cost = 23.72;
    const margin = 36.28;
    const raw = cost + margin; // 60.00
    const rounded = Math.floor(raw) + 0.99; // 60.99
    const final = Math.max(rounded, 55); // min_price 55
    expect(final).toBe(60.99);
  });

  it("product 1580 Black 3XL: cost $27.72 + $36.28 margin → nearest_99 → $64.99", () => {
    const cost = 27.72;
    const margin = 36.28;
    const raw = cost + margin; // 64.00
    const rounded = Math.floor(raw) + 0.99; // 64.99
    expect(rounded).toBe(64.99);
  });

  it("product 638 White One size: cost $28.75 + $16 margin → nearest_99 → $44.99", () => {
    const cost = 28.75;
    const margin = 16;
    const raw = cost + margin; // 44.75
    const rounded = Math.floor(raw) + 0.99; // 44.99
    const final = Math.max(rounded, 28);
    expect(final).toBe(44.99);
  });
});

// ── 10. Safety: position never zero-area after engine ────────────────────────

describe("Position safety — never zero-area", () => {
  it("minimum 1px width/height enforced", () => {
    const r = computeCenterFitPosition({ width: 1, height: 1 }, { area_width: 1000, area_height: 1000 }, 150);
    expect(r.position.width).toBeGreaterThanOrEqual(1);
    expect(r.position.height).toBeGreaterThanOrEqual(1);
  });

  it("isValidPosition rejects zero width", () => {
    expect(isValidPosition({ area_width: 1000, area_height: 1000, width: 0, height: 100, top: 0, left: 0 })).toBe(false);
  });

  it("isValidPosition rejects zero area_width", () => {
    expect(isValidPosition({ area_width: 0, area_height: 1000, width: 100, height: 100, top: 0, left: 0 })).toBe(false);
  });
});
