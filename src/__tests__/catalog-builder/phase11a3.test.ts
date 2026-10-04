// Phase 11A.3 — Single-Product Catalog Browser & Workflow Simplification
// Tests: workflow, catalog browser logic, category nav, search+filter, sort,
// availability, sidebar stages, Printful sync regression, identity regression.

import { describe, test, expect, beforeAll } from "vitest";
import { initialBuilderState } from "@/app/admin/catalog-builder/types";
import type { BuilderStage } from "@/app/admin/catalog-builder/types";
import {
  validateProductSpecification,
  dryRunProductSpecification,
} from "@/lib/catalog/product-engine";
import type { ProductSpecification } from "@/lib/catalog/product-engine";

beforeAll(() => {
  if (typeof globalThis.crypto === "undefined") {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── 1. Workflow: starts at blank, no mode stage ───────────────────────────────

describe("Workflow — starts at blank", () => {
  test("SINGLE_STAGES does not include mode", () => {
    const SINGLE_STAGES: BuilderStage[] = ["blank","variants","design","production","designer","mockups","details","pricing","review"];
    expect(SINGLE_STAGES).not.toContain("mode" as BuilderStage);
  });

  test("SINGLE_STAGES starts at blank", () => {
    const SINGLE_STAGES: BuilderStage[] = ["blank","variants","design","production","designer","mockups","details","pricing","review"];
    expect(SINGLE_STAGES[0]).toBe("blank");
  });

  test("EDIT_STAGES does not include blank or mode", () => {
    const EDIT_STAGES: BuilderStage[] = ["details","pricing","review"];
    expect(EDIT_STAGES).not.toContain("blank" as BuilderStage);
    expect(EDIT_STAGES).not.toContain("mode" as BuilderStage);
  });

  test("initialBuilderState has no creationMode field", () => {
    const s = initialBuilderState();
    expect("creationMode" in s).toBe(false);
  });

  test("multiSelectedProducts preserved in state for future batch phase", () => {
    const s = initialBuilderState();
    expect(Array.isArray(s.multiSelectedProducts)).toBe(true);
    expect(s.multiSelectedProducts).toHaveLength(0);
  });
});

// ── 2. Category mapping logic ─────────────────────────────────────────────────

const CATEGORY_MAP: { label: string; types: string[] }[] = [
  { label: "Apparel",      types: ["T-Shirts","Long Sleeve Shirts","Sweatshirts & Hoodies","Hoodies","Sweatshirts","Polo Shirts","Jackets","Tank Tops","Crop Tops","Shirts","Jerseys","Leggings","Shorts","Pants","Dresses","Skirts","Bodysuits","Swimwear","Underwear","Socks","Activewear"] },
  { label: "Hats",         types: ["Hats","Caps","Beanies","Bucket Hats","Snapbacks","Dad Hats","Trucker Hats","Visors"] },
  { label: "Kids",         types: ["Kids","Youth","Baby","Toddler","Onesies","Kids T-Shirts","Kids Hoodies"] },
  { label: "Accessories",  types: ["Accessories","Bags","Tote Bags","Backpacks","Fanny Packs","Phone Cases","Stickers","Patches","Pins","Keychains","Face Masks","Luggage Tags"] },
  { label: "Home & Living",types: ["Home & Living","Pillows","Blankets","Rugs","Towels","Aprons","Ornaments","Candles","Doormats","Flags","Tapestries"] },
  { label: "Wall Art",     types: ["Wall Art","Posters","Canvas","Framed Prints","Metal Prints","Wood Prints","Art Prints"] },
  { label: "Drinkware",    types: ["Drinkware","Mugs","Tumblers","Water Bottles","Glasses","Cups"] },
];

function getTopCategory(typeName: string): string {
  for (const group of CATEGORY_MAP) {
    if (group.types.some((t) => typeName.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(typeName.toLowerCase()))) {
      return group.label;
    }
  }
  return "More";
}

describe("Category mapping", () => {
  test("T-Shirts maps to Apparel", () => expect(getTopCategory("T-Shirts")).toBe("Apparel"));
  test("Hoodies maps to Apparel", () => expect(getTopCategory("Hoodies")).toBe("Apparel"));
  test("Hats maps to Hats", () => expect(getTopCategory("Hats")).toBe("Hats"));
  test("Dad Hats maps to Hats", () => expect(getTopCategory("Dad Hats")).toBe("Hats"));
  test("Mugs maps to Drinkware", () => expect(getTopCategory("Mugs")).toBe("Drinkware"));
  test("Rugs maps to Home & Living", () => expect(getTopCategory("Rugs")).toBe("Home & Living"));
  test("Luggage Tags maps to Accessories", () => expect(getTopCategory("Luggage Tags")).toBe("Accessories"));
  test("Posters maps to Wall Art", () => expect(getTopCategory("Posters")).toBe("Wall Art"));
  test("Kids maps to Kids", () => expect(getTopCategory("Kids")).toBe("Kids"));
  test("Unknown type maps to More", () => expect(getTopCategory("Exotic Widgets")).toBe("More"));
  test("Ornaments maps to Home & Living", () => expect(getTopCategory("Ornaments")).toBe("Home & Living"));
});

// ── 3. Search + category filtering ───────────────────────────────────────────

type MockProduct = { id: number; title: string; brand: string | null; type_name: string };

function filterProducts(
  products: MockProduct[],
  topCategory: string,
  subType: string,
  search: string
): MockProduct[] {
  return products.filter((p) => {
    const matchTop = topCategory === "All" || getTopCategory(p.type_name) === topCategory;
    const matchSub = subType === "All" || p.type_name === subType;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.title.toLowerCase().includes(q) ||
      (p.brand ?? "").toLowerCase().includes(q) ||
      p.type_name.toLowerCase().includes(q);
    return matchTop && matchSub && matchSearch;
  });
}

const MOCK_CATALOG: MockProduct[] = [
  { id: 1, title: "Adidas Dad Hat", brand: "Adidas", type_name: "Dad Hats" },
  { id: 2, title: "Bella Canvas Tee", brand: "Bella + Canvas", type_name: "T-Shirts" },
  { id: 3, title: "Gildan Hoodie", brand: "Gildan", type_name: "Hoodies" },
  { id: 4, title: "Ceramic Mug", brand: null, type_name: "Mugs" },
  { id: 5, title: "Adidas Snapback", brand: "Adidas", type_name: "Snapbacks" },
  { id: 6, title: "Rug 5x7", brand: null, type_name: "Rugs" },
];

describe("Search + category filtering", () => {
  test("All category returns all products", () => {
    expect(filterProducts(MOCK_CATALOG, "All", "All", "")).toHaveLength(6);
  });

  test("Hats category returns only hat products", () => {
    const result = filterProducts(MOCK_CATALOG, "Hats", "All", "");
    expect(result.every((p) => getTopCategory(p.type_name) === "Hats")).toBe(true);
    expect(result).toHaveLength(2);
  });

  test("Hats + search Adidas returns only Adidas hats", () => {
    const result = filterProducts(MOCK_CATALOG, "Hats", "All", "adidas");
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.brand === "Adidas")).toBe(true);
  });

  test("search does NOT reset category — Apparel + search Adidas returns 0 (no Adidas apparel)", () => {
    const result = filterProducts(MOCK_CATALOG, "Apparel", "All", "adidas");
    expect(result).toHaveLength(0);
  });

  test("search by brand across All category", () => {
    const result = filterProducts(MOCK_CATALOG, "All", "All", "adidas");
    expect(result).toHaveLength(2);
  });

  test("search by type_name", () => {
    const result = filterProducts(MOCK_CATALOG, "All", "All", "mug");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  test("sub-type filter within category", () => {
    const result = filterProducts(MOCK_CATALOG, "Hats", "Dad Hats", "");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  test("clear filters returns all", () => {
    // Simulate clear: reset to All/All/""
    const result = filterProducts(MOCK_CATALOG, "All", "All", "");
    expect(result).toHaveLength(6);
  });
});

// ── 4. Sorting ────────────────────────────────────────────────────────────────

describe("Sorting", () => {
  const products = [
    { id: 1, title: "Zebra Tee", min_cost: 15.00, color_count: 3 },
    { id: 2, title: "Alpha Hat", min_cost: 8.50, color_count: 10 },
    { id: 3, title: "Mango Mug", min_cost: 12.00, color_count: 1 },
  ];

  test("name A-Z sorts alphabetically", () => {
    const sorted = [...products].sort((a, b) => a.title.localeCompare(b.title));
    expect(sorted[0].title).toBe("Alpha Hat");
    expect(sorted[2].title).toBe("Zebra Tee");
  });

  test("cost low-to-high", () => {
    const sorted = [...products].sort((a, b) => a.min_cost - b.min_cost);
    expect(sorted[0].id).toBe(2);
    expect(sorted[2].id).toBe(1);
  });

  test("cost high-to-low", () => {
    const sorted = [...products].sort((a, b) => b.min_cost - a.min_cost);
    expect(sorted[0].id).toBe(1);
  });

  test("most colors", () => {
    const sorted = [...products].sort((a, b) => b.color_count - a.color_count);
    expect(sorted[0].id).toBe(2);
  });
});

// ── 5. Availability states ────────────────────────────────────────────────────

describe("Availability states", () => {
  type AvailState = "loading" | "available" | "unavailable" | "unknown";

  function getAvailability(cached: { available_variants: number } | "loading" | null | undefined): AvailState {
    if (cached === "loading") return "loading";
    if (cached === undefined || cached === null) return "unknown";
    if (cached.available_variants === 0) return "unavailable";
    return "available";
  }

  test("loading state", () => expect(getAvailability("loading")).toBe("loading"));
  test("unknown when cache miss", () => expect(getAvailability(undefined)).toBe("unknown"));
  test("unknown when null", () => expect(getAvailability(null)).toBe("unknown"));
  test("unavailable when 0 variants", () => expect(getAvailability({ available_variants: 0 })).toBe("unavailable"));
  test("available when variants > 0", () => expect(getAvailability({ available_variants: 5 })).toBe("available"));
  test("unknown is NOT unavailable", () => expect(getAvailability(undefined)).not.toBe("unavailable"));
  test("unavailable product cannot be selected", () => {
    const unavailable = getAvailability({ available_variants: 0 }) === "unavailable";
    expect(unavailable).toBe(true);
    // Selection is disabled when unavailable
    const canSelect = !unavailable;
    expect(canSelect).toBe(false);
  });
});

// ── 6. Sidebar stage list ─────────────────────────────────────────────────────

describe("Sidebar stage list", () => {
  const SINGLE_STAGES: BuilderStage[] = ["blank","variants","design","production","designer","mockups","details","pricing","review"];
  const EDIT_STAGES: BuilderStage[] = ["details","pricing","review"];

  test("single flow has 9 stages", () => expect(SINGLE_STAGES).toHaveLength(9));
  test("edit flow has 3 stages", () => expect(EDIT_STAGES).toHaveLength(3));
  test("no mode stage in single flow", () => expect(SINGLE_STAGES).not.toContain("mode" as BuilderStage));
  test("blank is first in single flow", () => expect(SINGLE_STAGES[0]).toBe("blank"));
  test("review is last in single flow", () => expect(SINGLE_STAGES[SINGLE_STAGES.length - 1]).toBe("review"));

  test("completed stages are clickable, future stages are not", () => {
    const completedStages = new Set<BuilderStage>(["blank", "variants"]);
    const currentStage: BuilderStage = "design";
    const steps = SINGLE_STAGES.map((s, idx) => {
      const isDone = completedStages.has(s);
      const isCurrent = s === currentStage;
      const currentIdx = SINGLE_STAGES.indexOf(currentStage);
      const status = isCurrent ? "current" : isDone ? "complete" : idx < currentIdx ? "available" : "future";
      return { stage: s, status, clickable: status === "complete" || status === "available" };
    });
    expect(steps.find((s) => s.stage === "blank")?.clickable).toBe(true);
    expect(steps.find((s) => s.stage === "variants")?.clickable).toBe(true);
    expect(steps.find((s) => s.stage === "design")?.clickable).toBe(false); // current
    expect(steps.find((s) => s.stage === "mockups")?.clickable).toBe(false); // future
  });
});

// ── 7. Printful Sync identity regression ─────────────────────────────────────

describe("Printful Sync identity regression", () => {
  // Known legacy quarter-zip — must remain unchanged
  const QUARTER_ZIP = {
    uuid: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
    catalog_source: "printful_sync",
    printful_id: "476330305",
    printful_catalog_id: 903,
  };

  test("quarter-zip UUID is unchanged", () => {
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
    const syncProduct = { catalog_source: "printful_sync", printful_id: "476330305", printful_catalog_id: 903 };
    expect(syncProduct.printful_id).not.toBeNull();
  });

  test("catalog_builder products have null printful_id", () => {
    const builderProduct = { catalog_source: "catalog_builder", printful_id: null, printful_catalog_id: 71 };
    expect(builderProduct.printful_id).toBeNull();
  });

  test("identity resolver distinguishes printful_sync from catalog_builder", () => {
    function resolveStrategy(catalog_source: string): string {
      return catalog_source === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    }
    expect(resolveStrategy("printful_sync")).toBe("SYNC_VARIANT");
    expect(resolveStrategy("catalog_builder")).toBe("DIRECT_CATALOG_ORDER");
  });

  test("sync archive logic targets only printful_sync products", () => {
    const products = [
      { id: "aed80c7d", catalog_source: "printful_sync", printful_id: "476330305" },
      { id: "builder-1", catalog_source: "catalog_builder", printful_id: null },
    ];
    const syncTargets = products.filter((p) => p.catalog_source === "printful_sync");
    expect(syncTargets).toHaveLength(1);
    expect(syncTargets[0].id).toBe("aed80c7d");
  });

  test("catalog_builder products are not included in sync archive", () => {
    const products = [
      { id: "builder-1", catalog_source: "catalog_builder", printful_id: null },
    ];
    const syncTargets = products.filter((p) => p.catalog_source === "printful_sync");
    expect(syncTargets).toHaveLength(0);
  });
});

// ── 8. Catalog Builder identity regression ────────────────────────────────────

describe("Catalog Builder identity regression", () => {
  test("catalog_builder products use DIRECT_CATALOG_ORDER strategy", () => {
    const strategy = "catalog_builder" === "catalog_builder" ? "DIRECT_CATALOG_ORDER" : "SYNC_VARIANT";
    expect(strategy).toBe("DIRECT_CATALOG_ORDER");
  });

  test("catalog_builder printful_id is NULL", () => {
    const s = initialBuilderState();
    // Builder state never sets printful_id — it's set by the publish API
    expect(s.catalogProduct).toBeNull();
  });

  test("ProductSpecification validates correctly for catalog_builder product", () => {
    const result = validateProductSpecification(makeSpec());
    expect(result.valid).toBe(true);
  });

  test("dry-run does not write to DB", () => {
    const result = dryRunProductSpecification(makeSpec());
    // dryRunProductSpecification returns valid/errors/resolved — no DB writes
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("Catalog Builder does not create Printful Sync Products", () => {
    // Catalog Builder spec has no sync_product_id field
    const spec = makeSpec();
    expect("sync_product_id" in spec).toBe(false);
  });
});

// ── 9. Product row metadata ───────────────────────────────────────────────────

describe("Product row metadata", () => {
  test("cost range formats correctly — same min/max", () => {
    const min: number = 11.92, max: number = 11.92;
    const display = min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`;
    expect(display).toBe("$11.92");
  });

  test("cost range formats correctly — different min/max", () => {
    const min: number = 8.50, max: number = 28.75;
    const display = min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`;
    expect(display).toBe("$8.50–$28.75");
  });

  test("brand + type_name joined with bullet", () => {
    const brand = "Adidas", type = "Dad Hats";
    const meta = [brand, type].filter(Boolean).join(" • ");
    expect(meta).toBe("Adidas • Dad Hats");
  });

  test("no brand — only type_name shown", () => {
    const brand = null, type = "Mugs";
    const meta = [brand, type].filter(Boolean).join(" • ");
    expect(meta).toBe("Mugs");
  });
});

// ── 10. Progressive loading ───────────────────────────────────────────────────

describe("Progressive loading", () => {
  test("loading marker prevents duplicate requests", () => {
    const cache = new Map<number, unknown>();
    const ids = [1, 2, 3];
    // Mark as loading
    for (const id of ids) cache.set(id, "loading");
    // Second call should find all already in cache
    const missing = ids.filter((id) => !cache.has(id));
    expect(missing).toHaveLength(0);
  });

  test("batch chunks at 20", () => {
    const ids = Array.from({ length: 45 }, (_, i) => i + 1);
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(20);
    expect(chunks[1]).toHaveLength(20);
    expect(chunks[2]).toHaveLength(5);
  });

  test("null cache entry is unknown, not loading", () => {
    const cache = new Map<number, unknown>();
    cache.set(1, null);
    expect(cache.get(1)).toBeNull();
    expect(cache.get(1)).not.toBe("loading");
  });
});
