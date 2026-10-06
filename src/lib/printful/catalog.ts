import { printfulGet, printfulGetV2 } from "./client";
import { PrintfulApiError } from "./errors";
import type {
  PrintfulProduct,
  PrintfulCatalogVariantV2,
  CatalogVariant,
  CatalogVariantResult,
  V2CatalogProduct,
  V2CatalogProductRaw,
} from "./types";

// ── V2 catalog product list ───────────────────────────────────────────────────
// GET /v2/catalog-products
// V2 envelope: { data: [...], paging: { total, limit, offset }, extra, _links }
// Paginated. All pages accumulated. Deduplicated by product ID.
// Store/selling-region scoped — returns only products available for this store.
// V2 uses `name` where V1 used `title`. Normalized here.
// Technique keys are lowercase in V2 (e.g. "dtfilm") — preserved as-is.
const CATALOG_PAGE_SIZE = 100;

// normalizeV2Product returns V2CatalogProduct — NOT PrintfulProduct.
// currency, files[], and options[] are absent because V2 does not provide them.
// Do not add them back. Callers that need V1-only fields must use getCatalogProduct() (V1).
function normalizeV2Product(raw: V2CatalogProductRaw): V2CatalogProduct {
  return {
    id: raw.id,
    main_category_id: raw.main_category_id,
    type: raw.type,
    type_name: raw.type,               // V2 has no separate type_name; use type
    title: raw.name,                   // V2 `name` → CountyBuys `title`
    brand: raw.brand,
    model: raw.model,
    image: raw.image,
    variant_count: raw.variant_count,
    is_discontinued: raw.is_discontinued,
    avg_fulfillment_time: null,        // not provided by V2
    description: raw.description,
    techniques: raw.techniques,
    placements: raw.placements,
    dimensions: null,                  // not provided by V2
    // currency, files, options intentionally absent — V2 does not provide them
  };
}

export async function getCatalogProductsV2(): Promise<V2CatalogProduct[]> {
  const accumulated: V2CatalogProduct[] = [];
  const seenIds = new Set<number>();
  let offset = 0;
  let total: number | null = null;
  const MAX_PAGES = 20;
  let pageCount = 0;

  do {
    const path = `/v2/catalog-products?limit=${CATALOG_PAGE_SIZE}&offset=${offset}`;
    const envelope = await printfulGetV2<V2CatalogProductRaw[]>(path);
    const page = Array.isArray(envelope.data) ? envelope.data : [];

    for (const raw of page) {
      if (!seenIds.has(raw.id)) {
        seenIds.add(raw.id);
        accumulated.push(normalizeV2Product(raw));
      }
    }

    if (total === null) {
      total = typeof envelope.paging?.total === "number" ? envelope.paging.total : page.length;
    }
    if (!envelope.paging || typeof envelope.paging.total !== "number") break;

    offset += CATALOG_PAGE_SIZE;
    pageCount++;
  } while (accumulated.length < (total ?? 0) && pageCount < MAX_PAGES);

  return accumulated;
}

// ── V2 catalog product detail ─────────────────────────────────────────────────
// GET /v2/catalog-products/{id}
// V2 envelope: { data: { ...product }, extra: [] } — single object, not paginated.
// Includes placements[].conflicting_placements — authoritative Catalog Builder source.
export async function getCatalogProductV2(productId: number): Promise<V2CatalogProduct> {
  const envelope = await printfulGetV2<V2CatalogProductRaw>(`/v2/catalog-products/${productId}`);
  return normalizeV2Product(envelope.data);
}

// ── Legacy catalog list (V1) ──────────────────────────────────────────────────
// LEGACY V1 ONLY — retained for ProductDesigner and printful_sync callers.
// GET /products — V1 envelope { code, result: [...] }
// Live-proven: returns 557 products, no pagination, single response.
// Do NOT use for new Catalog Builder development.
export async function getCatalogProducts(): Promise<PrintfulProduct[]> {
  return printfulGet<PrintfulProduct[]>("/products");
}

// LEGACY V1 ONLY — retained for ProductDesigner and printful_sync callers.
// GET /products/{id} — V1 envelope { code, result: <flat product object> }
// Live-proven: returns flat product object, no variants array.
// Do NOT use for new Catalog Builder development.
export async function getCatalogProduct(productId: number): Promise<PrintfulProduct> {
  return printfulGet<PrintfulProduct>(`/products/${productId}`);
}

// ── V2 catalog variants ───────────────────────────────────────────────────────
// GET /v2/catalog-products/{id}/catalog-variants
// V2 envelope: { data: [...], paging: { total, limit, offset }, extra, _links }
// Paginated: limit=20 per page. Must accumulate all pages.
// Returns CatalogVariantResult so callers can distinguish:
//   eligible   — variants retrieved successfully
//   unavailable — product not available in current store/region (404 with region message)
//   error       — unexpected provider failure
//
// IMPORTANT: CatalogVariant does NOT include price or in_stock.
// Those fields are not present in the V2 catalog-variant endpoint.
// Do not fabricate them.

const REGION_UNAVAILABLE_REASONS = [
  "not available in the selected selling region",
  "not available in the selected region",
];

function isRegionUnavailable(message: string): boolean {
  const lower = message.toLowerCase();
  return REGION_UNAVAILABLE_REASONS.some((r) => lower.includes(r));
}

function normalizeVariant(raw: PrintfulCatalogVariantV2): CatalogVariant {
  return {
    id: raw.id,
    catalog_product_id: raw.catalog_product_id,
    name: raw.name,
    size: raw.size,
    color: raw.color,
    color_code: raw.color_code,
    image: raw.image,
  };
}

export async function getCatalogVariants(productId: number): Promise<CatalogVariantResult> {
  const PAGE_SIZE = 20;
  const accumulated: CatalogVariant[] = [];
  const seenIds = new Set<number>();
  let offset = 0;
  let total: number | null = null;

  try {
    do {
      const path = `/v2/catalog-products/${productId}/catalog-variants?limit=${PAGE_SIZE}&offset=${offset}`;
      const envelope = await printfulGetV2<PrintfulCatalogVariantV2[]>(path);

      const page = Array.isArray(envelope.data) ? envelope.data : [];

      for (const raw of page) {
        if (!seenIds.has(raw.id)) {
          seenIds.add(raw.id);
          accumulated.push(normalizeVariant(raw));
        }
      }

      // Establish total from first page paging metadata
      if (total === null) {
        total = typeof envelope.paging?.total === "number" ? envelope.paging.total : page.length;
      }

      // Guard: if paging is malformed or missing, stop after first page
      if (!envelope.paging || typeof envelope.paging.total !== "number") break;

      offset += PAGE_SIZE;
    } while (accumulated.length < total);

    return { eligibility: "eligible", variants: accumulated };
  } catch (err) {
    if (err instanceof PrintfulApiError && err.isNotFound) {
      // Distinguish regional unavailability from a generic 404
      if (isRegionUnavailable(err.message)) {
        return {
          eligibility: "unavailable",
          variants: [],
          reason: "Not available for the current fulfillment region.",
        };
      }
      // Generic 404 — endpoint not found or product does not exist
      return {
        eligibility: "error",
        variants: [],
        reason: err.clientMessage,
      };
    }
    // Any other error (rate limit, server error, network)
    return {
      eligibility: "error",
      variants: [],
      reason: err instanceof Error ? err.message : "Failed to retrieve catalog variants.",
    };
  }
}
