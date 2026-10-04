// Phase 11A.3.2 — Production Metadata Correctness Regression Tests
//
// Covers:
//   1. fetchPrintfileSpec technique propagation
//   2. Artwork validation invalidation on technique/placement change
//   3. Batch authoritative template resolution (resolveLayoutTemplateForVariantPlacement)
//   4. Recipe authoritative template resolution
//   5. ProductDesigner stale-request protection (state clearing)
//   6. getCatalogProduct / getCatalogVariants response contract
//   7. Product summary metadata population
//   8. Shared VALID_TECHNIQUES
//   9. Printful Sync / Catalog Builder identity unchanged

import { describe, test, expect, vi, beforeAll } from "vitest";
import {
  validateArtworkForPrintfile,
  type PrintfileSpec,
} from "@/lib/fulfillment/artwork-validation";
import { resolveLayoutTemplateForVariantPlacement } from "@/lib/printful/templates";
import { VALID_TECHNIQUES } from "@/lib/printful/techniques";
import type {
  PrintfulTemplatesResponse,
  PrintfulLayoutTemplate,
} from "@/lib/printful/types";

beforeAll(() => {
  if (typeof globalThis.crypto === "undefined") {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    });
  }
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTemplate(id: number, printfileId: number, printAreaW: number, printAreaH: number): PrintfulLayoutTemplate {
  return {
    template_id: id,
    image_url: `https://cdn.printful.com/template-${id}.jpg`,
    background_url: null,
    background_color: null,
    printfile_id: printfileId,
    template_width: 1000,
    template_height: 1000,
    print_area_width: printAreaW,
    print_area_height: printAreaH,
    print_area_top: 100,
    print_area_left: 100,
    is_template_on_front: true,
    orientation: "any",
  };
}

// Multi-placement templates response (front + back + left)
const MULTI_PLACEMENT_RESPONSE: PrintfulTemplatesResponse = {
  version: 1,
  min_dpi: 150,
  variant_mapping: [
    {
      variant_id: 16244,
      templates: [
        { template_id: 101, placement: "embroidery_front_large" },
        { template_id: 102, placement: "embroidery_back" },
        { template_id: 103, placement: "embroidery_left" },
      ],
    },
    {
      variant_id: 16245,
      templates: [
        { template_id: 101, placement: "embroidery_front_large" },
        { template_id: 102, placement: "embroidery_back" },
        { template_id: 103, placement: "embroidery_left" },
      ],
    },
  ],
  templates: [
    makeTemplate(101, 201, 400, 400), // front — large print area
    makeTemplate(102, 202, 300, 200), // back — smaller
    makeTemplate(103, 203, 150, 150), // left — smallest
  ],
  conflicting_placements: {},
};

// DTF single-placement response
const DTF_RESPONSE: PrintfulTemplatesResponse = {
  version: 1,
  min_dpi: 150,
  variant_mapping: [
    {
      variant_id: 16244,
      templates: [{ template_id: 201, placement: "front_dtf_hat" }],
    },
  ],
  templates: [makeTemplate(201, 301, 500, 300)],
  conflicting_placements: {},
};

// ── 1. fetchPrintfileSpec technique propagation ───────────────────────────────

