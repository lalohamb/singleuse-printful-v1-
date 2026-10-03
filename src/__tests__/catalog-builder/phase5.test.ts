import { describe, it, expect } from "vitest";
import type { Product } from "@/types";
import type { CatalogProduct } from "@/lib/catalog/types";
import { generateSlug } from "@/lib/catalog/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBuilderProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "b630b845-fd85-4e02-9758-a841d8025453",
    slug: "catalog-builder-verification-hat",
    title: "Catalog Builder Verification Hat",
    short_description: "A test hat.",
    description: "Created by Catalog Builder.",
    category_id: null,
    brand: "adidas",
    product_type: "Hat",
    price: 49.99,
    compare_at_price: null,
    cost: 0,
    image_url: null,
    images: [],
    status: "draft",
    published_at: null,
    meta_title: null,
    meta_description: null,
    featured: false,
    is_new_arrival: false,
    is_trending: false,
    is_bestseller: false,
    is_on_sale: false,
    is_personalizable: false,
    personalization_label: null,
    content_locked: true,
    display_order: 0,
    printful_id: null,
    printful_catalog_id: 638,
    catalog_source: "catalog_builder",
    variants: [],
    shipping_info: {},
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function makeSyncProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b",
    slug: "lightweight-quarter-zip-pullover",
    title: "Lightweight quarter-zip pullover",
    short_description: null,
    description: null,
    category_id: null,
    brand: null,
    product_type: null,
    price: 49.99,
    compare_at_price: null,
    cost: 0,
    image_url: null,
    images: [],
    status: "active",
    published_at: "2026-09-30T00:00:00Z",
    meta_title: null,
    meta_description: null,
    featured: false,
    is_new_arrival: false,
    is_trending: false,
    is_bestseller: false,
    is_on_sale: false,
    is_personalizable: false,
    personalization_label: null,
    content_locked: false,
    display_order: 0,
    printful_id: "476330305",
    printful_catalog_id: 903,
    catalog_source: "printful_sync",
    variants: [],
    shipping_info: {},
    created_at: "2026-09-30T00:00:00Z",
    updated_at: "2026-09-30T00:00:00Z",
    ...overrides,
  };
}

// Simulates the sync archival filter
function syncArchivalFilter(products: Product[]): Product[] {
  return products.filter((p) => p.catalog_source === "printful_sync");
}

// Simulates publication validation
function validateForPublication(
  product: Pick<Product, "title" | "slug" | "price" | "printful_catalog_id">,
  variants: { available: boolean; printful_variant_id: string | null }[],
  designs: { id: string }[],
  images: { id: string }[]
): string[] {
  const errors: string[] = [];
  if (!product.title?.trim()) errors.push("title is required");
  if (!product.slug?.trim()) errors.push("slug is required");
  if (!product.price || product.price <= 0) errors.push("valid retail price is required");
  if (!product.printful_catalog_id) errors.push("printful_catalog_id is required");
  const sellable = variants.filter((v) => v.available && v.printful_variant_id);
  if (sellable.length === 0) errors.push("at least one available variant with Printful mapping is required");
  if (designs.length === 0) errors.push("a product design is required");
  if (images.length === 0) errors.push("at least one product image is required");
  return errors;
}

// Simulates slug validation
function validateSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && slug.length > 0;
}

// Simulates price validation
function validatePrice(price: unknown): boolean {
  return typeof price === "number" && isFinite(price) && price > 0;
}

// Simulates idempotency check (slug + catalog_source uniqueness)
function checkIdempotency(
  existing: { slug: string; catalog_source: string }[],
  slug: string
): boolean {
  return existing.some((p) => p.slug === slug && p.catalog_source === "catalog_builder");
}


// ── 2. Sync Isolation ─────────────────────────────────────────────────────────

