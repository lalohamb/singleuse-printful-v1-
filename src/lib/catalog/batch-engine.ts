// Batch Catalog Engine
//
// Pure functions for the Phase 9 Batch Catalog Generator.
// No database calls. No side effects.
//
// Architecture:
//   Design × Recipe matrix
//       ↓
//   Compatibility filter
//       ↓
//   resolveProductRecipe() per item
//       ↓
//   validateProductSpecification() per item
//       ↓
//   dryRunProductSpecification() per item
//       ↓
//   Classify: PASS | WARNING | FAIL
//       ↓
//   Approval gate (FAIL items blocked)
//       ↓
//   Product Creation Engine (per approved item)

import { randomUUID } from "crypto";
import { resolveProductRecipe, type ProductRecipe, type RecipeResolutionInput, type RecipeLayoutTemplate } from "./recipe-engine";
import { validateProductSpecification, dryRunProductSpecification, type ProductSpecification } from "./product-engine";

// ── Batch item types ──────────────────────────────────────────────────────────

export type BatchItemValidationClass = "PASS" | "WARNING" | "FAIL";

export type CompatibilityDecision = "ALLOWED" | "WARNING" | "PROHIBITED";

export interface DesignCompatibilityResult {
  decision: CompatibilityDecision;
  reason: string | null;
}

export interface BatchDesign {
  id: string;
  name: string;
  artwork_url: string;
  file_hash: string | null;
  width: number | null;
  height: number | null;
  status: "active" | "archived" | string;
  // Optional merchandising hints
  tags?: string[];
  product_suitability?: string[];
}

export interface BatchRecipe {
  recipe: ProductRecipe;
  // Resolved Printful variants for this recipe's catalog product
  availableVariants: RecipeResolutionInput["availableVariants"];
  // Optional: layout template for auto-positioning via positioning engine
  layoutTemplate?: RecipeLayoutTemplate;
}

export interface BatchMatrixCell {
  design: BatchDesign;
  recipe: BatchRecipe;
  idempotency_key: string;
  included: boolean;
  compatibility: DesignCompatibilityResult;
}

export interface BatchItemResolution {
  cell: BatchMatrixCell;
  valid: boolean;
  validation_class: BatchItemValidationClass;
  spec: ProductSpecification | null;
  errors: Array<{ field: string; message: string }>;
  warnings: string[];
  dry_run: ReturnType<typeof dryRunProductSpecification> | null;
  preview: {
    resolved_variant_count: number;
    unavailable_variants: string[];
    price_range: { min: number; max: number } | null;
  };
}

// ── Idempotency key ───────────────────────────────────────────────────────────

export function buildBatchItemIdempotencyKey(batchId: string, itemId: string): string {
  return `batch:${batchId}:item:${itemId}`;
}

// ── Compatibility layer ───────────────────────────────────────────────────────
//
// Merchandising eligibility is a SEPARATE layer from provider mappings.
// Provider IDs are never invented here.

export function checkDesignRecipeCompatibility(
  design: BatchDesign,
  recipe: ProductRecipe
): DesignCompatibilityResult {
  // Archived designs are never compatible
  if (design.status === "archived") {
    return { decision: "PROHIBITED", reason: "Design is archived" };
  }

  // Draft recipes cannot be used for batch generation
  if (recipe.status === "draft") {
    return { decision: "PROHIBITED", reason: "Recipe is draft — activate before batch generation" };
  }

  if (recipe.status === "archived") {
    return { decision: "PROHIBITED", reason: "Recipe is archived" };
  }

  // Dimension-based compatibility for embroidery
  if (recipe.technique === "EMBROIDERY") {
    if (design.width && design.height) {
      const aspectRatio = design.width / design.height;
      // Embroidery typically requires near-square or landscape artwork
      if (aspectRatio < 0.3 || aspectRatio > 4) {
        return {
          decision: "WARNING",
          reason: `Extreme aspect ratio (${aspectRatio.toFixed(2)}) may not suit embroidery`,
        };
      }
    }
  }

  // DTG/DTFILM: warn if artwork is very small
  if ((recipe.technique === "DTG" || recipe.technique === "DTFILM") && design.width && design.height) {
    if (design.width < 1800 || design.height < 1800) {
      return {
        decision: "WARNING",
        reason: `Artwork dimensions ${design.width}×${design.height}px may be below recommended DPI for ${recipe.technique}`,
      };
    }
  }

  return { decision: "ALLOWED", reason: null };
}

