// Product Creation Engine
//
// Deterministic service layer between UI/recipes and the database/provider APIs.
// Both the Catalog Builder and future Product Recipe system use this engine.
//
// Architecture:
//   Catalog Builder UI  ──┐
//   Product Recipe      ──┤──► ProductSpecification ──► validate ──► create/update
//   Batch Generator     ──┘
//
// Provider IDs are always validated against Printful data — never passed through raw.

// ── ProductSpecification ─────────────────────────────────────────────────────

export interface ProductSpecVariant {
  printful_variant_id: string;  // Printful catalog variant ID — validated
  label: string;
  color: string | null;
  size: string | null;
  retail_price: number;         // store-owned retail price
  provider_cost: number | null; // Printful cost — display only, never overwrites retail
  image_url: string | null;
}

export interface ProductSpecMockup {
  storage_path: string;
  image_url: string;
  mockup_task_key: string | null;
  is_primary: boolean;
  display_order: number;
  variant_ids?: number[];
}

export interface ProductSpecification {
  // Provider identity — validated against Printful catalog
  printful_catalog_id: number;

  // Variants — must all belong to printful_catalog_id
  variants: ProductSpecVariant[];

  // Design — must be active
  design_id: string;
  placement: string;
  technique: string;
  printfile_id: string | null;
  design_configuration: Record<string, unknown>;

  // Commercial content — store-owned
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  brand: string | null;
  product_type: string | null;
  category_id: string | null;
  meta_title: string | null;
  meta_description: string | null;

  // Pricing — base price = min(variant retail prices)
  price: number;

  // Images
  mockups: ProductSpecMockup[];

  // Publication
  publication_mode: "draft" | "active";