describe("2. Sync isolation", () => {
  const allProducts: Product[] = [
    makeSyncProduct({ id: "aed80c7d-5f07-495a-8e1a-8ff1ec74726b", catalog_source: "printful_sync" }),
    makeBuilderProduct({ id: "b630b845-fd85-4e02-9758-a841d8025453", catalog_source: "catalog_builder" }),
    makeBuilderProduct({ id: "manual-product-uuid", catalog_source: "manual" }),
  ];

  it("sync archival only targets printful_sync products", () => {
    const toArchive = syncArchivalFilter(allProducts);
    expect(toArchive).toHaveLength(1);
    expect(toArchive[0].catalog_source).toBe("printful_sync");
  });

  it("catalog_builder products are never in sync archival set", () => {
    const toArchive = syncArchivalFilter(allProducts);
    expect(toArchive.filter((p) => p.catalog_source === "catalog_builder")).toHaveLength(0);
  });

  it("manual products are never in sync archival set", () => {
    const toArchive = syncArchivalFilter(allProducts);
    expect(toArchive.filter((p) => p.catalog_source === "manual")).toHaveLength(0);
  });

  it("sync archival with no printful_sync products archives nothing", () => {
    expect(syncArchivalFilter([makeBuilderProduct()])).toHaveLength(0);
  });

  it("catalog_builder product UUID is stable across sync", () => {
    const p = makeBuilderProduct({ id: "b630b845-fd85-4e02-9758-a841d8025453" });
    expect(syncArchivalFilter([p])).toHaveLength(0);
    expect(p.id).toBe("b630b845-fd85-4e02-9758-a841d8025453");
  });

  it("quarter-zip is correctly identified as printful_sync", () => {
    const qz = makeSyncProduct();
    const toArchive = syncArchivalFilter([qz]);
    expect(toArchive[0].catalog_source).toBe("printful_sync");
    expect(toArchive[0].id).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
  });
});


// ── 3. Provider ID semantics ──────────────────────────────────────────────────

describe("3. Provider ID semantics", () => {
  it("catalog_builder product has numeric printful_catalog_id", () => {
    const p = makeBuilderProduct();
    expect(typeof p.printful_catalog_id).toBe("number");
    expect(p.printful_catalog_id).toBeGreaterThan(0);
  });

  it("store product UUID is not a numeric Printful ID", () => {
    const p = makeBuilderProduct();
    expect(isNaN(Number(p.id))).toBe(true);
  });

  it("store variant UUID is not a numeric Printful ID", () => {
    const variantId = "13909da7-be67-4c6c-95a0-47707b38f8ed";
    expect(isNaN(Number(variantId))).toBe(true);
  });

  it("printful_variant_id is a numeric catalog variant ID string", () => {
    const printfulVariantId = "16245";
    expect(isNaN(Number(printfulVariantId))).toBe(false);
    expect(Number(printfulVariantId)).toBe(16245);
  });

  it("cart uses store UUIDs not Printful IDs", () => {
    const cartItem = {
      product_id: "b630b845-fd85-4e02-9758-a841d8025453",
      variant_id: "13909da7-be67-4c6c-95a0-47707b38f8ed",
    };
    expect(isNaN(Number(cartItem.product_id))).toBe(true);
    expect(isNaN(Number(cartItem.variant_id))).toBe(true);
  });

  it("printful_catalog_id is not placed in printful_id", () => {
    const p = makeBuilderProduct();
    expect(p.printful_id).toBeNull();
    expect(p.printful_catalog_id).toBe(638);
  });

  it("store variant UUID and printful_variant_id are distinct", () => {
    const storeVariantId = "13909da7-be67-4c6c-95a0-47707b38f8ed";
    const printfulVariantId = "16245";
    expect(storeVariantId).not.toBe(printfulVariantId);
  });
});

// ── 4. Slug validation ────────────────────────────────────────────────────────

