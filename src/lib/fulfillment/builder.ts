// Phase 5.1: Printful Direct Catalog Order Item Builder
//
// buildPrintfulCatalogOrderItem(snapshot, quantity, variantLabel) constructs
// the exact Printful Orders API item payload from an immutable FulfillmentSnapshot.
//
// For DIRECT_CATALOG_ORDER:
//   Uses printful_catalog_variant_id directly — no sync_variant_id.
//
// For SYNC_VARIANT:
//   Uses printful_catalog_variant_id as the variant_id (existing behavior).
//   The existing stripe-webhook already handles this path.
//
// This builder is used by the stripe-webhook for catalog_builder products.

import type { FulfillmentSnapshot, PrintfulCatalogOrderItem } from "./types";

export function buildPrintfulCatalogOrderItem(
  snapshot: FulfillmentSnapshot,
  quantity: number,
  retailPrice: number,
  variantLabel: string
): PrintfulCatalogOrderItem {
  if (snapshot.version !== 1) {
    throw new Error(`Unsupported fulfillment snapshot version: ${snapshot.version}`);
  }
  if (snapshot.strategy !== "DIRECT_CATALOG_ORDER") {
    throw new Error(
      `buildPrintfulCatalogOrderItem called with strategy ${snapshot.strategy}. ` +
        `Use existing sync-variant path for SYNC_VARIANT products.`
    );
  }
  if (!snapshot.printful_catalog_variant_id || snapshot.printful_catalog_variant_id <= 0) {
    throw new Error(
      `Snapshot has invalid printful_catalog_variant_id: ${snapshot.printful_catalog_variant_id}`
    );
  }
  if (!snapshot.files || snapshot.files.length === 0) {
    throw new Error(`Snapshot has no manufacturing files`);
  }
  if (!snapshot.artwork_url) {
    throw new Error(`Snapshot has no artwork_url`);
  }

  return {
    variant_id: snapshot.printful_catalog_variant_id,
    quantity: Math.max(1, Math.floor(quantity)),
    retail_price: retailPrice.toFixed(2),
    name: variantLabel,
    files: snapshot.files,
    options: snapshot.options,
  };
}

// Deterministic external_id for a store order.
// Used for idempotency: same order always produces the same external_id.
// Printful deduplicates on external_id — prevents duplicate orders on retry.
export function buildPrintfulExternalId(storeOrderId: string): string {
  return `store-order-${storeOrderId}`;
}