  // Idempotency — prevents duplicate creation on retry
  idempotency_key: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export type SpecValidationError =
  | { field: "printful_catalog_id"; message: string }
  | { field: "variants"; message: string }
  | { field: "design_id"; message: string }
  | { field: "placement"; message: string }
  | { field: "technique"; message: string }
  | { field: "title"; message: string }
  | { field: "slug"; message: string }
  | { field: "price"; message: string }
  | { field: "idempotency_key"; message: string };

export interface SpecValidationResult {
  valid: boolean;
  errors: SpecValidationError[];
}

const SLUG_RE = /^[a-z0-9-]+$/;

export function validateProductSpecification(spec: ProductSpecification): SpecValidationResult {
  const errors: SpecValidationError[] = [];

  if (!spec.printful_catalog_id || typeof spec.printful_catalog_id !== "number" || spec.printful_catalog_id <= 0)
    errors.push({ field: "printful_catalog_id", message: "Must be a positive integer" });

  if (!Array.isArray(spec.variants) || spec.variants.length === 0)
    errors.push({ field: "variants", message: "At least one variant is required" });
  else {
    for (const v of spec.variants) {
      if (!v.printful_variant_id)
        errors.push({ field: "variants", message: `Variant missing printful_variant_id` });
      if (typeof v.retail_price !== "number" || v.retail_price <= 0)
        errors.push({ field: "variants", message: `Variant ${v.printful_variant_id}: retail_price must be > 0` });
    }
  }

  if (!spec.design_id || typeof spec.design_id !== "string")
    errors.push({ field: "design_id", message: "design_id is required" });

  if (!spec.placement || typeof spec.placement !== "string")
    errors.push({ field: "placement", message: "placement is required" });

  if (!spec.technique || typeof spec.technique !== "string")
    errors.push({ field: "technique", message: "technique is required" });

  if (!spec.title || typeof spec.title !== "string" || !spec.title.trim())
    errors.push({ field: "title", message: "title is required" });

  if (!spec.slug || !SLUG_RE.test(spec.slug))
    errors.push({ field: "slug", message: "slug must be lowercase alphanumeric with hyphens" });

  if (typeof spec.price !== "number" || spec.price <= 0)
    errors.push({ field: "price", message: "price must be > 0" });

  if (!spec.idempotency_key)
    errors.push({ field: "idempotency_key", message: "idempotency_key is required" });

  return { valid: errors.length === 0, errors };
}

// ── Dry-run result ────────────────────────────────────────────────────────────

export interface DryRunResult {
  valid: boolean;
  errors: SpecValidationError[];
  resolved: {
    printful_catalog_id: number;
    variant_count: number;
    design_id: string;
    placement: string;
    technique: string;
    base_price: number;
    price_range: { min: number; max: number };
    title: string;
    slug: string;
    publication_mode: string;
    mockup_count: number;
    expected_db_operations: string[];
  } | null;
}

export function dryRunProductSpecification(spec: ProductSpecification): DryRunResult {
  const validation = validateProductSpecification(spec);
  if (!validation.valid) {
    return { valid: false, errors: validation.errors, resolved: null };
  }

  const prices = spec.variants.map((v) => v.retail_price).filter((p) => p > 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const ops = [
    "INSERT INTO products (catalog_source=catalog_builder, printful_id=NULL)",
    `INSERT INTO product_variants (${spec.variants.length} rows)`,
    "INSERT INTO product_designs (is_primary=true)",
  ];
  if (spec.mockups.length > 0) {
    ops.push(`INSERT INTO product_images (${spec.mockups.length} rows)`);
    ops.push("UPDATE products SET image_url, images");
  }
  if (spec.publication_mode === "active") {
    ops.push("UPDATE products SET status=active, published_at");
  }

  return {
    valid: true,
    errors: [],
    resolved: {
      printful_catalog_id: spec.printful_catalog_id,
      variant_count: spec.variants.length,
      design_id: spec.design_id,
      placement: spec.placement,
      technique: spec.technique,
      base_price: minPrice,
      price_range: { min: minPrice, max: maxPrice },
      title: spec.title.trim(),
      slug: spec.slug,
      publication_mode: spec.publication_mode,
      mockup_count: spec.mockups.length,
      expected_db_operations: ops,
    },
  };
}

// ── Edit mode: load existing product into a ProductSpecification ──────────────
// Used by Catalog Builder EDIT mode to initialize from persisted state.

export interface ExistingProductState {
  product: {
    id: string;
    title: string;
    slug: string | null;
    description: string | null;
    short_description: string | null;
    brand: string | null;
    product_type: string | null;
    category_id: string | null;
    meta_title: string | null;
    meta_description: string | null;
    price: number;
    printful_catalog_id: number | null;
    status: string;
  };
  variants: Array<{
    id: string;
    printful_variant_id: string | null;
    label: string;
    color: string | null;
    size: string | null;
    retail_price: number;
    provider_cost?: number | null;
    image_url: string | null;
  }>;
  primaryDesign: {
    id: string;
    design_id: string;
    placement: string;
    technique: string | null;
    printfile_id: string | null;
    configuration: Record<string, unknown>;
    designs: { artwork_url: string } | null;
  } | null;
  mockups: Array<{
    storage_path: string | null;
    image_url: string;
    mockup_task_key: string | null;
    is_primary: boolean;
    display_order: number;
  }>;
}

export function existingProductToSpec(
  state: ExistingProductState,
  idempotencyKey: string
): ProductSpecification | null {
  const { product, variants, primaryDesign, mockups } = state;
  if (!product.printful_catalog_id || !primaryDesign) return null;

  return {
    printful_catalog_id: product.printful_catalog_id,
    variants: variants
      .filter((v) => v.printful_variant_id)
      .map((v) => ({
        printful_variant_id: v.printful_variant_id!,
        label: v.label,
        color: v.color,
        size: v.size,
        retail_price: v.retail_price,
        provider_cost: v.provider_cost ?? null,
        image_url: v.image_url,
      })),
    design_id: primaryDesign.design_id,
    placement: primaryDesign.placement,
    technique: primaryDesign.technique ?? "",
    printfile_id: primaryDesign.printfile_id,
    design_configuration: primaryDesign.configuration,
    title: product.title,
    slug: product.slug ?? "",
    description: product.description,
    short_description: product.short_description,
    brand: product.brand,
    product_type: product.product_type,
    category_id: product.category_id,
    meta_title: product.meta_title,
    meta_description: product.meta_description,
    price: product.price,
    mockups: mockups.map((m) => ({
      storage_path: m.storage_path ?? "",
      image_url: m.image_url,
      mockup_task_key: m.mockup_task_key,
      is_primary: m.is_primary,
      display_order: m.display_order,
    })),
    publication_mode: product.status === "active" ? "active" : "draft",
    idempotency_key: idempotencyKey,
  };
}