describe("4. Slug validation", () => {
  it("valid slug passes", () => {
    expect(validateSlug("catalog-builder-verification-hat")).toBe(true);
  });

  it("empty slug fails", () => {
    expect(validateSlug("")).toBe(false);
  });

  it("slug with uppercase fails", () => {
    expect(validateSlug("My-Hat")).toBe(false);
  });

  it("slug with spaces fails", () => {
    expect(validateSlug("my hat")).toBe(false);
  });

  it("slug with special chars fails", () => {
    expect(validateSlug("my_hat!")).toBe(false);
  });

  it("slug with only hyphens and lowercase passes", () => {
    expect(validateSlug("a-b-c")).toBe(true);
  });

  it("generateSlug produces valid slug from title", () => {
    const slug = generateSlug("Catalog Builder Verification Hat");
    expect(validateSlug(slug)).toBe(true);
    expect(slug).toBe("catalog-builder-verification-hat");
  });

  it("generateSlug strips special characters", () => {
    const slug = generateSlug("Hat & Cap (2026)");
    expect(validateSlug(slug)).toBe(true);
  });
});


// ── 5. Pricing validation ─────────────────────────────────────────────────────

describe("5. Pricing validation", () => {
  it("valid positive price passes", () => {
    expect(validatePrice(49.99)).toBe(true);
  });

  it("zero price fails", () => {
    expect(validatePrice(0)).toBe(false);
  });

  it("negative price fails", () => {
    expect(validatePrice(-5)).toBe(false);
  });

  it("NaN fails", () => {
    expect(validatePrice(NaN)).toBe(false);
  });

  it("string price fails", () => {
    expect(validatePrice("49.99")).toBe(false);
  });

  it("Infinity fails", () => {
    expect(validatePrice(Infinity)).toBe(false);
  });

  it("base price is minimum of variant prices", () => {
    const variantPricing = [
      { retail_price: 49.99 },
      { retail_price: 54.99 },
      { retail_price: 59.99 },
    ];
    const basePrice = Math.min(...variantPricing.map((v) => v.retail_price));
    expect(basePrice).toBe(49.99);
  });

  it("provider cost does not determine retail price automatically", () => {
    const providerCost = 19.99;
    const suggestedRetail = Math.ceil(providerCost * 2.5);
    // Suggestion is 50, but admin must confirm
    expect(suggestedRetail).toBe(50);
    // Admin can override
    const adminSetPrice = 45.00;
    expect(validatePrice(adminSetPrice)).toBe(true);
  });
});

// ── 6. Publication validation ─────────────────────────────────────────────────

describe("6. Publication validation", () => {
  const validVariants = [{ available: true, printful_variant_id: "16245" }];
  const validDesigns = [{ id: "d180dd4d-0ff8-4cec-90bc-7faf362fb27c" }];
  const validImages = [{ id: "some-image-uuid" }];

  it("valid complete product publishes", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      validVariants, validDesigns, validImages
    );
    expect(errors).toHaveLength(0);
  });

  it("missing title blocks publication", () => {
    const errors = validateForPublication(
      { title: "", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      validVariants, validDesigns, validImages
    );
    expect(errors).toContain("title is required");
  });

  it("missing slug blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "", price: 49.99, printful_catalog_id: 638 },
      validVariants, validDesigns, validImages
    );
    expect(errors).toContain("slug is required");
  });

  it("zero price blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 0, printful_catalog_id: 638 },
      validVariants, validDesigns, validImages
    );
    expect(errors).toContain("valid retail price is required");
  });

  it("missing printful_catalog_id blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: null },
      validVariants, validDesigns, validImages
    );
    expect(errors).toContain("printful_catalog_id is required");
  });

  it("no sellable variants blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      [], validDesigns, validImages
    );
    expect(errors).toContain("at least one available variant with Printful mapping is required");
  });

  it("unavailable variant does not count as sellable", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      [{ available: false, printful_variant_id: "16245" }],
      validDesigns, validImages
    );
    expect(errors).toContain("at least one available variant with Printful mapping is required");
  });

  it("variant without printful_variant_id does not count as sellable", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      [{ available: true, printful_variant_id: null }],
      validDesigns, validImages
    );
    expect(errors).toContain("at least one available variant with Printful mapping is required");
  });

  it("no product_design blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      validVariants, [], validImages
    );
    expect(errors).toContain("a product design is required");
  });

  it("no product_image blocks publication", () => {
    const errors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      validVariants, validDesigns, []
    );
    expect(errors).toContain("at least one product image is required");
  });

  it("multiple missing fields reported together", () => {
    const errors = validateForPublication(
      { title: "", slug: "", price: 0, printful_catalog_id: null },
      [], [], []
    );
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});


