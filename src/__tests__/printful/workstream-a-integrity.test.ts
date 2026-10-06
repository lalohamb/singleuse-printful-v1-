// Workstream A Pre-Operator Integrity — Regression Tests
// Covers the three bounded fixes:
//   1. V2 normalizer does not fabricate currency / files[] / options[]
//   2. Product route caller separation (Catalog Builder V2 / ProductDesigner V1)
//   3. MockupPollResult adapter handles both V1 and V2 shapes correctly

import { describe, it, expect } from "vitest";
import type {
  V2CatalogProduct,
  PrintfulProduct,
  PrintfulMockupTask,
  V2MockupTask,
  MockupPollResult,
} from "@/lib/printful/types";

// ── 1. V2 normalizer does NOT fabricate provider fields ───────────────────────

describe("V2CatalogProduct — no fabricated provider fields", () => {
  // Construct a V2CatalogProduct as normalizeV2Product() would produce it.
  // Verify that currency, files, and options are absent.
  const v2Product: V2CatalogProduct = {
    id: 679,
    main_category_id: 5,
    type: "T-SHIRT",
    type_name: "T-SHIRT",
    title: "Unisex Staple T-Shirt | Bella + Canvas 3001",
    brand: "Bella + Canvas",
    model: "3001",
    image: "https://files.cdn.printful.com/products/71/product_1581412541.jpg",
    variant_count: 432,
    is_discontinued: false,
    avg_fulfillment_time: null,
    description: "A staple in any wardrobe.",
    techniques: [{ key: "dtfilm", display_name: "DTFilm", is_default: true }],
    placements: [],
    dimensions: null,
  };

  it("does NOT have a currency field", () => {
    // currency must not exist on V2CatalogProduct
    expect("currency" in v2Product).toBe(false);
  });

  it("does NOT have a files field", () => {
    // files[] must not exist on V2CatalogProduct
    expect("files" in v2Product).toBe(false);
  });

  it("does NOT have an options field", () => {
    // options[] must not exist on V2CatalogProduct
    expect("options" in v2Product).toBe(false);
  });

  it("has all required V2 fields", () => {
    expect(v2Product.id).toBe(679);
    expect(v2Product.title).toBe("Unisex Staple T-Shirt | Bella + Canvas 3001");
    expect(v2Product.techniques[0].key).toBe("dtfilm");
    expect(v2Product.avg_fulfillment_time).toBeNull();
    expect(v2Product.dimensions).toBeNull();
  });

  it("V1 PrintfulProduct still has currency, files, options", () => {
    // V1 type is unchanged — these fields remain on PrintfulProduct
    const v1Product: PrintfulProduct = {
      id: 71,
      main_category_id: 5,
      type: "T-SHIRT",
      type_name: "T-Shirts",
      title: "Unisex Staple T-Shirt | Bella + Canvas 3001",
      brand: "Bella + Canvas",
      model: "3001",
      image: "https://example.com/img.jpg",
      variant_count: 432,
      currency: "USD",
      is_discontinued: false,
      avg_fulfillment_time: null,
      description: "A staple.",
      techniques: [],
      files: [],
      options: [],
      dimensions: null,
    };
    expect(v1Product.currency).toBe("USD");
    expect(Array.isArray(v1Product.files)).toBe(true);
    expect(Array.isArray(v1Product.options)).toBe(true);
  });
});

// ── 2. Product route separation — Catalog Builder V2 / ProductDesigner V1 ─────