// ── Matrix generation ─────────────────────────────────────────────────────────

export interface GenerateMatrixInput {
  batchId: string;
  designs: BatchDesign[];
  recipes: BatchRecipe[];
  // Optional: pre-built item IDs (for idempotency when re-generating)
  existingItemIds?: Record<string, string>; // key: `${designId}:${recipeId}` → itemId
}

export interface GenerateMatrixResult {
  cells: BatchMatrixCell[];
  total: number;
  included: number;
  prohibited: number;
  warnings: number;
}

export function generateBatchMatrix(input: GenerateMatrixInput): GenerateMatrixResult {
  const { batchId, designs, recipes, existingItemIds = {} } = input;
  const cells: BatchMatrixCell[] = [];

  for (const design of designs) {
    for (const batchRecipe of recipes) {
      const { recipe } = batchRecipe;
      const compatibility = checkDesignRecipeCompatibility(design, recipe);
      const cellKey = `${design.id}:${recipe.id}`;
      const itemId = existingItemIds[cellKey] ?? randomUUID();
      const idempotency_key = buildBatchItemIdempotencyKey(batchId, itemId);

      cells.push({
        design,
        recipe: batchRecipe,
        idempotency_key,
        included: compatibility.decision !== "PROHIBITED",
        compatibility,
      });
    }
  }

  return {
    cells,
    total: cells.length,
    included: cells.filter((c) => c.included).length,
    prohibited: cells.filter((c) => c.compatibility.decision === "PROHIBITED").length,
    warnings: cells.filter((c) => c.compatibility.decision === "WARNING").length,
  };
}

// ── Resolution ────────────────────────────────────────────────────────────────

export function resolveBatchItem(
  cell: BatchMatrixCell,
  commercialInputs: RecipeResolutionInput["commercialInputs"]
): BatchItemResolution {
  const { design, recipe: batchRecipe, idempotency_key, compatibility } = cell;

  // PROHIBITED cells cannot be resolved
  if (compatibility.decision === "PROHIBITED") {
    return {
      cell,
      valid: false,
      validation_class: "FAIL",
      spec: null,
      errors: [{ field: "compatibility", message: compatibility.reason ?? "Prohibited combination" }],
      warnings: [],
      dry_run: null,
      preview: { resolved_variant_count: 0, unavailable_variants: [], price_range: null },
    };
  }

  const resolution = resolveProductRecipe({
    recipe: batchRecipe.recipe,
    design: {
      id: design.id,
      artwork_url: design.artwork_url,
      width: design.width,
      height: design.height,
      name: design.name,
    },
    availableVariants: batchRecipe.availableVariants,
    commercialInputs,
    idempotency_key,
    layoutTemplate: batchRecipe.layoutTemplate,
  });

  const warnings: string[] = [];
  if (compatibility.decision === "WARNING" && compatibility.reason) {
    warnings.push(compatibility.reason);
  }
  if (resolution.preview.unavailable_variants.length > 0) {
    warnings.push(`${resolution.preview.unavailable_variants.length} variant(s) unavailable`);
  }

  if (!resolution.valid || !resolution.spec) {
    return {
      cell,
      valid: false,
      validation_class: "FAIL",
      spec: null,
      errors: resolution.errors,
      warnings,
      dry_run: null,
      preview: {
        resolved_variant_count: resolution.preview.resolved_variant_count,
        unavailable_variants: resolution.preview.unavailable_variants,
        price_range: resolution.preview.price_range,
      },
    };
  }

  // Force draft — batch generation always creates drafts
  const spec: ProductSpecification = { ...resolution.spec, publication_mode: "draft" };

  const dryRun = dryRunProductSpecification(spec);

  if (!dryRun.valid) {
    return {
      cell,
      valid: false,
      validation_class: "FAIL",
      spec: null,
      errors: dryRun.errors.map((e) => ({ field: e.field, message: e.message })),
      warnings,
      dry_run: dryRun,
      preview: {
        resolved_variant_count: resolution.preview.resolved_variant_count,
        unavailable_variants: resolution.preview.unavailable_variants,
        price_range: resolution.preview.price_range,
      },
    };
  }

  const validation_class: BatchItemValidationClass = warnings.length > 0 ? "WARNING" : "PASS";

  return {
    cell,
    valid: true,
    validation_class,
    spec,
    errors: [],
    warnings,
    dry_run: dryRun,
    preview: {
      resolved_variant_count: resolution.preview.resolved_variant_count,
      unavailable_variants: resolution.preview.unavailable_variants,
      price_range: resolution.preview.price_range,
    },
  };
}

