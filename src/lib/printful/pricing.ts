// Printful Provider Pricing — Phase 11A.4
//
// Live-proven endpoint: GET /v2/catalog-products/{id}/prices
// Live-proven contract (product 679, 2026-09-27):
//   envelope: { data: { currency, product: { id, placements }, variants, discount_tiers }, paging, extra, _links }
//   paginated at 20 per page; paging.total is authoritative
//   variants[].techniques[] — per-variant, per-technique price
//   product.placements[]   — per-placement, per-technique price (product-level, not per-variant)
//
// CatalogVariant is NOT modified. This is a separate pricing layer.
//
// Provider cost formula (once technique + placement are known):
//   provider_cost = variant.techniques[technique_key].discounted_price (or .price)
//                 + product.placements[placement_id].discounted_price (or .price)
//                 + sum(placement.layers[].additional_price)

import { printfulGetV2 } from "./client";

// ── Raw V2 response types (live-proven fields only) ───────────────────────────

export interface PrintfulVariantTechniquePrice {
  technique_key: string;
  technique_display_name: string;
  /** String decimal, e.g. "19.64" */
  price: string;
  /** String decimal — use this when available; equals price when no store discount */
  discounted_price: string;
}

export interface PrintfulPlacementLayer {
  type: string;
  /** String decimal, e.g. "0.00" */
  additional_price: string;
  layer_options: unknown[];
}

export interface PrintfulPlacementPrice {
  id: string;
  title: string;
  type: string;
  technique_key: string;
  placement_options: unknown[];
  /** String decimal */
  price: string;
  /** String decimal — use this when available */
  discounted_price: string;
  layers: PrintfulPlacementLayer[];
}

export interface PrintfulCatalogProductPriceV2 {
  id: number;
  placements: PrintfulPlacementPrice[];
}

export interface PrintfulCatalogVariantPriceV2 {
  id: number;
  techniques: PrintfulVariantTechniquePrice[];
}

// ── Normalized CountyBuys pricing model ──────────────────────────────────────
// Separate from CatalogVariant — CatalogVariant remains identity-only.

export interface CatalogProductPricing {
  /** Printful catalog product ID */
  catalog_product_id: number;
  /** ISO 4217 currency code, e.g. "USD" */
  currency: string;
  /** Placement prices — product-level, not per-variant */
  placements: PrintfulPlacementPrice[];
  /** Per-variant technique prices, keyed by catalog variant ID */
  variantPrices: Map<number, PrintfulVariantTechniquePrice[]>;
}

// ── Effective amount helper ───────────────────────────────────────────────────
// Use discounted_price when it is a valid positive number string.
// Fall back to price. Never return null — caller must handle missing entries.

export function effectiveAmount(price: string, discountedPrice: string): number {
  const discounted = parseFloat(discountedPrice);
  if (isFinite(discounted) && discounted > 0) return discounted;
  const base = parseFloat(price);
  if (isFinite(base) && base >= 0) return base;
  return 0;
}

// ── Provider cost resolver ────────────────────────────────────────────────────
// Pure function. Deterministic. No API calls.
//
// Returns null (unknown) when:
//   - pricing is null (not yet fetched)
//   - variantId not found in pricing
//   - techniqueKey not found in variant's techniques
//   - placementId not found in product placements
//
// Never uses techniques[0] or placements[0] as authoritative fallback.
// Never fabricates a value.

export type ProviderCostResult =
  | { status: "resolved"; cost: number; variantAmount: number; placementAmount: number; layerAmount: number }
  | { status: "unknown"; reason: string };

export function resolveProviderCost(
  pricing: CatalogProductPricing | null,
  variantId: number,
  techniqueKey: string,
  placementId: string
): ProviderCostResult {
  if (!pricing) {
    return { status: "unknown", reason: "Pricing not yet fetched" };
  }

  // Resolve variant technique price
  const variantTechniques = pricing.variantPrices.get(variantId);
  if (!variantTechniques) {
    return { status: "unknown", reason: `Variant ${variantId} not found in pricing data` };
  }

  // Normalize to lowercase: V1 /products/{id} returns technique keys uppercase (e.g. "DTFILM")
  // while V2 /prices returns them lowercase (e.g. "dtfilm"). Compare case-insensitively.
  const techniqueKeyNorm = techniqueKey.toLowerCase();
  const techniqueEntry = variantTechniques.find(
    (t) => t.technique_key.toLowerCase() === techniqueKeyNorm
  );
  if (!techniqueEntry) {
    return {
      status: "unknown",
      reason: `Technique "${techniqueKey}" not found for variant ${variantId}`,
    };
  }

  // Resolve placement price
  const placementEntry = pricing.placements.find((p) => p.id === placementId);
  if (!placementEntry) {
    return {
      status: "unknown",
      reason: `Placement "${placementId}" not found in product pricing`,
    };
  }

  const variantAmount = effectiveAmount(techniqueEntry.price, techniqueEntry.discounted_price);
  const placementAmount = effectiveAmount(placementEntry.price, placementEntry.discounted_price);

  // Sum layer additional prices
  let layerAmount = 0;
  for (const layer of placementEntry.layers) {
    const layerPrice = parseFloat(layer.additional_price);
    if (isFinite(layerPrice) && layerPrice > 0) {
      layerAmount += layerPrice;
    }
  }

  const cost = Math.round((variantAmount + placementAmount + layerAmount) * 100) / 100;

  return { status: "resolved", cost, variantAmount, placementAmount, layerAmount };
}

// ── Product pricing retrieval ─────────────────────────────────────────────────
// GET /v2/catalog-products/{productId}/prices
// Paginated at 20 per page. Accumulates all pages. Deduplicates by variant ID.
// Uses printfulGetV2() — V2 envelope { data, paging, extra, _links }.
// Never calls /v2/catalog-variants/{id}/prices for bulk retrieval.

const PAGE_SIZE = 20;
const MAX_PAGES = 100; // finite-loop guard

export async function getCatalogProductPrices(
  productId: number
): Promise<CatalogProductPricing> {
  const variantPrices = new Map<number, PrintfulVariantTechniquePrice[]>();
  const seenIds = new Set<number>();
  let placements: PrintfulPlacementPrice[] = [];
  let currency = "USD";
  let total: number | null = null;
  let offset = 0;
  let pageCount = 0;

  do {
    const path = `/v2/catalog-products/${productId}/prices?limit=${PAGE_SIZE}&offset=${offset}`;
    const envelope = await printfulGetV2<{
      currency: string;
      product: PrintfulCatalogProductPriceV2;
      variants: PrintfulCatalogVariantPriceV2[];
      discount_tiers: unknown[];
    }>(path);

    const data = envelope.data;

    // Capture currency and placements from first page
    if (pageCount === 0) {
      currency = data.currency ?? "USD";
      placements = Array.isArray(data.product?.placements) ? data.product.placements : [];
    }

    // Establish total from paging metadata
    if (total === null) {
      total = typeof envelope.paging?.total === "number" ? envelope.paging.total : 0;
    }

    // Guard: malformed or missing paging — stop after first page
    if (!envelope.paging || typeof envelope.paging.total !== "number") break;

    const variants = Array.isArray(data.variants) ? data.variants : [];
    for (const v of variants) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        variantPrices.set(v.id, Array.isArray(v.techniques) ? v.techniques : []);
      }
    }

    offset += PAGE_SIZE;
    pageCount++;
  } while (seenIds.size < (total ?? 0) && pageCount < MAX_PAGES);

  return {
    catalog_product_id: productId,
    currency,
    placements,
    variantPrices,
  };
}