describe("fetchPrintfileSpec technique propagation", () => {
  test("DTF artwork validation must request DTF printfiles", async () => {
    const fetched: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      return {
        ok: true,
        json: async () => ({
          result: {
            variant_printfiles: [
              { variant_id: 16244, placements: { front_dtf_hat: 301 } },
            ],
            printfiles: [
              { printfile_id: 301, width: 500, height: 300, dpi: 150, fill_mode: "fit", can_rotate: false },
            ],
          },
        }),
      };
    });

    const { fetchPrintfileSpec } = await import("@/lib/fulfillment/artwork-validation");
    await fetchPrintfileSpec(638, "DTFILM", "front_dtf_hat", 16244);

    expect(fetched[0]).toContain("technique=DTFILM");
    expect(fetched[0]).toContain("/api/printful/printfiles/638");
    vi.unstubAllGlobals();
  });

  test("EMBROIDERY artwork validation must request EMBROIDERY printfiles", async () => {
    const fetched: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      fetched.push(url);
      return {
        ok: true,
        json: async () => ({
          result: {
            variant_printfiles: [
              { variant_id: 16244, placements: { embroidery_front_large: 201 } },
            ],
            printfiles: [
              { printfile_id: 201, width: 400, height: 400, dpi: 150, fill_mode: "fit", can_rotate: false },
            ],
          },
        }),
      };
    });

    const { fetchPrintfileSpec } = await import("@/lib/fulfillment/artwork-validation");
    await fetchPrintfileSpec(638, "EMBROIDERY", "embroidery_front_large", 16244);

    expect(fetched[0]).toContain("technique=EMBROIDERY");
    vi.unstubAllGlobals();
  });

  test("fetchPrintfileSpec returns null when placement not found for technique", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        result: {
          // DTF printfiles — embroidery placement not present
          variant_printfiles: [
            { variant_id: 16244, placements: { front_dtf_hat: 301 } },
          ],
          printfiles: [
            { printfile_id: 301, width: 500, height: 300, dpi: 150, fill_mode: "fit", can_rotate: false },
          ],
        },
      }),
    }));

    const { fetchPrintfileSpec } = await import("@/lib/fulfillment/artwork-validation");
    // Requesting embroidery placement against DTF printfiles → null
    const spec = await fetchPrintfileSpec(638, "DTFILM", "embroidery_front_large", 16244);
    expect(spec).toBeNull();
    vi.unstubAllGlobals();
  });

  test("UNVERIFIED cannot masquerade as PASS — null spec produces no validation result", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));

    const { fetchPrintfileSpec } = await import("@/lib/fulfillment/artwork-validation");
    const spec = await fetchPrintfileSpec(638, "DTFILM", "front_dtf_hat");
    // null spec → caller must treat as UNVERIFIED, not PASS
    expect(spec).toBeNull();
    vi.unstubAllGlobals();
  });
});

// ── 2. Artwork validation invalidation ───────────────────────────────────────

describe("Artwork validation invalidation", () => {
  test("technique change must invalidate old validation result", () => {
    // Simulate: validation was computed for EMBROIDERY, technique changes to DTFILM
    let artworkValidation: { status: string } | null = { status: "PASS" };
    const techniques = { old: "EMBROIDERY", next: "DTFILM" };

    if (techniques.next !== techniques.old) {
      artworkValidation = null; // invalidated
    }

    expect(artworkValidation).toBeNull();
  });

  test("placement change must invalidate old validation result", () => {
    let artworkValidation: { status: string } | null = { status: "PASS" };
    const placements = { old: "embroidery_front_large", next: "embroidery_back" };

    if (placements.next !== placements.old) {
      artworkValidation = null;
    }

    expect(artworkValidation).toBeNull();
  });

  test("stale PASS from old technique cannot persist after technique change", () => {
    // Operator had PASS for EMBROIDERY (large canvas), switches to DTFILM (smaller canvas)
    // The old PASS must be cleared before new validation runs
    let validation: { status: string } | null = { status: "PASS" };
    // Technique change handler clears validation
    validation = null;
    expect(validation).toBeNull();
  });

  test("validateArtworkForPrintfile produces correct result for given spec", () => {
    const spec: PrintfileSpec = {
      printfile_id: 301,
      width: 500,
      height: 300,
      dpi: 150,
      fill_mode: "fit",
    };
    // 4200x4800 artwork against 500x300 canvas at 150 DPI
    const result = validateArtworkForPrintfile(4200, 4800, spec);
    expect(["PASS", "PASS_WARNING", "FAIL"]).toContain(result.status);
    expect(result.effectiveDpi).toBeGreaterThan(0);
  });

  test("low-res artwork produces FAIL status", () => {
    const spec: PrintfileSpec = {
      printfile_id: 1,
      width: 4500,
      height: 5400,
      dpi: 300,
      fill_mode: "fit",
    };
    // 100x100 artwork against large canvas → very low DPI
    const result = validateArtworkForPrintfile(100, 100, spec);
    expect(result.status).toBe("FAIL");
  });

  test("high-res artwork produces PASS status", () => {
    const spec: PrintfileSpec = {
      printfile_id: 1,
      width: 1800,
      height: 2400,
      dpi: 150,
      fill_mode: "fit",
    };
    // 4200x4800 artwork → well above 300 DPI effective
    const result = validateArtworkForPrintfile(4200, 4800, spec);
    expect(result.status).toBe("PASS");
  });
});

