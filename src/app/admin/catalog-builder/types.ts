// Catalog Builder state types
// These are builder-only types — not stored in DB until draft creation.

import type { PrintfulProduct, PrintfulVariant, PrintfulLayoutTemplate, PrintfulMockupTask } from "@/lib/printful/types";
import type { Design } from "@/types";

export type CreationMode = "single" | "multi" | null;

export type BuilderStage =
  | "mode"
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
  provider_cost: number;
  retail_price: number;
}

// Lightweight summary returned by /api/catalog-builder/product-summary
export interface ProductSummary {
  id: number;
  title: string;
  brand: string | null;
  image: string;
  techniques: Array<{ key: string; display_name: string; is_default: boolean }>;
  total_variants: number;
  available_variants: number;
  color_count: number;
  size_count: number;
  min_cost: number | null;
  max_cost: number | null;
}

export interface CatalogBuilderState {
  // Creation mode
  creationMode: CreationMode;

  // Stage 1: Blank (single) / multi-select
  catalogProduct: PrintfulProduct | null;
  multiSelectedProducts: PrintfulProduct[]; // multi mode

  // Stage 2: Variants
  selectedVariants: PrintfulVariant[];

  // Stage 3: Design
  design: Design | null;

  // Stage 4: Production
  technique: string | null;
  placement: string | null;
  printfileId: string | null;
  activeTemplate: PrintfulLayoutTemplate | null;

  // Stage 5: Designer (configuration)
  artworkUrl: string | null;
  designConfiguration: Record<string, unknown>;

  // Stage 6: Mockups
  mockupTaskKey: string | null;
  completedTask: PrintfulMockupTask | null;
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
  catalogProduct: PrintfulProduct;
  selectedVariants: PrintfulVariant[];
  technique: string | null;
  placement: string | null;
  variantPricing: VariantPricing[];
}

export function initialBuilderState(): CatalogBuilderState {
  return {
    creationMode: null,
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
    mockupTaskKey: null,
    completedTask: null,
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
