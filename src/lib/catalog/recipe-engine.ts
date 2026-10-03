// Product Recipe Engine
//
// A ProductRecipe is a reusable merchandising/manufacturing template.
// It is NOT a product. It resolves INTO a ProductSpecification.
//
// Architecture:
//   Design + ProductRecipe + CommercialInputs
//       ↓
//   resolveProductRecipe()
//       ↓
//   ProductSpecification
//       ↓
//   validateProductSpecification() + dryRunProductSpecification()
//       ↓
//   Product Creation Engine

import {
  validateProductSpecification,
  type ProductSpecification,
  type ProductSpecVariant,
  type SpecValidationError,
} from "./product-engine";
import { computePositionFromTemplate, isValidPosition } from "./positioning";

// ── Recipe types ──────────────────────────────────────────────────────────────

export interface VariantRules {
  colors?: string[];           // allowed color names (empty = all)
  sizes?: string[];            // allowed size names (empty = all)
  exclude_variant_ids?: number[]; // Printful catalog variant IDs to exclude
}

export type PricingStrategy = "FIXED_PRICE" | "COST_PLUS";

export interface PricingRules {
  strategy: PricingStrategy;
  fixed_price?: number;        // used when strategy = FIXED_PRICE
  cost_plus_margin?: number;   // added to provider cost when strategy = COST_PLUS
  rounding?: "none" | "ceil" | "nearest_99"; // optional rounding
  min_price?: number;          // floor — never go below this
}

export interface MockupRules {
  views?: string[];            // e.g. ["front", "model"]
  max_mockups?: number;
}

export interface CommercialDefaults {
  brand?: string;
  product_type?: string;
  category_id?: string;
  description_template?: string;
  meta_title_template?: string;
  meta_description_template?: string;
}