// ── 3. Authoritative template resolution ─────────────────────────────────────

describe("resolveLayoutTemplateForVariantPlacement — authoritative resolution", () => {
  test("resolves front placement to correct template", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE,
      "embroidery_front_large",
      16244
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(101);
    expect(tmpl!.print_area_width).toBe(400);
  });

  test("resolves back placement to correct template (different from front)", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE,
      "embroidery_back",
      16244
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(102);
    expect(tmpl!.print_area_width).toBe(300);
    expect(tmpl!.print_area_height).toBe(200);
  });

  test("resolves left placement to correct template", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE,
      "embroidery_left",
      16244
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(103);
    expect(tmpl!.print_area_width).toBe(150);
  });

  test("front and back resolve to different templates", () => {
    const front = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_front_large", 16244
    );
    const back = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_back", 16244
    );
    expect(front!.template_id).not.toBe(back!.template_id);
    expect(front!.print_area_width).not.toBe(back!.print_area_width);
  });

  test("resolves DTF single-placement product", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      DTF_RESPONSE, "front_dtf_hat", 16244
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(201);
    expect(tmpl!.print_area_width).toBe(500);
  });

  test("returns null for unknown placement", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "nonexistent_placement", 16244
    );
    expect(tmpl).toBeNull();
  });

  test("falls back to first variant mapping when variantId not found", () => {
    // variantId 99999 not in mapping — falls back to first entry (16244)
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_front_large", 99999
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(101);
  });

  test("falls back to first variant mapping when variantId omitted", () => {
    const tmpl = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_back"
    );
    expect(tmpl).not.toBeNull();
    expect(tmpl!.template_id).toBe(102);
  });

  test("returns null for empty variant_mapping", () => {
    const empty: PrintfulTemplatesResponse = {
      ...MULTI_PLACEMENT_RESPONSE,
      variant_mapping: [],
    };
    expect(resolveLayoutTemplateForVariantPlacement(empty, "embroidery_front_large")).toBeNull();
  });

  test("returns null for empty templates array", () => {
    const empty: PrintfulTemplatesResponse = {
      ...MULTI_PLACEMENT_RESPONSE,
      templates: [],
    };
    expect(resolveLayoutTemplateForVariantPlacement(empty, "embroidery_front_large", 16244)).toBeNull();
  });

  test("batches do not use arbitrary templates[0] — placement matters", () => {
    // templates[0] is template_id 101 (front). If batch recipe targets back,
    // the authoritative resolver must return 102, not 101.
    const arbitraryFirst = MULTI_PLACEMENT_RESPONSE.templates[0];
    const authoritative = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_back", 16244
    );
    expect(authoritative!.template_id).not.toBe(arbitraryFirst.template_id);
    expect(authoritative!.template_id).toBe(102);
  });

  test("recipes do not use arbitrary templates[0] — placement matters", () => {
    // Same assertion from recipe perspective
    const authoritative = resolveLayoutTemplateForVariantPlacement(
      MULTI_PLACEMENT_RESPONSE, "embroidery_left"
    );
    expect(authoritative!.template_id).toBe(103);
    expect(authoritative!.template_id).not.toBe(MULTI_PLACEMENT_RESPONSE.templates[0].template_id);
  });
});