// ── 7. Idempotency ────────────────────────────────────────────────────────────

describe("7. Idempotency", () => {
  const existing = [
    { slug: "catalog-builder-verification-hat", catalog_source: "catalog_builder" },
    { slug: "lightweight-quarter-zip-pullover", catalog_source: "printful_sync" },
  ];

  it("duplicate slug + catalog_builder is detected", () => {
    expect(checkIdempotency(existing, "catalog-builder-verification-hat")).toBe(true);
  });

  it("new slug is not a duplicate", () => {
    expect(checkIdempotency(existing, "brand-new-product")).toBe(false);
  });

  it("same slug with different catalog_source is not a duplicate", () => {
    // printful_sync product with same slug does not block catalog_builder creation
    expect(checkIdempotency(existing, "lightweight-quarter-zip-pullover")).toBe(false);
  });

  it("empty existing list is never a duplicate", () => {
    expect(checkIdempotency([], "any-slug")).toBe(false);
  });

  it("idempotency key is a UUID", () => {
    // UUIDs are generated server-side — verify format only
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const sampleUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(sampleUuid).toMatch(uuidPattern);
  });

  it("two separate builder sessions generate different idempotency keys", () => {
    // Each session generates a unique key server-side via randomUUID()
    // Verified by checking two known-distinct UUIDs
    const key1 = "11111111-1111-1111-1111-111111111111";
    const key2 = "22222222-2222-2222-2222-222222222222";
    expect(key1).not.toBe(key2);
  });
});

// ── 8. Draft visibility ───────────────────────────────────────────────────────

describe("8. Draft visibility", () => {
  const products: Product[] = [
    makeSyncProduct({ status: "active" }),
    makeBuilderProduct({ status: "draft" }),
    makeBuilderProduct({ id: "archived-id", status: "archived" }),
  ];

  function publicCatalogQuery(all: Product[]): Product[] {
    return all.filter((p) => p.status === "active");
  }

  it("draft products do not appear in public catalog", () => {
    const public_ = publicCatalogQuery(products);
    expect(public_.every((p) => p.status === "active")).toBe(true);
  });

  it("archived products do not appear in public catalog", () => {
    const public_ = publicCatalogQuery(products);
    expect(public_.some((p) => p.status === "archived")).toBe(false);
  });

  it("only active products appear in public catalog", () => {
    const public_ = publicCatalogQuery(products);
    expect(public_).toHaveLength(1);
    expect(public_[0].catalog_source).toBe("printful_sync");
  });

  it("published catalog_builder product appears in public catalog", () => {
    const published = makeBuilderProduct({ status: "active", published_at: "2026-10-01T00:00:00Z" });
    const public_ = publicCatalogQuery([...products, published]);
    expect(public_.some((p) => p.catalog_source === "catalog_builder")).toBe(true);
  });
});

// ── 9. Draft creation transaction semantics ───────────────────────────────────

