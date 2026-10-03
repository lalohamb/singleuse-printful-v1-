// Provider identity resolution for Printful.
//
// Printful uses TWO distinct product ID spaces:
//
//   PrintfulSyncProductId   — store-specific sync product ID (e.g. 476330305)
//                             Obtained from /store/products
//                             Stored in products.printful_id
//
//   PrintfulCatalogProductId — catalog/blank product ID (e.g. 903)
//                              Required by Mockup Generator API
//                              Stored in products.printful_catalog_id
//                              Obtained from sync_variant.product.product_id
//
//   PrintfulSyncVariantId   — store-specific sync variant ID (e.g. 5525324210)
//                             Not currently stored — not needed by application
//
//   PrintfulCatalogVariantId — catalog variant ID (e.g. 23178)
//                              Required by Mockup Generator API
//                              Stored in product_variants.printful_variant_id

import { createClient } from "@supabase/supabase-js";
import { printfulGet } from "./client";

export type PrintfulSyncProductId = number;
export type PrintfulCatalogProductId = number;
export type PrintfulCatalogVariantId = number;

export interface PrintfulProductIdentity {
  /** Printful store/sync product ID — from products.printful_id */
  syncProductId: PrintfulSyncProductId;
  /** Printful catalog product ID — from products.printful_catalog_id */
  catalogProductId: PrintfulCatalogProductId;
}

interface SyncProductDetailResult {
  sync_product: { id: number; name: string };
  sync_variants: { product?: { product_id?: number } }[];
}

/**
 * Resolves the Printful catalog product ID for a storefront product.
 *
 * Resolution order:
 *   1. Use products.printful_catalog_id if already stored (preferred — no extra API call).
 *   2. Fetch from Printful store product API, validate, persist for future calls.
 *   3. Throw if resolution fails.
 *
 * This ensures mockup generation never requires an extra Printful API call
 * once the mapping is established.
 */
export async function resolvePrintfulProductIdentity(
  storeProductUuid: string
): Promise<PrintfulProductIdentity> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: product, error } = await supabase
    .from("products")
    .select("id, printful_id, printful_catalog_id")
    .eq("id", storeProductUuid)
    .maybeSingle();

  if (error || !product) {
    throw new Error(`Product not found: ${storeProductUuid}`);
  }

  // Catalog Builder products: printful_id is intentionally null.
  // Resolve catalog identity from printful_catalog_id directly — no sync product needed.
  if (!product.printful_id) {
    if (product.printful_catalog_id) {
      return {
        syncProductId: 0 as PrintfulSyncProductId, // no sync product — catalog_builder
        catalogProductId: product.printful_catalog_id as PrintfulCatalogProductId,
      };
    }
    throw new Error(
      `Product ${storeProductUuid} has no Printful catalog ID (printful_catalog_id is null). ` +
      `Set printful_catalog_id on the product before generating mockups.`
    );
  }

  const syncProductId = Number(product.printful_id) as PrintfulSyncProductId;

  // Fast path: catalog ID already stored
  if (product.printful_catalog_id) {
    return {
      syncProductId,
      catalogProductId: product.printful_catalog_id as PrintfulCatalogProductId,
    };
  }

  // Fallback: resolve from Printful store product API
  const detail = await printfulGet<SyncProductDetailResult>(
    `/store/products/${syncProductId}`
  );

  const catalogIds = new Set<number>();
  for (const sv of detail.sync_variants ?? []) {
    const id = sv.product?.product_id;
    if (typeof id === "number" && id > 0) catalogIds.add(id);
  }

  if (catalogIds.size === 0) {
    throw new Error(
      `Cannot resolve catalog product ID for sync product ${syncProductId}: ` +
      `no sync variants returned a product.product_id`
    );
  }

  if (catalogIds.size > 1) {
    throw new Error(
      `Catalog product ID conflict for sync product ${syncProductId}: ` +
      `variants report multiple catalog IDs [${[...catalogIds].join(", ")}]. ` +
      `Cannot safely determine which catalog product to use.`
    );
  }

  const catalogProductId = [...catalogIds][0] as PrintfulCatalogProductId;

  // Persist the resolved catalog ID so future calls use the fast path
  await supabase
    .from("products")
    .update({ printful_catalog_id: catalogProductId })
    .eq("id", storeProductUuid);

  return { syncProductId, catalogProductId };
}