export interface ProductRecipe {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: "draft" | "active" | "archived";
  provider: string;
  printful_catalog_id: number;
  technique: string;
  placement: string;
  printfile_id: number | null;
  variant_rules: VariantRules;
  pricing_rules: PricingRules;
  mockup_rules: MockupRules;
  commercial_defaults: CommercialDefaults;
  publication_default: "draft" | "active";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Input for creating/updating a recipe (omits server-generated fields)
export type ProductRecipeInput = Omit<ProductRecipe, "id" | "created_at" | "updated_at">;

// ── Recipe validation ─────────────────────────────────────────────────────────

export type RecipeValidationError = {
  field: string;
  message: string;
};

export interface RecipeValidationResult {
  valid: boolean;
  errors: RecipeValidationError[];
}

const SLUG_RE = /^[a-z0-9-]+$/;
const SUPPORTED_PROVIDERS = new Set(["printful"]);
const SUPPORTED_PUBLICATION = new Set(["draft", "active"]);
const SUPPORTED_STATUS = new Set(["draft", "active", "archived"]);
const SUPPORTED_PRICING = new Set(["FIXED_PRICE", "COST_PLUS"]);

export function validateProductRecipe(recipe: ProductRecipeInput): RecipeValidationResult {
  const errors: RecipeValidationError[] = [];

  if (!recipe.name?.trim())
    errors.push({ field: "name", message: "name is required" });

  if (!recipe.slug || !SLUG_RE.test(recipe.slug))
    errors.push({ field: "slug", message: "slug must be lowercase alphanumeric with hyphens" });

  if (!SUPPORTED_PROVIDERS.has(recipe.provider))
    errors.push({ field: "provider", message: `Unsupported provider: ${recipe.provider}` });

  if (!recipe.printful_catalog_id || recipe.printful_catalog_id <= 0)
    errors.push({ field: "printful_catalog_id", message: "printful_catalog_id must be a positive integer" });

  if (!recipe.technique?.trim())
    errors.push({ field: "technique", message: "technique is required" });

  if (!recipe.placement?.trim())
    errors.push({ field: "placement", message: "placement is required" });

  if (!SUPPORTED_STATUS.has(recipe.status))
    errors.push({ field: "status", message: `Invalid status: ${recipe.status}` });

  if (!SUPPORTED_PUBLICATION.has(recipe.publication_default))
    errors.push({ field: "publication_default", message: `Invalid publication_default: ${recipe.publication_default}` });

  // Pricing rules
  const pr = recipe.pricing_rules;
  if (!pr || !SUPPORTED_PRICING.has(pr.strategy))
    errors.push({ field: "pricing_rules.strategy", message: "pricing_rules.strategy must be FIXED_PRICE or COST_PLUS" });
  else {
    if (pr.strategy === "FIXED_PRICE") {
      if (typeof pr.fixed_price !== "number" || pr.fixed_price <= 0)
        errors.push({ field: "pricing_rules.fixed_price", message: "fixed_price must be > 0 for FIXED_PRICE strategy" });
    }
    if (pr.strategy === "COST_PLUS") {
      if (typeof pr.cost_plus_margin !== "number" || pr.cost_plus_margin < 0)
        errors.push({ field: "pricing_rules.cost_plus_margin", message: "cost_plus_margin must be >= 0 for COST_PLUS strategy" });
    }
    if (pr.min_price !== undefined && (typeof pr.min_price !== "number" || pr.min_price < 0))
      errors.push({ field: "pricing_rules.min_price", message: "min_price must be >= 0" });
  }

  return { valid: errors.length === 0, errors };
}

// ── Pricing engine ────────────────────────────────────────────────────────────

export function applyPricingRules(
  providerCost: number,
  rules: PricingRules
): number {
  let price: number;

  if (rules.strategy === "FIXED_PRICE") {
    if (typeof rules.fixed_price !== "number" || rules.fixed_price <= 0)
      throw new Error("FIXED_PRICE requires fixed_price > 0");
    price = rules.fixed_price;
  } else if (rules.strategy === "COST_PLUS") {
    if (typeof rules.cost_plus_margin !== "number")
      throw new Error("COST_PLUS requires cost_plus_margin");
    price = providerCost + rules.cost_plus_margin;
  } else {
    throw new Error(`Unknown pricing strategy: ${(rules as PricingRules).strategy}`);
  }

  // Apply rounding
  if (rules.rounding === "ceil") {
    price = Math.ceil(price);
  } else if (rules.rounding === "nearest_99") {
    price = Math.floor(price) + 0.99;
  }

  // Apply floor
  if (rules.min_price !== undefined) {
    price = Math.max(price, rules.min_price);
  }

  if (price <= 0) throw new Error("Pricing rules produced price <= 0");
  return Math.round(price * 100) / 100;
}

// ── Recipe resolution input/output ────────────────────────────────────────────

// Printful layout template — used to auto-compute position via positioning engine
export interface RecipeLayoutTemplate {
  print_area_width: number;
  print_area_height: number;
  canvas_dpi: number; // from matching PrintfulPrintfileDetail
}

export interface RecipeResolutionInput {
  recipe: ProductRecipe;
  design: {
    id: string;
    artwork_url: string;
    width: number | null;
    height: number | null;
    name: string;
  };
  // Resolved Printful catalog variants for the recipe's catalog product
  // Must be fetched from Printful before calling resolveProductRecipe
  availableVariants: Array<{
    id: number;
    name: string;
    color: string;
    size: string;
    price: string; // provider cost as string (Printful format)
    availability_status?: string;
  }>;
  // Commercial overrides (title, slug, description, etc.)
  commercialInputs: {
    title: string;
    slug: string;
    description?: string;
    short_description?: string;
    brand?: string;
    product_type?: string;
    category_id?: string;
    meta_title?: string;
    meta_description?: string;
  };
  idempotency_key: string;
  // Optional: when provided, position is auto-computed via positioning engine
  // and frozen into design_configuration.position
  layoutTemplate?: RecipeLayoutTemplate;
}

export interface RecipeResolutionResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  spec: ProductSpecification | null;
  // Preview info (available even when valid=false for partial resolution)
  preview: {
    resolved_variant_count: number;
    unavailable_variants: string[];
    price_range: { min: number; max: number } | null;
    design_validation: "PASS" | "PASS_WARNING" | "FAIL" | "UNVERIFIED";
  };
}

// ── Recipe resolver ───────────────────────────────────────────────────────────

