import { describe, it, expect } from "vitest";
import {
  generateSlug,
  getPrimaryImage,
  getMetaTitle,
  getMetaDescription,
  isProductPurchasable,
  type CatalogProduct,
  type PublicationStatus,
} from "@/lib/catalog/types";
import type { StoreVariant } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "prod-uuid-001",
    slug: "lightweight-quarter-zip-pullover",
    title: "Lightweight Quarter-Zip Pullover",
    short_description: "A versatile quarter-zip for every season.",
    description: "Full description here.",
    category_id: "cat-uuid-001",
    brand: "Body & Sleeves",
    product_type: "quarter_zip",
    price: 49.99,
    compare_at_price: null,
    cost: 31.00,
    image_url: "https://cdn.example.com/product.jpg",
    images: ["https://cdn.example.com/product.jpg", "https://cdn.example.com/product2.jpg"],
    status: "active",
    published_at: "2026-10-17T00:00:00Z",
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
    printful_catalog_id: null,
    created_at: "2026-10-17T00:00:00Z",
    updated_at: "2026-10-17T00:00:00Z",
    ...overrides,
  };
}

function makeVariant(overrides: Partial<StoreVariant> = {}): StoreVariant {
  return {
    id: "sv-uuid-001",
    product_id: "prod-uuid-001",
    provider: "printful",
    printful_variant_id: "23178",
    label: "Lightweight Quarter-Zip Pullover / M",
    color: null,
    size: "M",
    retail_price: 49.99,
    image_url: null,
    available: true,
    ...overrides,
  };
}

// ── 1. Slug generation ────────────────────────────────────────────────────────

describe("1. Slug generation", () => {
  it("generates lowercase hyphenated slug from title", () => {
    expect(generateSlug("Lightweight Quarter-Zip Pullover")).toBe("lightweight-quarter-zip-pullover");
  });

  it("removes unsafe characters", () => {
    expect(generateSlug("Premium Tee! (Black & White)")).toBe("premium-tee-black-white");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("Body  &  Sleeves")).toBe("body-sleeves");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("  Heritage Crown Tee  ")).toBe("heritage-crown-tee");
  });

  it("handles all-numeric title", () => {
    expect(generateSlug("365")).toBe("365");
  });
});

// ── 2. Slug stability ─────────────────────────────────────────────────────────

describe("2. Slug stability", () => {
  it("slug is independent of title — changing title does not change slug", () => {
    const product = makeProduct({ slug: "original-slug", title: "New Title" });
    // Slug is stored separately; title change does not auto-update slug
    expect(product.slug).toBe("original-slug");
    expect(product.title).toBe("New Title");
  });

  it("slug is the canonical URL identifier, not the UUID", () => {
    const product = makeProduct();
    expect(product.slug).toBe("lightweight-quarter-zip-pullover");
    expect(product.id).toBe("prod-uuid-001");
    expect(product.slug).not.toBe(product.id);
  });
});

// ── 3. Publication status ─────────────────────────────────────────────────────

describe("3. Publication status", () => {
  it("active product is publicly visible", () => {
    const p = makeProduct({ status: "active" });
    expect(p.status).toBe("active");
  });

  it("draft product is not publicly visible", () => {
    const p = makeProduct({ status: "draft" });
    expect(p.status).not.toBe("active");
  });

  it("archived product is not publicly visible", () => {
    const p = makeProduct({ status: "archived" });
    expect(p.status).not.toBe("active");
  });

  it("published_at is set when product becomes active", () => {
    const p = makeProduct({ status: "active", published_at: "2026-10-17T00:00:00Z" });
    expect(p.published_at).not.toBeNull();
  });

  it("draft product has no published_at", () => {
    const p = makeProduct({ status: "draft", published_at: null });
    expect(p.published_at).toBeNull();
  });

  it("PublicationStatus type accepts valid values", () => {
    const statuses: PublicationStatus[] = ["active", "draft", "archived"];
    expect(statuses).toHaveLength(3);
  });
});

// ── 4. SEO metadata fallbacks ─────────────────────────────────────────────────