// ── Stale detection ───────────────────────────────────────────────────────────

export interface StaleCheckInput {
  approvedRecipeVersion: string | null;
  currentRecipeUpdatedAt: string;
  approvedDesignHash: string | null;
  currentDesignHash: string | null;
}

export type StaleReason = "STALE_RECIPE" | "STALE_DESIGN" | null;

export function detectStale(input: StaleCheckInput): StaleReason {
  const { approvedRecipeVersion, currentRecipeUpdatedAt, approvedDesignHash, currentDesignHash } = input;

  if (approvedRecipeVersion && approvedRecipeVersion !== currentRecipeUpdatedAt) {
    return "STALE_RECIPE";
  }

  if (approvedDesignHash && currentDesignHash && approvedDesignHash !== currentDesignHash) {
    return "STALE_DESIGN";
  }

  return null;
}

// ── Approval gate ─────────────────────────────────────────────────────────────

export function canApproveItem(item: BatchItemResolution): boolean {
  return item.valid && item.validation_class !== "FAIL";
}

export function canApproveAll(items: BatchItemResolution[]): boolean {
  return items.every(canApproveItem);
}

// ── Batch summary ─────────────────────────────────────────────────────────────

export interface BatchSummary {
  total: number;
  included: number;
  excluded: number;
  pass: number;
  warning: number;
  fail: number;
  approvable: number;
}

export function summarizeBatch(items: BatchItemResolution[]): BatchSummary {
  const included = items.filter((i) => i.cell.included);
  return {
    total: items.length,
    included: included.length,
    excluded: items.length - included.length,
    pass: items.filter((i) => i.validation_class === "PASS").length,
    warning: items.filter((i) => i.validation_class === "WARNING").length,
    fail: items.filter((i) => i.validation_class === "FAIL").length,
    approvable: items.filter(canApproveItem).length,
  };
}

// ── Slug collision detection ──────────────────────────────────────────────────

export function detectSlugCollisions(
  items: Array<{ slug: string; idempotency_key: string }>
): Map<string, string[]> {
  const slugMap = new Map<string, string[]>();
  for (const item of items) {
    const existing = slugMap.get(item.slug) ?? [];
    existing.push(item.idempotency_key);
    slugMap.set(item.slug, existing);
  }
  // Return only collisions (slug used by > 1 item)
  const collisions = new Map<string, string[]>();
  for (const [slug, keys] of slugMap) {
    if (keys.length > 1) collisions.set(slug, keys);
  }
  return collisions;
}

// ── Duplicate product detection ───────────────────────────────────────────────

export interface DuplicateCheckInput {
  designId: string;
  recipeId: string;
  printfulCatalogId: number;
  placement: string;
  technique: string;
}

export function buildDuplicateKey(input: DuplicateCheckInput): string {
  return `${input.designId}:${input.recipeId}:${input.printfulCatalogId}:${input.placement}:${input.technique}`;
}