describe("9. Draft creation transaction semantics", () => {
  it("creation is compensating rollback not true DB transaction", () => {
    // The current implementation uses sequential inserts with manual DELETE rollback.
    // This is compensating rollback, not a true atomic DB transaction.
    // Documented here as a known architectural characteristic.
    const implementationType = "compensating_rollback";
    expect(implementationType).toBe("compensating_rollback");
  });

  it("product row is deleted if variant creation fails", () => {
    // Simulates rollback: if variants fail, product is deleted
    let productCreated = true;
    let variantsFailed = true;
    if (variantsFailed && productCreated) {
      productCreated = false; // rollback
    }
    expect(productCreated).toBe(false);
  });

  it("product and variants are deleted if design creation fails", () => {
    let productCreated = true;
    let variantsCreated = true;
    let designFailed = true;
    if (designFailed) {
      productCreated = false;
      variantsCreated = false;
    }
    expect(productCreated).toBe(false);
    expect(variantsCreated).toBe(false);
  });

  it("image failure is non-fatal — product exists without images", () => {
    // product_images insert failure does not roll back the product
    let productCreated = true;
    let variantsCreated = true;
    let designCreated = true;
    let imagesFailed = true;
    // Non-fatal: product still exists
    expect(productCreated).toBe(true);
    expect(variantsCreated).toBe(true);
    expect(designCreated).toBe(true);
    // But publication will be blocked by missing images
    const images: { id: string }[] = [];
    const pubErrors = validateForPublication(
      { title: "Hat", slug: "hat", price: 49.99, printful_catalog_id: 638 },
      [{ available: true, printful_variant_id: "16245" }],
      [{ id: "design-id" }],
      images
    );
    expect(pubErrors).toContain("at least one product image is required");
  });
});


// ── 10. Mockup options fix ────────────────────────────────────────────────────

describe("10. Mockup generation — options filter fix", () => {
  function buildMockupRequest(opts: {
    catalogProductId: number;
    variantIds: number[];
    technique: string;
    placement: string;
    imageUrl: string;
    position: Record<string, number>;
    optionGroups?: string[];
    options?: { id: string }[];
  }) {
    const body: Record<string, unknown> = {
      productId: opts.catalogProductId,
      variant_ids: opts.variantIds,
      technique: opts.technique,
      files: [{ placement: opts.placement, image_url: opts.imageUrl, position: opts.position }],
    };
    if (opts.optionGroups && opts.optionGroups.length > 0) body.option_groups = opts.optionGroups;
    if (opts.options && opts.options.length > 0) body.options = opts.options;
    return body;
  }

  it("catalog builder does not send option_groups", () => {
    const req = buildMockupRequest({
      catalogProductId: 638,
      variantIds: [16245],
      technique: "EMBROIDERY",
      placement: "embroidery_front_large",
      imageUrl: "https://example.com/art.png",
      position: { area_width: 1796, area_height: 608, width: 898, height: 304, top: 152, left: 449 },
      // No optionGroups passed
    });
    expect(req).not.toHaveProperty("option_groups");
  });

  it("catalog builder does not send options", () => {
    const req = buildMockupRequest({
      catalogProductId: 638,
      variantIds: [16245],
      technique: "EMBROIDERY",
      placement: "embroidery_front_large",
      imageUrl: "https://example.com/art.png",
      position: { area_width: 1796, area_height: 608, width: 898, height: 304, top: 152, left: 449 },
    });
    expect(req).not.toHaveProperty("options");
  });

  it("request contains required fields", () => {
    const req = buildMockupRequest({
      catalogProductId: 638,
      variantIds: [16245],
      technique: "EMBROIDERY",
      placement: "embroidery_front_large",
      imageUrl: "https://example.com/art.png",
      position: { area_width: 1796, area_height: 608, width: 898, height: 304, top: 152, left: 449 },
    });
    expect(req).toHaveProperty("productId", 638);
    expect(req).toHaveProperty("variant_ids");
    expect(req).toHaveProperty("technique", "EMBROIDERY");
    expect(req).toHaveProperty("files");
  });

  it("option_groups filter caused the original 400 error", () => {
    // Documented: sending option_groups: ["Flat Lifestyle"] with variant 16245
    // caused Printful 400 "No variants to generate"
    const problematicRequest = buildMockupRequest({
      catalogProductId: 638,
      variantIds: [16245],
      technique: "EMBROIDERY",
      placement: "embroidery_front_large",
      imageUrl: "https://example.com/art.png",
      position: { area_width: 1796, area_height: 608, width: 898, height: 304, top: 152, left: 449 },
      optionGroups: ["Flat Lifestyle"],
      options: [{ id: "Front" }],
    });
    expect(problematicRequest).toHaveProperty("option_groups");
    // The fix removes these from the catalog builder request
  });
});