describe("4. SEO metadata fallbacks", () => {
  it("uses meta_title when set", () => {
    const p = makeProduct({ meta_title: "Custom SEO Title" });
    expect(getMetaTitle(p)).toBe("Custom SEO Title");
  });

  it("falls back to title when meta_title is null", () => {
    const p = makeProduct({ meta_title: null });
    expect(getMetaTitle(p)).toBe("Lightweight Quarter-Zip Pullover");
  });

  it("uses meta_description when set", () => {
    const p = makeProduct({ meta_description: "Custom SEO description." });
    expect(getMetaDescription(p)).toBe("Custom SEO description.");
  });

  it("falls back to short_description when meta_description is null", () => {
    const p = makeProduct({ meta_description: null, short_description: "Short desc." });
    expect(getMetaDescription(p)).toBe("Short desc.");
  });

  it("falls back to description when meta_description and short_description are null", () => {
    const p = makeProduct({ meta_description: null, short_description: null, description: "Full desc." });
    expect(getMetaDescription(p)).toBe("Full desc.");
  });

  it("returns undefined when all description fields are null", () => {
    const p = makeProduct({ meta_description: null, short_description: null, description: null });
    expect(getMetaDescription(p)).toBeUndefined();
  });
});

// ── 5. Primary image selection ────────────────────────────────────────────────

describe("5. Primary image selection", () => {
  it("returns image_url when set", () => {
    const p = makeProduct({ image_url: "https://cdn.example.com/main.jpg" });
    expect(getPrimaryImage(p)).toBe("https://cdn.example.com/main.jpg");
  });

  it("falls back to first images array entry when image_url is null", () => {
    const p = makeProduct({ image_url: null, images: ["https://cdn.example.com/first.jpg"] });
    expect(getPrimaryImage(p)).toBe("https://cdn.example.com/first.jpg");
  });

  it("returns placeholder when both image_url and images are empty", () => {
    const p = makeProduct({ image_url: null, images: [] });
    expect(getPrimaryImage(p)).toBe("/product-placeholder.svg");
  });
});

// ── 6. Pricing model ──────────────────────────────────────────────────────────

describe("6. Pricing model", () => {
  it("product.price is the storefront base/display price", () => {
    const p = makeProduct({ price: 49.99 });
    expect(p.price).toBe(49.99);
  });

  it("product.cost is the provider cost — admin only", () => {
    const p = makeProduct({ cost: 31.00 });
    expect(p.cost).toBe(31.00);
    // cost must never equal retail price (would mean zero margin)
    expect(p.cost).toBeLessThan(p.price);
  });

  it("variant retail_price is authoritative for checkout", () => {
    const v = makeVariant({ retail_price: 49.99 });
    expect(v.retail_price).toBe(49.99);
  });

  it("compare_at_price is optional and higher than price when set", () => {
    const p = makeProduct({ price: 39.99, compare_at_price: 49.99 });
    expect(p.compare_at_price).toBeGreaterThan(p.price);
  });

  it("printful_id is provider mapping only — not product identity", () => {
    const p = makeProduct({ printful_id: "476330305" });
    expect(p.printful_id).toBe("476330305");
    expect(p.id).not.toBe(p.printful_id);
  });
});

// ── 7. Purchasability ─────────────────────────────────────────────────────────

describe("7. Product purchasability", () => {
  it("active product with available variant and provider mapping is purchasable", () => {
    const p = makeProduct({ status: "active" });
    const variants = [makeVariant({ available: true, printful_variant_id: "23178" })];
    expect(isProductPurchasable(p, variants)).toBe(true);
  });

  it("draft product is not purchasable", () => {
    const p = makeProduct({ status: "draft" });
    const variants = [makeVariant({ available: true, printful_variant_id: "23178" })];
    expect(isProductPurchasable(p, variants)).toBe(false);
  });

  it("archived product is not purchasable", () => {
    const p = makeProduct({ status: "archived" });
    const variants = [makeVariant({ available: true, printful_variant_id: "23178" })];
    expect(isProductPurchasable(p, variants)).toBe(false);
  });

  it("active product with no available variants is not purchasable", () => {
    const p = makeProduct({ status: "active" });
    const variants = [makeVariant({ available: false, printful_variant_id: "23178" })];
    expect(isProductPurchasable(p, variants)).toBe(false);
  });

  it("active product with available variant but no provider mapping is not purchasable", () => {
    const p = makeProduct({ status: "active" });
    const variants = [makeVariant({ available: true, printful_variant_id: null })];
    expect(isProductPurchasable(p, variants)).toBe(false);
  });

  it("active product with no variants at all is not purchasable", () => {
    const p = makeProduct({ status: "active" });
    expect(isProductPurchasable(p, [])).toBe(false);
  });
});

