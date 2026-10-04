import { printfulGet, printfulGetV2 } from "./client";
import { PrintfulApiError } from "./errors";
import type {
  PrintfulProduct,
  PrintfulCatalogVariantV2,
  CatalogVariant,
  CatalogVariantResult,
} from "./types";

// ── Legacy catalog list ───────────────────────────────────────────────────────
// GET /products — V1 envelope { code, result: [...] }
// Live-proven: returns 555 products, no pagination, single response.
export async function getCatalogProducts(): Promise<PrintfulProduct[]> {
  return printfulGet<PrintfulProduct[]>("/products");
}

// ── Legacy catalog product detail ─────────────────────────────────────────────
// GET /products/{id} — V1 envelope { code, result: <flat product object> }
// Live-proven: returns flat product object, no variants array.
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
