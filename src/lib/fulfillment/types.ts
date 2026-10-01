// Phase 5.1: Fulfillment Bridge Types
//
// FulfillmentSnapshot is the immutable manufacturing configuration frozen at
// checkout time for a single order item. Once associated with a purchased
// order item it MUST NOT be rebuilt from the current product state.
// Webhook retries use the stored snapshot exclusively.
//
// Version 1 supports:
//   - catalog_builder products: DIRECT_CATALOG_ORDER strategy
//   - printful_sync products:   SYNC_VARIANT strategy (existing behavior)

export type FulfillmentStrategy = "DIRECT_CATALOG_ORDER" | "SYNC_VARIANT";

export interface FulfillmentFile {
  type: string;   // Printful file type / placement key (e.g. "embroidery_front_large")
  url: string;    // Trusted artwork URL from Supabase Storage
}

export interface FulfillmentOption {
  id: string;     // Printful option ID (e.g. "embroidery_type", "thread_colors_front_large")
  value: string | string[];
}

// Immutable snapshot frozen at checkout for one order line item.
export interface FulfillmentSnapshot {
  version: 1;
  strategy: FulfillmentStrategy;

  // Store identity (never changes)
  store_product_id: string;       // products.id UUID
  store_variant_id: string;       // product_variants.id UUID

  // Provider identity
  printful_catalog_product_id: number;   // products.printful_catalog_id
  printful_catalog_variant_id: number;   // product_variants.printful_variant_id (numeric)

  // Design identity (frozen at checkout)
  design_id: string;              // designs.id UUID
  artwork_url: string;            // designs.artwork_url — trusted Supabase Storage URL
  placement: string;              // product_designs.placement
  technique: string;              // product_designs.technique

  // Manufacturing files for Printful Orders API
  files: FulfillmentFile[];

  // Required provider options (technique-specific)
  options: FulfillmentOption[];

  // Snapshot creation timestamp
  frozen_at: string;              // ISO 8601
}

// Printful direct catalog order item built from a snapshot.
// This is the exact shape submitted to POST /orders.
export interface PrintfulCatalogOrderItem {
  variant_id: number;             // Printful catalog variant ID — NOT sync_variant_id
  quantity: number;
  retail_price: string;
  name: string;
  files: FulfillmentFile[];
  options: FulfillmentOption[];
}

// Per-item snapshot map stored in orders.fulfillment_snapshot JSONB.
// Keyed by store_variant_id for O(1) lookup during webhook retries.
export type OrderFulfillmentSnapshot = Record<string, FulfillmentSnapshot>;