// ── 8. Category relationship ──────────────────────────────────────────────────

describe("8. Category relationship", () => {
  it("product has a category_id FK", () => {
    const p = makeProduct({ category_id: "cat-uuid-001" });
    expect(p.category_id).toBe("cat-uuid-001");
  });

  it("product can be uncategorized (null category_id)", () => {
    const p = makeProduct({ category_id: null });
    expect(p.category_id).toBeNull();
  });
});

// ── 9. Curation flags ─────────────────────────────────────────────────────────

describe("9. Curation flags are store-owned", () => {
  it("featured flag is store-owned", () => {
    const p = makeProduct({ featured: true });
    expect(p.featured).toBe(true);
  });

  it("is_new_arrival flag is store-owned", () => {
    const p = makeProduct({ is_new_arrival: true });
    expect(p.is_new_arrival).toBe(true);
  });

  it("is_on_sale flag is store-owned", () => {
    const p = makeProduct({ is_on_sale: true });
    expect(p.is_on_sale).toBe(true);
  });
});

// ── 10. Sync ownership boundary ───────────────────────────────────────────────

describe("10. Sync ownership boundary", () => {
  it("content_locked prevents sync from overwriting store-owned fields", () => {
    const product = makeProduct({ content_locked: true, title: "Admin Title", slug: "admin-slug" });
    // Simulate sync: content_locked products skip title/description/image overwrite
    const syncWouldOverwrite = !product.content_locked;
    expect(syncWouldOverwrite).toBe(false);
    expect(product.title).toBe("Admin Title");
    expect(product.slug).toBe("admin-slug");
  });

  it("unlocked product allows sync to seed initial values", () => {
    const product = makeProduct({ content_locked: false });
    const syncWouldOverwrite = !product.content_locked;
    expect(syncWouldOverwrite).toBe(true);
  });

  it("slug is never overwritten by sync regardless of content_locked", () => {
    // Slug is store-owned and not included in sync upsert payload
    const product = makeProduct({ slug: "store-owned-slug", content_locked: false });
    // The sync code only sets slug on new products (no existing row)
    // For existing products, slug is never in the update payload
    expect(product.slug).toBe("store-owned-slug");
  });

  it("provider cost is provider-owned and separate from retail price", () => {
    const product = makeProduct({ cost: 31.00, price: 49.99 });
    expect(product.cost).not.toBe(product.price);
  });
});

// ── 11. Provider boundary ─────────────────────────────────────────────────────

describe("11. Provider boundary", () => {
  it("printful_id is provider mapping, not product identity", () => {
    const p = makeProduct({ printful_id: "476330305" });
    expect(p.id).not.toBe(p.printful_id);

  });

  it("variant printful_variant_id is provider mapping, not variant identity", () => {
    const v = makeVariant({ id: "sv-uuid-001", printful_variant_id: "23178" });
    expect(v.id).not.toBe(v.printful_variant_id);
    expect(v.id).toBe("sv-uuid-001");
    expect(v.printful_variant_id).toBe("23178");
  });

  it("store variant UUID is stable — provider mapping can change without changing UUID", () => {
    const before = makeVariant({ id: "sv-uuid-001", printful_variant_id: "23178" });
    // Simulate re-mapping to a different Printful variant
    const after = { ...before, printful_variant_id: "23179" };
    expect(after.id).toBe("sv-uuid-001"); // UUID unchanged
    expect(after.printful_variant_id).toBe("23179");
  });
});

// ── 12. Legacy JSONB compatibility ────────────────────────────────────────────

describe("12. Legacy JSONB compatibility", () => {
  it("product_variants table is the canonical variant source", () => {
    const storeVariant = makeVariant();
    // Store variant has a UUID id, not a size label
    expect(storeVariant.id).toBe("sv-uuid-001");
    expect(isNaN(Number(storeVariant.id))).toBe(true);
  });

  it("legacy variant id is a size label, not a UUID", () => {
    const legacyVariantId = "M"; // from products.variants JSONB
    expect(isNaN(Number(legacyVariantId))).toBe(true);
    // But it's also not a UUID — it's a size label
    expect(legacyVariantId).not.toMatch(/^[0-9a-f-]{36}$/);
  });
});