export function resolveProductRecipe(input: RecipeResolutionInput): RecipeResolutionResult {
  const { recipe, design, availableVariants, commercialInputs, idempotency_key } = input;
  const errors: Array<{ field: string; message: string }> = [];

  // 1. Validate recipe is active
  if (recipe.status === "archived") {
    errors.push({ field: "recipe.status", message: "Archived recipe cannot generate a product specification" });
    return { valid: false, errors, spec: null, preview: { resolved_variant_count: 0, unavailable_variants: [], price_range: null, design_validation: "UNVERIFIED" } };
  }

  // 2. Filter variants by recipe rules
  const rules = recipe.variant_rules;
  const excludeIds = new Set(rules.exclude_variant_ids ?? []);

  let filtered = availableVariants.filter((v) => {
    if (excludeIds.has(v.id)) return false;
    if (rules.colors?.length && !rules.colors.includes(v.color)) return false;
    if (rules.sizes?.length && !rules.sizes.includes(v.size)) return false;
    return true;
  });

  const unavailable = filtered
    .filter((v) => v.availability_status && v.availability_status !== "active")
    .map((v) => v.name);

  filtered = filtered.filter((v) => !v.availability_status || v.availability_status === "active");

  if (filtered.length === 0) {
    errors.push({ field: "variants", message: "No variants match the recipe rules or all are unavailable" });
  }

  // 3. Apply pricing rules to each variant
  const specVariants: ProductSpecVariant[] = [];
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const v of filtered) {
    const providerCost = parseFloat(v.price) || 0;
    let retailPrice: number;
    try {
      retailPrice = applyPricingRules(providerCost, recipe.pricing_rules);
    } catch (e) {
      errors.push({ field: "pricing_rules", message: `Pricing failed for variant ${v.name}: ${(e as Error).message}` });
      continue;
    }
    minPrice = Math.min(minPrice, retailPrice);
    maxPrice = Math.max(maxPrice, retailPrice);
    specVariants.push({
      printful_variant_id: String(v.id),
      label: v.name,
      color: v.color,
      size: v.size,
      retail_price: retailPrice,
      provider_cost: providerCost,
      image_url: null,
    });
  }

  const priceRange = specVariants.length > 0
    ? { min: minPrice, max: maxPrice }
    : null;

  // 4. Validate commercial inputs
  if (!commercialInputs.title?.trim())
    errors.push({ field: "commercialInputs.title", message: "title is required" });
  if (!commercialInputs.slug || !/^[a-z0-9-]+$/.test(commercialInputs.slug))
    errors.push({ field: "commercialInputs.slug", message: "slug must be lowercase alphanumeric with hyphens" });

  // 5. Design validation status (caller provides this — we just record it)
  // FAIL artwork blocks resolution
  const designValidation: RecipeResolutionResult["preview"]["design_validation"] = "UNVERIFIED";

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      spec: null,
      preview: {
        resolved_variant_count: specVariants.length,
        unavailable_variants: unavailable,
        price_range: priceRange,
        design_validation: designValidation,
      },
    };
  }

  // 6. Build ProductSpecification
  const basePrice = Math.min(...specVariants.map((v) => v.retail_price));

  // Auto-compute position from layout template if provided and artwork has dimensions
  let autoPosition: ReturnType<typeof computePositionFromTemplate> | null = null;
  if (input.layoutTemplate && design.width && design.height) {
    autoPosition = computePositionFromTemplate(
      { width: design.width, height: design.height },
      input.layoutTemplate,
      input.layoutTemplate.canvas_dpi
    );
  }

  const spec: ProductSpecification = {
    printful_catalog_id: recipe.printful_catalog_id,
    variants: specVariants,
    design_id: design.id,
    placement: recipe.placement,
    technique: recipe.technique,
    printfile_id: recipe.printfile_id ? String(recipe.printfile_id) : null,
    design_configuration: {
      artworkUrl: design.artwork_url,
      placement: recipe.placement,
      technique: recipe.technique,
      catalog_product_id: recipe.printful_catalog_id,
      ...(autoPosition && isValidPosition(autoPosition.position)
        ? {
            position: autoPosition.position,
            positioning_strategy: autoPosition.strategy,
            positioning_dpi: autoPosition.effective_dpi,
            positioning_validation: autoPosition.validation,
          }
        : {}),
    },
    title: commercialInputs.title.trim(),
    slug: commercialInputs.slug,
    description: commercialInputs.description ?? recipe.commercial_defaults.description_template ?? null,
    short_description: commercialInputs.short_description ?? null,
    brand: commercialInputs.brand ?? recipe.commercial_defaults.brand ?? null,
    product_type: commercialInputs.product_type ?? recipe.commercial_defaults.product_type ?? null,
    category_id: commercialInputs.category_id ?? recipe.commercial_defaults.category_id ?? null,
    meta_title: commercialInputs.meta_title ?? null,
    meta_description: commercialInputs.meta_description ?? null,
    price: basePrice,
    mockups: [],
    publication_mode: recipe.publication_default,
    idempotency_key,
  };

  // 7. Validate the resulting spec
  const specValidation = validateProductSpecification(spec);
  if (!specValidation.valid) {
    return {
      valid: false,
      errors: specValidation.errors.map((e: SpecValidationError) => ({ field: e.field, message: e.message })),
      spec: null,
      preview: {
        resolved_variant_count: specVariants.length,
        unavailable_variants: unavailable,
        price_range: priceRange,
        design_validation: designValidation,
      },
    };
  }

  return {
    valid: true,
    errors: [],
    spec,
    preview: {
      resolved_variant_count: specVariants.length,
      unavailable_variants: unavailable,
      price_range: priceRange,
      design_validation: designValidation,
    },
  };
}