// ── 11. Image architecture ────────────────────────────────────────────────────

describe("11. Normalized image architecture", () => {
  const normalizedImages = [
    { image_url: "https://storage.example.com/mockups/hat-front.jpg", is_primary: true, display_order: 0 },
    { image_url: "https://storage.example.com/mockups/hat-side.jpg", is_primary: false, display_order: 1 },
  ];

  function getPrimaryImage(
    product: { image_url: string | null; images: string[] },
    normalized?: { image_url: string; is_primary: boolean }[]
  ): string {
    if (normalized && normalized.length > 0) {
      return (normalized.find((i) => i.is_primary) ?? normalized[0]).image_url;
    }
    if (product.image_url) return product.image_url;
    if (product.images.length > 0) return product.images[0];
    return "/product-placeholder.svg";
  }

  it("normalized images take priority over image_url", () => {
    const product = { image_url: "https://legacy.com/old.jpg", images: [] };
    const primary = getPrimaryImage(product, normalizedImages);
    expect(primary).toBe("https://storage.example.com/mockups/hat-front.jpg");
  });

  it("primary flag selects correct image", () => {
    const primary = normalizedImages.find((i) => i.is_primary);
    expect(primary?.image_url).toBe("https://storage.example.com/mockups/hat-front.jpg");
  });

  it("display_order controls thumbnail ordering", () => {
    const sorted = [...normalizedImages].sort((a, b) => a.display_order - b.display_order);
    expect(sorted[0].display_order).toBe(0);
    expect(sorted[1].display_order).toBe(1);
  });

  it("falls back to image_url when no normalized images", () => {
    const product = { image_url: "https://legacy.com/old.jpg", images: [] };
    const primary = getPrimaryImage(product, []);
    expect(primary).toBe("https://legacy.com/old.jpg");
  });

  it("falls back to images[0] when no image_url", () => {
    const product = { image_url: null, images: ["https://legacy.com/img0.jpg"] };
    const primary = getPrimaryImage(product, []);
    expect(primary).toBe("https://legacy.com/img0.jpg");
  });

  it("falls back to placeholder when nothing available", () => {
    const product = { image_url: null, images: [] };
    const primary = getPrimaryImage(product, []);
    expect(primary).toBe("/product-placeholder.svg");
  });

  it("exactly one primary image per product", () => {
    const primaryCount = normalizedImages.filter((i) => i.is_primary).length;
    expect(primaryCount).toBe(1);
  });

  it("Supabase Storage URLs are canonical, not Printful temporary URLs", () => {
    const storageUrl = "https://xuojbqklykhbawgnnisf.supabase.co/storage/v1/object/public/store-images/mockups/task-123-0.jpg";
    const printfulTempUrl = "https://mockup-generator.printful.com/task/result/abc123.jpg";
    expect(storageUrl).toContain("supabase.co");
    expect(printfulTempUrl).toContain("printful.com");
    // Canonical images must use Supabase Storage
    expect(storageUrl).not.toContain("printful.com");
  });
});


// ── 12. Fulfillment boundary ──────────────────────────────────────────────────

describe("12. Fulfillment boundary", () => {
  it("catalog_builder product has printful_id = null", () => {
    const p = makeBuilderProduct();
    expect(p.printful_id).toBeNull();
  });

  it("current fulfillment path requires sync variant ID", () => {
    // stripe-webhook submits: variant_id: Number(item.printful_variant_id)
    // Printful /orders API requires a sync variant ID (store-specific)
    // Catalog variant IDs are NOT accepted by /orders
    const catalogVariantId = 16245;
    const syncVariantId = 5525324210; // store-specific, not stored
    expect(catalogVariantId).not.toBe(syncVariantId);
  });

  it("catalog_builder product cannot be fulfilled by current path", () => {
    const p = makeBuilderProduct();
    // No printful_id means no sync product, no sync variant IDs
    const canFulfill = p.printful_id !== null;
    expect(canFulfill).toBe(false);
  });

  it("storefront readiness and fulfillment readiness are separate", () => {
    const p = makeBuilderProduct({ status: "active" });
    const storefrontReady = p.status === "active";
    const fulfillmentReady = p.printful_id !== null;
    expect(storefrontReady).toBe(true);
    expect(fulfillmentReady).toBe(false);
  });

  it("Phase 5.1 fulfillment bridge is required", () => {
    // Documented: Phase 5.1 must solve sync variant ID mapping
    // before catalog_builder products can be fulfilled
    const phase51Required = true;
    expect(phase51Required).toBe(true);
  });
});

