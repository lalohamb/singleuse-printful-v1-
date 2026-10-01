// Catalog Builder state types
// These are builder-only types — not stored in DB until draft creation.

import type { PrintfulProduct, PrintfulVariant, PrintfulLayoutTemplate, PrintfulMockupTask } from "@/lib/printful/types";
import type { Design } from "@/types";

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
}

export interface VariantPricing {
  printful_variant_id: string;
  label: string;
  color: string | null;
  size: string | null;
  provider_cost: number;
  retail_price: number;
}

export interface CatalogBuilderState {
  // Stage 1: Blank
  catalogProduct: PrintfulProduct | null;

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

export function initialBuilderState(): CatalogBuilderState {
  return {
    catalogProduct: null,
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
