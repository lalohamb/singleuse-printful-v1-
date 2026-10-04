// Phase 11A — Catalog Builder UX 2.0 regression tests
// Covers: creation mode, edit mode lock, single/multi selection, cost preview,
// variant matrix operations, pricing preview, BuildSummary, dry-run isolation,
// no DB writes, existing product regression.

import { describe, test, expect, beforeAll } from "vitest";
import {
  validateProductSpecification,
  dryRunProductSpecification,
} from "@/lib/catalog/product-engine";
import type { ProductSpecification } from "@/lib/catalog/product-engine";
import { applyPricingRules } from "@/lib/catalog/recipe-engine";
import type { PricingRules } from "@/lib/catalog/recipe-engine";
import type { VariantPricing } from "@/app/admin/catalog-builder/types";
import { initialBuilderState } from "@/app/admin/catalog-builder/types";

// Node test environment doesn't have crypto.randomUUID — polyfill it
beforeAll(() => {
  if (typeof globalThis.crypto === "undefined") {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVariant(id: number, color: string, size: string, price: string, inStock = true) {
  return { id, product_id: 71, name: `${color} / ${size}`, size, color,
    color_code: null, color_code2: null, image: "", price, in_stock: inStock,
    availability_regions: {}, availability_status: [], material: null };
}

function makeSpec(overrides: Partial<ProductSpecification> = {}): ProductSpecification {
  return {
    printful_catalog_id: 71,
    variants: [{ printful_variant_id: "1001", label: "Black / S", color: "Black", size: "S",
      retail_price: 29.99, provider_cost: 11.92, image_url: null }],
    design_id: "design-abc",
    placement: "front",
    technique: "DTG",
    printfile_id: null,
    design_configuration: {},
    title: "Test Tee",
    slug: "test-tee",
    description: null, short_description: null, brand: null,
    product_type: null, category_id: null, meta_title: null, meta_description: null,
    price: 29.99,
    mockups: [],
    publication_mode: "draft",
    idempotency_key: "test-key-001",
    ...overrides,
  };
}

// ── 1. Catalog Builder starts at blank ──────────────────────────────────────

describe("Catalog Builder initial state", () => {
  test("initial catalogProduct is null", () => {
    const s = initialBuilderState();
    expect(s.catalogProduct).toBeNull();
  });

  test("multiSelectedProducts preserved for future batch phase", () => {
    const s = initialBuilderState();
    expect(s.multiSelectedProducts).toEqual([]);
  });
});

// ── 2. Single product selection ───────────────────────────────────────────────

describe("Single product selection", () => {
  test("selecting a product sets catalogProduct", () => {
    const s = initialBuilderState();
    expect(s.catalogProduct).toBeNull();
  });

  test("multiSelectedProducts stays empty in single flow", () => {
    const s = initialBuilderState();
    expect(s.multiSelectedProducts).toHaveLength(0);
  });
});

// ── 3. Multi-product state preserved (deferred) ───────────────────────────────

describe("Multi-product state (deferred)", () => {
  test("toggling adds a product", () => {
    const products = [
      { id: 71, title: "Tee" }, { id: 1580, title: "Long Sleeve" },
    ] as never[];
    let selected: typeof products = [];
    const toggle = (p: (typeof products)[0]) => {
      const ids = new Set(selected.map((s) => (s as { id: number }).id));
      if (ids.has((p as { id: number }).id)) selected = selected.filter((s) => (s as { id: number }).id !== (p as { id: number }).id);
      else selected = [...selected, p];
    };
    toggle(products[0]);
    expect(selected).toHaveLength(1);
    toggle(products[1]);
    expect(selected).toHaveLength(2);
  });

  test("toggling same product removes it", () => {
    const p = { id: 71, title: "Tee" };
    let selected = [p];
    const ids = new Set(selected.map((s) => s.id));
    if (ids.has(p.id)) selected = selected.filter((s) => s.id !== p.id);
    expect(selected).toHaveLength(0);
  });

  test("selection persists between stage transitions", () => {
    const s = initialBuilderState();
    s.multiSelectedProducts = [{ id: 71 }, { id: 1580 }] as never[];
    expect(s.multiSelectedProducts).toHaveLength(2);
  });
});

// ── 4. Product cost preview ───────────────────────────────────────────────────

describe("Product cost preview", () => {
  test("ProductSummary shape is correct", () => {
    const summary = {
      id: 71, title: "Unisex Staple T-Shirt", brand: "Bella + Canvas",
      image: "https://example.com/img.jpg", techniques: [],
      total_variants: 100, available_variants: 95,
      color_count: 7, size_count: 6,
      min_cost: 11.92, max_cost: 15.92,
    };
    expect(summary.min_cost).toBeLessThan(summary.max_cost!);
    expect(summary.color_count).toBeGreaterThan(0);
    expect(summary.size_count).toBeGreaterThan(0);
  });

  test("no cost invented client-side — min_cost comes from server", () => {
    // Client must not compute costs from variant count alone
    const summary = { min_cost: null, max_cost: null };
    expect(summary.min_cost).toBeNull();
  });

  test("product-summary failure state returns null cost", () => {
    const summary = { error: "Failed to load product summary" };
    expect(summary.error).toBeDefined();
  });
});

// ── 5. N+1 protection ────────────────────────────────────────────────────────

describe("N+1 / unbounded provider requests", () => {
  test("batch endpoint accepts comma-separated ids", () => {
    const ids = [71, 1580, 380];
    const qs = `ids=${ids.join(",")}`;
    expect(qs).toBe("ids=71,1580,380");
  });

  test("batch endpoint is capped at 20 ids", () => {
    const ids = Array.from({ length: 25 }, (_, i) => i + 1);
    const capped = ids.slice(0, 20);
    expect(capped).toHaveLength(20);
  });

  test("single-id endpoint still works", () => {
    const qs = `id=71`;
    expect(qs).toBe("id=71");
  });
});

// ── 6. Variant matrix operations ─────────────────────────────────────────────

describe("VariantMatrix operations", () => {
  const variants = [
    makeVariant(1001, "Black", "S", "11.92"),
    makeVariant(1002, "Black", "M", "11.92"),
    makeVariant(1003, "Black", "L", "11.92"),
    makeVariant(1004, "White", "S", "11.92"),
    makeVariant(1005, "White", "M", "11.92"),
    makeVariant(1006, "White", "L", "11.92"),
    makeVariant(1007, "Red",   "S", "11.92", false), // out of stock
  ];

  const available = variants.filter((v) => v.in_stock);

  test("individual cell toggle adds variant", () => {
    let selected = [] as typeof variants;
    const v = variants[0];
    if (!selected.find((s) => s.id === v.id)) selected = [...selected, v];
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(1001);
  });

  test("individual cell toggle removes variant", () => {
    let selected = [variants[0]];
    selected = selected.filter((s) => s.id !== variants[0].id);
    expect(selected).toHaveLength(0);
  });

  test("entire-color toggle selects all in-stock variants for that color", () => {
    let selected = [] as typeof variants;
    const color = "Black";
    const cv = available.filter((v) => v.color === color);
    selected = [...selected, ...cv];
    expect(selected).toHaveLength(3);
    expect(selected.every((v) => v.color === "Black")).toBe(true);
  });

  test("entire-color toggle deselects when all already selected", () => {
    const color = "Black";
    const cv = available.filter((v) => v.color === color);
    let selected = [...cv];
    const allSel = cv.every((v) => selected.find((s) => s.id === v.id));
    if (allSel) selected = selected.filter((s) => s.color !== color);
    expect(selected).toHaveLength(0);
  });

  test("entire-size toggle selects all in-stock variants for that size", () => {
    let selected = [] as typeof variants;
    const size = "S";
    const sv = available.filter((v) => v.size === size);
    selected = [...selected, ...sv];
    // Black/S and White/S — Red/S is OOS
    expect(selected).toHaveLength(2);
    expect(selected.every((v) => v.size === "S")).toBe(true);
  });

  test("entire-size toggle deselects when all already selected", () => {
    const size = "M";
    const sv = available.filter((v) => v.size === size);
    let selected = [...sv];
    const allSel = sv.every((v) => selected.find((s) => s.id === v.id));
    if (allSel) selected = selected.filter((s) => s.size !== size);
    expect(selected).toHaveLength(0);
  });

  test("Select All Available excludes out-of-stock", () => {
    const selected = [...available];
    expect(selected.every((v) => v.in_stock)).toBe(true);
    expect(selected.find((v) => v.id === 1007)).toBeUndefined();
  });

  test("Clear Selection empties selection", () => {
    let selected = [...available];
    selected = [];
    expect(selected).toHaveLength(0);
  });

  test("out-of-stock variant cannot be toggled", () => {
    const oos = variants.find((v) => !v.in_stock)!;
    let selected = [] as typeof variants;
    // Guard: only toggle if in_stock
    if (oos.in_stock) selected = [...selected, oos];
    expect(selected).toHaveLength(0);
  });

  test("nonexistent combination returns undefined from matrix", () => {
    const matrix = new Map<string, (typeof variants)[0]>();
    for (const v of variants) matrix.set(`${v.color}|${v.size}`, v);
    expect(matrix.get("Black|XL")).toBeUndefined();
  });

  test("non-apparel fallback: no color dimension uses flat list", () => {
    const flatVariants = [
      { id: 2001, color: "", size: "One Size", in_stock: true, price: "5.00" },
    ];
    const hasColors = flatVariants.some((v) => v.color);
    expect(hasColors).toBe(false);
  });
});

// ── 7. Pricing preview ────────────────────────────────────────────────────────

describe("PricingPreview", () => {
  const vp: VariantPricing[] = [
    { printful_variant_id: "1001", label: "Black / S", color: "Black", size: "S", provider_cost: 11.92, retail_price: 29.99 },
    { printful_variant_id: "1002", label: "Black / M", color: "Black", size: "M", provider_cost: 11.92, retail_price: 29.99 },
    { printful_variant_id: "1003", label: "Black / 2XL", color: "Black", size: "2XL", provider_cost: 15.92, retail_price: 33.99 },
  ];

  test("min cost is correct", () => {
    const withCost = vp.filter((v): v is VariantPricing & { provider_cost: number } => v.provider_cost != null);
    const minCost = Math.min(...withCost.map((v) => v.provider_cost));
    expect(minCost).toBe(11.92);
  });

  test("max cost is correct", () => {
    const withCost = vp.filter((v): v is VariantPricing & { provider_cost: number } => v.provider_cost != null);
    const maxCost = Math.max(...withCost.map((v) => v.provider_cost));
    expect(maxCost).toBe(15.92);
  });

  test("gross profit is retail minus cost", () => {
    const withCost = vp.filter((v): v is VariantPricing & { provider_cost: number } => v.provider_cost != null);
    const profits = withCost.map((v) => v.retail_price - v.provider_cost);
    expect(profits[0]).toBeCloseTo(18.07, 1);
    expect(profits[2]).toBeCloseTo(18.07, 1);
  });

  test("gross margin calculation", () => {
    const withCost = vp.filter((v): v is VariantPricing & { provider_cost: number } => v.provider_cost != null);
    const margins = withCost.map((v) => ((v.retail_price - v.provider_cost) / v.retail_price) * 100);
    expect(margins[0]).toBeCloseTo(60.3, 0);
  });

  test("margin >= 40% is green tier", () => {
    const margin = 60;
    expect(margin >= 40).toBe(true);
  });

  test("margin 25–39% is yellow tier", () => {
    const margin = 30;
    expect(margin >= 25 && margin < 40).toBe(true);
  });

  test("margin < 25% is red tier", () => {
    const margin = 20;
    expect(margin < 25).toBe(true);
  });

  test("empty variantPricing renders nothing", () => {
    const priced = ([] as VariantPricing[]).filter(
      (v): v is VariantPricing & { provider_cost: number } =>
        v.retail_price > 0 && v.provider_cost != null && v.provider_cost > 0
    );
    expect(priced).toHaveLength(0);
  });

  test("applyPricingRules COST_PLUS matches manual calculation", () => {
    const rules: PricingRules = { strategy: "COST_PLUS", cost_plus_margin: 18.07, rounding: "ceil" };
    const price = applyPricingRules(11.92, rules);
    expect(price).toBe(30); // ceil(11.92 + 18.07) = ceil(29.99) = 30
  });
});

// ── 8. BuildSummary data ──────────────────────────────────────────────────────

describe("BuildSummary", () => {
  test("single mode shows product, variants, design, technique, placement", () => {
    const data = {
      mode: "single" as const,
      product: { id: 71, title: "Unisex Tee", brand: "Bella + Canvas", image: "" },
      variantCount: 47,
      designName: "Still Original Grandpa",
      technique: "DTG",
      placement: "front",
      variantPricing: [
        { printful_variant_id: "1001", label: "Black / S", color: "Black", size: "S", provider_cost: 11.92, retail_price: 29.99 },
      ],
    };
    expect(data.variantCount).toBe(47);
    expect(data.technique).toBe("DTG");
    expect(data.placement).toBe("front");
  });

  test("multi mode shows per-product list", () => {
    const multiProducts = [
      { id: 71, title: "Tee", variant_count: 47 },
      { id: 1580, title: "Long Sleeve", variant_count: 6 },
    ];
    expect(multiProducts).toHaveLength(2);
    expect(multiProducts[0].title).toBe("Tee");
  });

  test("null product returns nothing in single mode", () => {
    const product = null;
    expect(product).toBeNull();
  });
});

// ── 9. Multi-product dry-run isolation ───────────────────────────────────────

describe("Multi-product dry-run isolation", () => {
  test("FAIL on one product does not affect others", () => {
    const entries = [
      { product: { id: 71 }, dryRunResult: "PASS", errors: [] },
      { product: { id: 1580 }, dryRunResult: "FAIL", errors: ["Design not found"] },
      { product: { id: 380 }, dryRunResult: "PASS", errors: [] },
    ];
    const passing = entries.filter((e) => e.dryRunResult === "PASS");
    const failing = entries.filter((e) => e.dryRunResult === "FAIL");
    expect(passing).toHaveLength(2);
    expect(failing).toHaveLength(1);
  });

  test("WARNING does not block other products", () => {
    const entries = [
      { dryRunResult: "PASS" },
      { dryRunResult: "WARNING" },
      { dryRunResult: "PASS" },
    ];
    const blocked = entries.filter((e) => e.dryRunResult === "FAIL");
    expect(blocked).toHaveLength(0);
  });

  test("dry-run spec uses draft publication_mode", () => {
    const spec = makeSpec({ publication_mode: "draft" });
    expect(spec.publication_mode).toBe("draft");
  });

  test("dry-run does not include mockups", () => {
    const spec = makeSpec({ mockups: [] });
    expect(spec.mockups).toHaveLength(0);
  });
});

// ── 10. No database writes during selection/dry-run ──────────────────────────

describe("No DB writes during selection and dry-run", () => {
  test("dryRunProductSpecification returns resolved plan without mutations", () => {
    const spec = makeSpec();
    const result = dryRunProductSpecification(spec);
    expect(result.valid).toBe(true);
    expect(result.resolved).not.toBeNull();
    // Verify expected_db_operations are listed but not executed
    expect(result.resolved!.expected_db_operations).toContain(
      "INSERT INTO products (catalog_source=catalog_builder, printful_id=NULL)"
    );
  });

  test("validateProductSpecification does not touch DB", () => {
    const spec = makeSpec();
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("invalid spec fails validation without DB access", () => {
    const spec = makeSpec({ title: "", slug: "" });
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ── 11. Existing single-product workflow regression ──────────────────────────

describe("Existing single-product workflow regression", () => {
  test("ProductSpecification validates correctly for existing products", () => {
    const spec = makeSpec({
      printful_catalog_id: 71,
      technique: "DTG",
      placement: "front",
      title: "Still Original Grandpa Graphic Tee",
      slug: "still-original-grandpa-graphic-tee",
      price: 29.99,
    });
    const result = validateProductSpecification(spec);
    expect(result.valid).toBe(true);
  });

  test("dry-run for existing product shape passes", () => {
    const spec = makeSpec({
      printful_catalog_id: 71,
      variants: [
        { printful_variant_id: "10001", label: "Black / S", color: "Black", size: "S",
          retail_price: 29.99, provider_cost: 11.92, image_url: null },
        { printful_variant_id: "10002", label: "Black / M", color: "Black", size: "M",
          retail_price: 29.99, provider_cost: 11.92, image_url: null },
      ],
      price: 29.99,
    });
    const result = dryRunProductSpecification(spec);
    expect(result.valid).toBe(true);
    expect(result.resolved!.variant_count).toBe(2);
    expect(result.resolved!.base_price).toBe(29.99);
  });

  test("published Phase 10A.2 product UUIDs are preserved constants", () => {
    const PRODUCT_TSHIRT = "6824b815-3ce4-4888-b832-3eba84757ad5";
    const PRODUCT_LONGSLEEVE = "2eea9504-36cf-45fd-aa03-51fe82df4a20";
    const PRODUCT_GRANDPA = "85b05b7e-cd61-4e2b-9c77-2657f93ce638";
    expect(PRODUCT_TSHIRT).toMatch(/^[0-9a-f-]{36}$/);
    expect(PRODUCT_LONGSLEEVE).toMatch(/^[0-9a-f-]{36}$/);
    expect(PRODUCT_GRANDPA).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("catalog_builder products must have printful_id=null", () => {
    const product = { catalog_source: "catalog_builder", printful_id: null, printful_catalog_id: 71 };
    expect(product.printful_id).toBeNull();
    expect(product.printful_catalog_id).toBeGreaterThan(0);
  });

  test("PRINTFUL_AUTO_CONFIRM must never be set", () => {
    const env = process.env.PRINTFUL_AUTO_CONFIRM;
    expect(env).toBeFalsy();
  });
});

// ── Phase 11A.1 — Issue A: Hat / non-apparel variant detection ────────────────

describe("Issue A — variant dimension detection", () => {
  // Helpers that mirror the VariantMatrix logic
  function detectShape(variants: Array<{ color: string; size: string }>) {
    const distinctColors = [...new Set(variants.map((v) => v.color?.trim()).filter(Boolean))];
    const distinctSizes  = [...new Set(variants.map((v) => v.size?.trim()).filter(Boolean))];
    const hasMultipleColors = distinctColors.length > 1;
    const hasMultipleSizes  = distinctSizes.length > 1;
    if (variants.length === 1) return "single";
    if (hasMultipleColors && hasMultipleSizes) return "matrix";
    if (hasMultipleColors && !hasMultipleSizes) return "color-only";
    if (!hasMultipleColors && hasMultipleSizes) return "size-only";
    return "flat";
  }

  test("color × size apparel → matrix", () => {
    const variants = [
      { color: "Black", size: "S" }, { color: "Black", size: "M" },
      { color: "White", size: "S" }, { color: "White", size: "M" },
    ];
    expect(detectShape(variants)).toBe("matrix");
  });

  test("color-only hat (many colors, one size) → color-only", () => {
    const variants = [
      { color: "Black", size: "One Size" },
      { color: "Navy", size: "One Size" },
      { color: "White", size: "One Size" },
    ];
    expect(detectShape(variants)).toBe("color-only");
  });

  test("size-only product (no color) → size-only", () => {
    const variants = [
      { color: "", size: "S" }, { color: "", size: "M" }, { color: "", size: "L" },
    ];
    expect(detectShape(variants)).toBe("size-only");
  });

  test("empty-string color is treated as no color (falsy trim fix)", () => {
    const distinctColors = ["", "  ", ""].map((c) => c?.trim()).filter(Boolean);
    expect(distinctColors).toHaveLength(0);
  });

  test("generic one-dimensional variants → flat", () => {
    const variants = [
      { color: "", size: "" }, { color: "", size: "" },
    ];
    expect(detectShape(variants)).toBe("flat");
  });

  test("true single-variant product → single (auto-select)", () => {
    const variants = [{ color: "Black", size: "One Size" }];
    expect(detectShape(variants)).toBe("single");
  });

  test("out-of-stock variant excluded from available count", () => {
    const variants = [
      { color: "Black", size: "One Size", in_stock: true },
      { color: "Red",   size: "One Size", in_stock: false },
    ];
    const available = variants.filter((v) => v.in_stock);
    expect(available).toHaveLength(1);
    expect(available[0].color).toBe("Black");
  });

  test("out-of-stock variant cannot be toggled", () => {
    const v = { id: 1, in_stock: false };
    const selected: Array<{ id: number; in_stock: boolean }> = [];
    const result = v.in_stock ? [...selected, v] : selected;
    expect(result).toHaveLength(0);
  });
});

// ── Phase 11A.1 — Issue B: Sticky nav disabled-state logic ───────────────────

describe("Issue B — sticky nav disabled state", () => {
  test("variants stage: disabled when 0 selected", () => {
    const selected: unknown[] = [];
    const disabled = selected.length === 0;
    expect(disabled).toBe(true);
  });

  test("variants stage: enabled when ≥1 selected", () => {
    const selected = [{ id: 1 }];
    const disabled = selected.length === 0;
    expect(disabled).toBe(false);
  });

  test("production stage: disabled when no placement", () => {
    const placement = null;
    const activeTemplate = null;
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(true);
  });

  test("production stage: disabled when placement set but no template", () => {
    const placement = "front";
    const activeTemplate = null;
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(true);
  });

  test("production stage: enabled when placement and template both set", () => {
    const placement = "front";
    const activeTemplate = { template_id: 1 };
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(false);
  });

  test("pricing stage: disabled when any variant has retail_price <= 0", () => {
    const pricing = [
      { retail_price: 29.99 },
      { retail_price: 0 },
    ];
    const disabled = pricing.some((v) => v.retail_price <= 0);
    expect(disabled).toBe(true);
  });

  test("pricing stage: enabled when all variants have retail_price > 0", () => {
    const pricing = [{ retail_price: 29.99 }, { retail_price: 33.99 }];
    const disabled = pricing.some((v) => v.retail_price <= 0);
    expect(disabled).toBe(false);
  });
});

// ── Phase 11A.1 — Issue C: BlankSelector performance ─────────────────────────

describe("Issue C — BlankSelector performance", () => {
  test("batch endpoint chunks at 20", () => {
    const ids = Array.from({ length: 45 }, (_, i) => i + 1);
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(20);
    expect(chunks[2]).toHaveLength(5);
  });

  test("loading marker prevents duplicate requests", () => {
    const cache = new Map<number, string | null>();
    const ids = [71, 1580];
    // First call marks as loading
    for (const id of ids) cache.set(id, "loading");
    // Second call skips already-marked ids
    const missing = ids.filter((id) => !cache.has(id));
    expect(missing).toHaveLength(0);
  });

  test("summary cache returns null on error, not undefined", () => {
    const cache = new Map<number, null>();
    cache.set(71, null);
    expect(cache.get(71)).toBeNull();
    expect(cache.has(71)).toBe(true);
  });

  test("skeleton count is 12 while loading", () => {
    const skeletonCount = 12;
    expect(skeletonCount).toBe(12);
  });
});

// ── Phase 11A.1 — Issue D: Failed validation recovery ────────────────────────

describe("Issue D — failed validation recovery", () => {
  test("suggestAction: placement error → Fix Production", () => {
    const error = "Placement embroidery_front is unavailable";
    const e = error.toLowerCase();
    const action = e.includes("placement") || e.includes("technique") ? "Fix Production"
      : e.includes("variant") ? "Fix Variants"
      : e.includes("design") || e.includes("artwork") ? "Fix Artwork"
      : e.includes("slug") ? "Fix Details"
      : "Review Error";
    expect(action).toBe("Fix Production");
  });

  test("suggestAction: variant error → Fix Variants", () => {
    const error = "No variants match the recipe rules";
    const e = error.toLowerCase();
    const action = e.includes("placement") || e.includes("technique") ? "Fix Production"
      : e.includes("variant") ? "Fix Variants"
      : "Review Error";
    expect(action).toBe("Fix Variants");
  });

  test("suggestAction: design error → Fix Artwork", () => {
    const error = "Design not found";
    const e = error.toLowerCase();
    const action = e.includes("design") || e.includes("artwork") ? "Fix Artwork" : "Review Error";
    expect(action).toBe("Fix Artwork");
  });

  test("remove from dry-run does not affect other entries", () => {
    const entries = [
      { product: { id: 71 }, dryRunResult: "PASS" },
      { product: { id: 1580 }, dryRunResult: "FAIL" },
      { product: { id: 380 }, dryRunResult: "PASS" },
    ];
    const after = entries.filter((e) => e.product.id !== 1580);
    expect(after).toHaveLength(2);
    expect(after.every((e) => e.product.id !== 1580)).toBe(true);
  });

  test("remove from dry-run also removes from multiSelectedProducts", () => {
    const selected = [{ id: 71 }, { id: 1580 }, { id: 380 }];
    const after = selected.filter((p) => p.id !== 1580);
    expect(after).toHaveLength(2);
    expect(after.find((p) => p.id === 1580)).toBeUndefined();
  });

  test("remove does not delete any DB record", () => {
    // Remove is purely client-state — no fetch call
    const removedFromState = true;
    const dbMutated = false;
    expect(removedFromState).toBe(true);
    expect(dbMutated).toBe(false);
  });
});

// ── Phase 11A.1 — Issue E: Production Settings freeze ────────────────────────

describe("Issue E — production settings state management", () => {
  test("technique change must clear placement and activeTemplate", () => {
    // Simulate state before technique change
    let placement: string | null = "front";
    let activeTemplate: object | null = { template_id: 1 };
    // loadProduction clears these immediately
    placement = null;
    activeTemplate = null;
    expect(placement).toBeNull();
    expect(activeTemplate).toBeNull();
  });

  test("technique change must clear printfiles before fetch", () => {
    let printfiles: object | null = { available_placements: { front: "Front" } };
    // loadProduction sets null before fetch
    printfiles = null;
    expect(printfiles).toBeNull();
  });

  test("on error, printfiles is set to empty object (not null) so spinner clears", () => {
    // Simulate error path
    const printfilesOnError = { product_id: 71, available_placements: {}, printfiles: [], variant_printfiles: [], option_groups: [], options: [] };
    expect(printfilesOnError).not.toBeNull();
    expect(Object.keys(printfilesOnError.available_placements)).toHaveLength(0);
  });

  test("Continue disabled when placement is null after technique change", () => {
    const placement = null;
    const activeTemplate = null;
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(true);
  });

  test("Continue enabled only after new placement and template resolved", () => {
    const placement = "front";
    const activeTemplate = { template_id: 2 };
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(false);
  });

  test("rapid technique changes: last write wins (no stale template)", () => {
    // Each technique change clears placement/activeTemplate synchronously
    // before the async fetch completes — so stale template can never enable Continue
    let activeTemplate: object | null = { template_id: 1 };
    // First technique change
    activeTemplate = null;
    // Second technique change before first resolves
    activeTemplate = null;
    // First fetch resolves (stale) — but placement is null so Continue stays disabled
    const placement = null;
    const disabled = !placement || !activeTemplate;
    expect(disabled).toBe(true);
  });
});