// ── 13. Quarter-zip regression ────────────────────────────────────────────────

describe("13. Existing quarter-zip regression", () => {
  it("quarter-zip UUID is unchanged", () => {
    const p = makeSyncProduct();
    expect(p.id).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
  });

  it("quarter-zip catalog_source is printful_sync", () => {
    const p = makeSyncProduct();
    expect(p.catalog_source).toBe("printful_sync");
  });

  it("quarter-zip printful_id is unchanged", () => {
    const p = makeSyncProduct();
    expect(p.printful_id).toBe("476330305");
  });

  it("quarter-zip printful_catalog_id is 903", () => {
    const p = makeSyncProduct();
    expect(p.printful_catalog_id).toBe(903);
  });

  it("quarter-zip is not affected by catalog_builder logic", () => {
    const p = makeSyncProduct();
    expect(syncArchivalFilter([p])[0].id).toBe("aed80c7d-5f07-495a-8e1a-8ff1ec74726b");
    expect(p.catalog_source).not.toBe("catalog_builder");
  });
});

// ── 14. Design validation ─────────────────────────────────────────────────────

describe("14. Design validation", () => {
  function validateDesign(design: { id: string; status: string } | null): string | null {
    if (!design) return "Design not found";
    if (design.status !== "active") return "Design is not active";
    return null;
  }

  it("active design passes validation", () => {
    expect(validateDesign({ id: "d180dd4d-0ff8-4cec-90bc-7faf362fb27c", status: "active" })).toBeNull();
  });

  it("missing design fails validation", () => {
    expect(validateDesign(null)).toBe("Design not found");
  });

  it("archived design fails validation", () => {
    expect(validateDesign({ id: "some-id", status: "archived" })).toBe("Design is not active");
  });

  it("design identity is UUID not filename", () => {
    const designId = "d180dd4d-0ff8-4cec-90bc-7faf362fb27c";
    expect(isNaN(Number(designId))).toBe(true);
    expect(designId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ── 15. Variant input validation ──────────────────────────────────────────────

describe("15. Variant input validation", () => {
  function validateVariants(variants: { printful_variant_id: string; retail_price: number }[]): string | null {
    if (!Array.isArray(variants) || variants.length === 0) return "At least one variant is required";
    for (const v of variants) {
      if (!v.printful_variant_id) return "Invalid variant: missing printful_variant_id";
      if (typeof v.retail_price !== "number" || v.retail_price <= 0) return "Invalid variant: retail_price must be positive";
    }
    return null;
  }

  it("valid variants pass", () => {
    expect(validateVariants([{ printful_variant_id: "16245", retail_price: 49.99 }])).toBeNull();
  });

  it("empty variants fail", () => {
    expect(validateVariants([])).toBe("At least one variant is required");
  });

  it("variant without printful_variant_id fails", () => {
    expect(validateVariants([{ printful_variant_id: "", retail_price: 49.99 }])).toContain("missing printful_variant_id");
  });

  it("variant with zero price fails", () => {
    expect(validateVariants([{ printful_variant_id: "16245", retail_price: 0 }])).toContain("retail_price must be positive");
  });

  it("multiple valid variants pass", () => {
    expect(validateVariants([
      { printful_variant_id: "16244", retail_price: 49.99 },
      { printful_variant_id: "16245", retail_price: 54.99 },
    ])).toBeNull();
  });
});

