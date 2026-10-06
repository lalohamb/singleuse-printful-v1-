// Catalog Builder state types
// These are builder-only types — not stored in DB until draft creation.

import type { V2CatalogProduct, CatalogVariant, V2MockupTemplate, V2MockupTask } from "@/lib/printful/types";
import type { Design } from "@/types";

export type CreationMode = "single" | "multi" | null;

export type BuilderStage =
  | "blank"
  | "variants"
  | "design"
  | "production"
  | "designer"
  | "mockups"
  | "details"
  | "pricing"
  | "review";

export interface BuiltMockup {
  placement: string;
  stored_url: string;
  original_url: string;
  storage_path: string;
  mockup_task_key: string | null;
  is_primary: boolean;
  display_order: number;
  variant_ids?: number[];
}

export interface VariantPricing {
  printful_variant_id: string;
  label: string;
  color: string | null;
  size: string | null;
  // null = unknown; V2 catalog-variant endpoint does not provide cost
  provider_cost: number | null;
  retail_price: number;
}

// Lightweight summary returned by /api/catalog-builder/product-summary
export interface ProductSummary {
  id: number;
  title: string;
  brand: string | null;
  image: string;
  techniques: Array<{ key: string; display_name: string; is_default: boolean }>;
  // null when eligibility !== "eligible"
  total_variants: number | null;
  // null — V2 catalog-variant endpoint does not provide in_stock per variant
  available_variants: number | null;
  color_count: number;
  size_count: number;
  // null — commercial data not available from V2 catalog-variant endpoint
  min_cost: number | null;
  max_cost: number | null;
  // Eligibility from V2 regional check
  eligibility: "eligible" | "unavailable" | "error";
  eligibility_reason: string | null;
}

export interface CatalogBuilderState {
  // Stage 1: Blank
  catalogProduct: V2CatalogProduct | null;
  // multiSelectedProducts preserved for future batch phase — not active in current UX
  multiSelectedProducts: V2CatalogProduct[];

  // Stage 2: Variants
  selectedVariants: CatalogVariant[];

  // Stage 3: Design
  design: Design | null;

  // Stage 4: Production
  technique: string | null;
  placement: string | null;
  printfileId: string | null;
  activeTemplate: V2MockupTemplate | null;   // V2 template — replaces V1 PrintfulLayoutTemplate

  // Stage 5: Designer (configuration)
  artworkUrl: string | null;
  designConfiguration: Record<string, unknown>;

  // Stage 6: Mockups
  mockupTaskId: number | null;               // V2 numeric task ID
  completedV2Task: V2MockupTask | null;      // V2 completed task result
  persistedMockups: BuiltMockup[];
  selectedMockupIndices: number[];

  // Stage 7: Details
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  brand: string;
  productType: string;
  categoryId: string;
  metaTitle: string;
  metaDescription: string;

  // Stage 8: Pricing
  variantPricing: VariantPricing[];

  // Idempotency
  idempotencyKey: string;
}

// Per-product entry in multi-product mode
export interface MultiProductEntry {
  catalogProduct: V2CatalogProduct;
  selectedVariants: CatalogVariant[];
  technique: string | null;
  placement: string | null;
  variantPricing: VariantPricing[];
}

export function initialBuilderState(): CatalogBuilderState {
  return {
    catalogProduct: null,
    multiSelectedProducts: [],
    selectedVariants: [],
    design: null,
    technique: null,
    placement: null,
    printfileId: null,
    activeTemplate: null,
    artworkUrl: null,
    designConfiguration: {},
    mockupTaskId: null,
    completedV2Task: null,
    persistedMockups: [],
    selectedMockupIndices: [],
    title: "",
    slug: "",
    description: "",
    shortDescription: "",
    brand: "",
    productType: "",
    categoryId: "",
    metaTitle: "",
    metaDescription: "",
    variantPricing: [],
    idempotencyKey: crypto.randomUUID(),
  };
}