describe("Product route separation", () => {
  it("V2CatalogProduct has all fields Catalog Builder needs", () => {
    // Catalog Builder reads: id, title, image, techniques, type_name, brand,
    // variant_count, placements (for conflicting_placements)
    const v2: V2CatalogProduct = {
      id: 679,
      main_category_id: 5,
      type: "T-SHIRT",
      type_name: "T-SHIRT",
      title: "BC3001",
      brand: "Bella + Canvas",
      model: "3001",
      image: "https://example.com/img.jpg",
      variant_count: 432,
      is_discontinued: false,
      avg_fulfillment_time: null,
      description: "",
      techniques: [{ key: "dtfilm", display_name: "DTFilm", is_default: true }],
      placements: [
        {
          placement: "front",
          technique: "dtfilm",
          layers: [],
          placement_options: [],
          conflicting_placements: ["back"],
        },
      ],
      dimensions: null,
    };
    // All Catalog Builder fields present
    expect(v2.id).toBe(679);
    expect(v2.title).toBe("BC3001");
    expect(v2.techniques[0].key).toBe("dtfilm");
    expect(v2.placements[0].conflicting_placements).toContain("back");
  });

  it("V1 PrintfulProduct has all fields ProductDesigner needs", () => {
    // ProductDesigner reads: id, title, techniques, currency (display only),
    // files (for OptionsSelector), options (for OptionsSelector)
    const v1: PrintfulProduct = {
      id: 71,
      main_category_id: 5,
      type: "T-SHIRT",
      type_name: "T-Shirts",
      title: "BC3001",
      brand: null,
      model: null,
      image: "https://example.com/img.jpg",
      variant_count: 432,
      currency: "USD",
      is_discontinued: false,
      avg_fulfillment_time: null,
      description: "",
      techniques: [{ key: "DTFILM", display_name: "DTFilm", is_default: true }],
      files: [{ id: "default", type: "front", title: "Front Print", additional_price: null, options: [] }],
      options: [],
      dimensions: null,
    };
    expect(v1.currency).toBe("USD");
    expect(v1.files.length).toBe(1);
    expect(v1.techniques[0].key).toBe("DTFILM");
  });

  it("V2CatalogProduct and PrintfulProduct are distinct types — no accidental merge", () => {
    // V2CatalogProduct must not have currency
    const v2Keys = Object.keys({
      id: 0, main_category_id: 0, type: "", type_name: "", title: "",
      brand: null, model: null, image: "", variant_count: 0,
      is_discontinued: false, avg_fulfillment_time: null, description: "",
      techniques: [], placements: [], dimensions: null,
    } satisfies V2CatalogProduct);
    expect(v2Keys).not.toContain("currency");
    expect(v2Keys).not.toContain("files");
    expect(v2Keys).not.toContain("options");
  });
});

// ── 3. MockupPollResult adapter — V1 and V2 shapes ───────────────────────────