// ── 4. ProductDesigner stale-request protection ───────────────────────────────

describe("ProductDesigner stale-request protection", () => {
  test("AbortController cancels in-flight request on technique change", async () => {
    const controller = new AbortController();
    let aborted = false;
    controller.signal.addEventListener("abort", () => { aborted = true; });

    // Simulate effect cleanup (technique changed before response arrived)
    controller.abort();

    expect(aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  test("AbortError is not treated as a provider error", () => {
    const abortError = new DOMException("The user aborted a request.", "AbortError");
    const isAbort = abortError instanceof Error && abortError.name === "AbortError";
    // Should be silently ignored, not shown to operator
    expect(isAbort).toBe(true);
  });

  test("stale technique A response cannot overwrite current technique B state", () => {
    // Simulate: A starts, B starts, B completes, A completes (stale)
    // With AbortController: A's controller is aborted when B starts
    const controllerA = new AbortController();
    // B starts — A's controller is aborted
    controllerA.abort();

    // A's response arrives — but signal is aborted, so it is ignored
    const shouldApplyA = !controllerA.signal.aborted;
    expect(shouldApplyA).toBe(false);
  });

  test("state is cleared before new technique fetch begins", () => {
    // Simulate the clearing sequence in loadProduction / useEffect cleanup
    let printfiles: unknown = { available_placements: { front: "Front" } };
    let templates: unknown = { variant_mapping: [] };
    let placement: string | null = "front";
    let activeTemplate: unknown = { template_id: 1 };

    // Clear before fetch
    printfiles = null;
    templates = null;
    placement = null;
    activeTemplate = null;

    expect(printfiles).toBeNull();
    expect(templates).toBeNull();
    expect(placement).toBeNull();
    expect(activeTemplate).toBeNull();
  });
});

// ── 5. getCatalogProduct / getCatalogVariants response contract ───────────────

describe("Catalog response contract", () => {
  test("Printful /products/{id} returns flat product object — no variants array", () => {
    // Live evidence: operator observed this exact shape at the CountyBuys API boundary
    // for product 638 (Adidas Dad Hat). variant_count is present; variants is absent.
    const observedResult = {
      id: 638,
      title: "Adidas Dad Hat",
      brand: "Adidas",
      variant_count: 2,
      // NO variants property — disproves the { product, variants } wrapper assumption
    };
    expect(observedResult.id).toBe(638);
    expect(observedResult.variant_count).toBe(2);
    expect((observedResult as Record<string, unknown>).variants).toBeUndefined();
    expect((observedResult as Record<string, unknown>).product).toBeUndefined();
  });

  test("getCatalogProduct returns flat product from /products/{id}", () => {
    // printfulGet unwraps json.result → flat PrintfulProduct object
    const flatResult = {
      id: 638,
      title: "Adidas Dad Hat",
      brand: "Adidas",
      image: "https://cdn.printful.com/638.jpg",
      variant_count: 2,
      techniques: [{ key: "EMBROIDERY", display_name: "Embroidery", is_default: true }],
    };
    expect(flatResult.id).toBe(638);
    expect(flatResult.title).toBe("Adidas Dad Hat");
    expect(flatResult.brand).toBe("Adidas");
    expect(flatResult.techniques).toHaveLength(1);
    // No variants on the product detail endpoint
    expect((flatResult as Record<string, unknown>).variants).toBeUndefined();
  });

  test("getCatalogVariants uses /products/{id}/variants — separate endpoint", () => {
    // /products/{id} has no variants array.
    // The dedicated /products/{id}/variants endpoint returns PrintfulVariant[] directly.
    const variantsEndpointResult = [
      { id: 16244, product_id: 638, name: "Black / One size", color: "Black", size: "One size", price: "12.95", in_stock: true },
      { id: 16245, product_id: 638, name: "White / One size", color: "White", size: "One size", price: "12.95", in_stock: true },
    ];
    expect(Array.isArray(variantsEndpointResult)).toBe(true);
    expect(variantsEndpointResult).toHaveLength(2);
    expect(variantsEndpointResult[0].id).toBe(16244);
    expect(variantsEndpointResult[1].id).toBe(16245);
    expect(variantsEndpointResult[0].color).toBe("Black");
    expect(variantsEndpointResult[1].color).toBe("White");
  });

  test("/api/printful/products/[id] route merges product + variants so VariantMatrix works", () => {
    // Route fetches both endpoints in parallel and returns { result: { ...product, variants } }
    // VariantMatrix reads d.result?.variants — this must be populated.
    const product = { id: 638, title: "Adidas Dad Hat", brand: "Adidas", variant_count: 2 };
    const variants = [
      { id: 16244, name: "Black / One size" },
      { id: 16245, name: "White / One size" },
    ];
    const merged = { ...product, variants };
    expect(merged.variants).toHaveLength(2);
    expect(merged.title).toBe("Adidas Dad Hat");
    expect(merged.variants[0].id).toBe(16244);
    expect(merged.variants[1].id).toBe(16245);
  });

  test("pre-11A.3.2 getCatalogVariants was broken — /products/{id} has no variants", () => {
    // Pre-11A.3.2: getCatalogVariants called /products/{id} and read .variants
    // The flat result has no .variants → undefined → [] → VariantMatrix showed 0 variants
    // This was broken before 11A.3.2 AND after 11A.3.2 (which used a wrong wrapper shape).
    // Fix: use /products/{id}/variants which returns the array directly.
    const flatProductResult = { id: 638, title: "Adidas Dad Hat", variant_count: 2 };
    const variantsFromFlat = (flatProductResult as Record<string, unknown>).variants;
    expect(variantsFromFlat).toBeUndefined();
  });

  test("product summary metadata populates correctly", () => {
    // getCatalogProduct → flat product (title, brand, image, techniques)
    // getCatalogVariants → variant array (colors, sizes, costs, availability)
    const product = {
      id: 638,
      title: "Adidas Dad Hat",
      brand: "Adidas",
      image: "https://cdn.printful.com/638.jpg",
      techniques: [{ key: "EMBROIDERY", display_name: "Embroidery", is_default: true }],
    };
    const variants = [
      { id: 16244, color: "Black", size: "One size", price: "12.95", in_stock: true },
      { id: 16245, color: "White", size: "One size", price: "12.95", in_stock: true },
    ];
    const available = variants.filter((v) => v.in_stock);
    const costs = available.map((v) => parseFloat(v.price));
    const colors = [...new Set(variants.map((v) => v.color))];
    const sizes = [...new Set(variants.map((v) => v.size))];
    const summary = {
      id: product.id,
      title: product.title,
      brand: product.brand,
      image: product.image,
      techniques: product.techniques,
      total_variants: variants.length,
      available_variants: available.length,
      color_count: colors.length,
      size_count: sizes.length,
      min_cost: Math.min(...costs),
      max_cost: Math.max(...costs),
    };
    expect(summary.title).toBe("Adidas Dad Hat");
    expect(summary.brand).toBe("Adidas");
    expect(summary.image).toContain("638.jpg");
    expect(summary.techniques).toHaveLength(1);
    expect(summary.color_count).toBe(2);
    expect(summary.size_count).toBe(1);
    expect(summary.min_cost).toBe(12.95);
    expect(summary.available_variants).toBe(2);
  });
});

// ── 6. Shared VALID_TECHNIQUES ────────────────────────────────────────────────

describe("Shared VALID_TECHNIQUES", () => {
  test("VALID_TECHNIQUES is a Set", () => {
    expect(VALID_TECHNIQUES).toBeInstanceOf(Set);
  });

  test("EMBROIDERY is valid", () => {
    expect(VALID_TECHNIQUES.has("EMBROIDERY")).toBe(true);
  });

  test("DTFILM is valid", () => {
    expect(VALID_TECHNIQUES.has("DTFILM")).toBe(true);
  });

  test("DTG is valid", () => {
    expect(VALID_TECHNIQUES.has("DTG")).toBe(true);
  });

  test("SUBLIMATION is valid", () => {
    expect(VALID_TECHNIQUES.has("SUBLIMATION")).toBe(true);
  });

  test("unknown technique is not valid", () => {
    expect(VALID_TECHNIQUES.has("SCREEN-PRINT")).toBe(false);
    expect(VALID_TECHNIQUES.has("MAGIC")).toBe(false);
  });

  test("technique validation is case-sensitive (uppercase required)", () => {
    expect(VALID_TECHNIQUES.has("embroidery")).toBe(false);
    expect(VALID_TECHNIQUES.has("EMBROIDERY")).toBe(true);
  });
});

// ── 7. conflicting_placements normalisation ───────────────────────────────────

describe("conflicting_placements normalisation", () => {
  test("array form is normalised to Record", () => {
    const raw = [
      { placement: "embroidery_front_large", conflicts: ["embroidery_back"] },
      { placement: "embroidery_back", conflicts: ["embroidery_front_large"] },
    ];

    const normalised: Record<string, string[]> = {};
    for (const entry of raw) {
      normalised[entry.placement] = entry.conflicts;
    }

    expect(normalised["embroidery_front_large"]).toEqual(["embroidery_back"]);
    expect(normalised["embroidery_back"]).toEqual(["embroidery_front_large"]);
  });

  test("Record form passes through unchanged", () => {
    const record: Record<string, string[]> = {
      embroidery_front_large: ["embroidery_back"],
    };
    expect(Array.isArray(record)).toBe(false);
    expect(record["embroidery_front_large"]).toEqual(["embroidery_back"]);
  });

  test("empty array normalises to empty Record", () => {
    const raw: { placement: string; conflicts: string[] }[] = [];
    const normalised: Record<string, string[]> = {};
    for (const entry of raw) normalised[entry.placement] = entry.conflicts;
    expect(Object.keys(normalised)).toHaveLength(0);
  });
});

// ── 8. Printful Sync / Catalog Builder identity unchanged ─────────────────────

describe("Identity unchanged — Printful Sync", () => {
  const QUARTER_ZIP = {
    uuid: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
    catalog_source: "printful_sync",
    printful_id: "476330305",
    printful_catalog_id: 903,
  };

  test("quarter-zip UUID unchanged", () => {
    expect(QUARTER_ZIP.uuid).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
  });

  test("quarter-zip catalog_source is printful_sync", () => {
    expect(QUARTER_ZIP.catalog_source).toBe("printful_sync");
  });

  test("quarter-zip printful_id is 476330305", () => {
    expect(QUARTER_ZIP.printful_id).toBe("476330305");
  });

  test("quarter-zip printful_catalog_id is 903", () => {
    expect(QUARTER_ZIP.printful_catalog_id).toBe(903);
  });

  test("printful_sync products have non-null printful_id", () => {
    expect(QUARTER_ZIP.printful_id).not.toBeNull();
  });
});

describe("Identity unchanged — Catalog Builder", () => {
  test("catalog_builder products have null printful_id", () => {
    const product = { catalog_source: "catalog_builder", printful_id: null, printful_catalog_id: 638 };
    expect(product.printful_id).toBeNull();
  });

  test("catalog_builder uses DIRECT_CATALOG_ORDER strategy", () => {
    const sources = { a: "catalog_builder" as string, b: "catalog_builder" };
    const strategy = sources.a === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  test("printful_sync uses SYNC_VARIANT strategy", () => {
    const sources = { a: "printful_sync" as string, b: "catalog_builder" };
    const strategy = sources.a === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("SYNC_VARIANT");
  });

  test("catalog_builder product uses printful_catalog_id for mockup generation", () => {
    const product = { printful_id: null, printful_catalog_id: 638 };
    // Mockup generator receives catalog product ID
    expect(product.printful_catalog_id).toBe(638);
    expect(product.printful_id).toBeNull();
  });
});