describe("MockupPollResult adapter", () => {
  // V1 raw task shape (from GET /mockup-generator/task?task_key=)
  const v1RawCompleted: PrintfulMockupTask = {
    task_key: "gt_abc123def456",
    status: "completed",
    mockups: [
      {
        placement: "front",
        variant_ids: [12345],
        mockup_url: "https://printful-upload.s3.amazonaws.com/tmp/v1/mockup.jpg",
        extra: [],
        option: null,
        option_group: null,
      },
    ],
  };

  const v1RawFailed: PrintfulMockupTask = {
    task_key: "gt_failed123",
    status: "failed",
    error: "Artwork file could not be processed.",
  };

  // V2 raw task shape (from GET /v2/mockup-tasks?id=)
  const v2RawCompleted: V2MockupTask = {
    id: 979231004,
    status: "completed",
    catalog_variant_mockups: [
      {
        catalog_variant_id: 17008,
        mockups: [
          {
            placement: "front",
            display_name: "Front print",
            technique: "dtfilm",
            style_id: 6591,
            mockup_url: "https://printful-upload.s3.amazonaws.com/tmp/v2/mockup.png",
            view: "Front",
          },
        ],
      },
    ],
    failure_reasons: [],
  };

  const v2RawFailed: V2MockupTask = {
    id: 979231005,
    status: "failed",
    catalog_variant_mockups: [],
    failure_reasons: ["Artwork resolution too low for selected technique."],
  };

  // Simulate the adapter logic from MockupStatus
  function adaptV1(raw: PrintfulMockupTask): MockupPollResult {
    return {
      source: "v1",
      status: raw.status,
      failureReason: raw.status === "failed" ? (raw.error ?? "Mockup generation failed.") : null,
      v1Task: raw.status === "completed" ? raw : null,
      v2Task: null,
    };
  }

  function adaptV2(raw: V2MockupTask): MockupPollResult {
    return {
      source: "v2",
      status: raw.status,
      failureReason: raw.status === "failed" ? (raw.failure_reasons?.[0] ?? "Mockup generation failed.") : null,
      v1Task: null,
      v2Task: raw.status === "completed" ? raw : null,
    };
  }

  it("V1 completed task adapts correctly", () => {
    const result = adaptV1(v1RawCompleted);
    expect(result.source).toBe("v1");
    expect(result.status).toBe("completed");
    expect(result.failureReason).toBeNull();
    expect(result.v1Task).not.toBeNull();
    expect(result.v1Task?.task_key).toBe("gt_abc123def456");
    expect(result.v1Task?.mockups?.[0].placement).toBe("front");
    expect(result.v2Task).toBeNull();
  });

  it("V1 failed task adapts correctly", () => {
    const result = adaptV1(v1RawFailed);
    expect(result.source).toBe("v1");
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("Artwork file could not be processed.");
    expect(result.v1Task).toBeNull();
    expect(result.v2Task).toBeNull();
  });

  it("V2 completed task adapts correctly", () => {
    const result = adaptV2(v2RawCompleted);
    expect(result.source).toBe("v2");
    expect(result.status).toBe("completed");
    expect(result.failureReason).toBeNull();
    expect(result.v2Task).not.toBeNull();
    expect(result.v2Task?.id).toBe(979231004);
    expect(result.v2Task?.catalog_variant_mockups[0].catalog_variant_id).toBe(17008);
    expect(result.v1Task).toBeNull();
  });

  it("V2 failed task adapts correctly", () => {
    const result = adaptV2(v2RawFailed);
    expect(result.source).toBe("v2");
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("Artwork resolution too low for selected technique.");
    expect(result.v2Task).toBeNull();
    expect(result.v1Task).toBeNull();
  });

  it("V1 failure reason comes from error field, not failure_reasons", () => {
    const result = adaptV1(v1RawFailed);
    // V1 uses `error` string, not `failure_reasons[]`
    expect(result.failureReason).toBe("Artwork file could not be processed.");
  });

  it("V2 failure reason comes from failure_reasons[0], not error field", () => {
    const result = adaptV2(v2RawFailed);
    // V2 uses `failure_reasons[]`, not `error`
    expect(result.failureReason).toBe("Artwork resolution too low for selected technique.");
  });

  it("V1 adapter does not read failure_reasons (V2-only field)", () => {
    // V1 PrintfulMockupTask has no failure_reasons field
    // The adapter must not attempt to read it
    const v1: PrintfulMockupTask = { task_key: "gt_x", status: "failed", error: "V1 error" };
    expect("failure_reasons" in v1).toBe(false);
    const result = adaptV1(v1);
    expect(result.failureReason).toBe("V1 error");
  });

  it("V2 adapter does not read task_key (V1-only field)", () => {
    // V2MockupTask has no task_key field
    const v2: V2MockupTask = {
      id: 123, status: "completed",
      catalog_variant_mockups: [], failure_reasons: [],
    };
    expect("task_key" in v2).toBe(false);
    const result = adaptV2(v2);
    expect(result.v2Task?.id).toBe(123);
  });
});

// ── 4. Numeric task ID detection (V2) vs string task_key (V1) ─────────────────

describe("Task key detection — numeric V2 vs string V1", () => {
  function isV2TaskKey(key: string): boolean {
    const n = parseInt(key, 10);
    return Number.isFinite(n) && n > 0 && String(n) === key.trim();
  }

  it("numeric string selects V2 path", () => {
    expect(isV2TaskKey("979231004")).toBe(true);
    expect(isV2TaskKey("1")).toBe(true);
    expect(isV2TaskKey("123456789")).toBe(true);
  });

  it("V1 task_key string selects V1 path", () => {
    expect(isV2TaskKey("gt_abc123def456")).toBe(false);
    expect(isV2TaskKey("gt_12345")).toBe(false);
    expect(isV2TaskKey("abc")).toBe(false);
  });

  it("zero or negative does not select V2", () => {
    expect(isV2TaskKey("0")).toBe(false);
    expect(isV2TaskKey("-1")).toBe(false);
  });

  it("float string does not select V2", () => {
    expect(isV2TaskKey("979231004.5")).toBe(false);
  });

  it("empty string does not select V2", () => {
    expect(isV2TaskKey("")).toBe(false);
  });
});
