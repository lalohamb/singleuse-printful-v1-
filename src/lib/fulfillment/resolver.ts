// Phase 5.1: Server-side Fulfillment Resolver
//
// resolveFulfillmentSnapshot(storeVariantId) resolves a store variant UUID
// to an immutable FulfillmentSnapshot by querying the database server-side.
//
// The browser never supplies authoritative provider IDs, artwork URLs,
// placement, technique, or options. All manufacturing data is resolved
// exclusively from trusted application records.
//
// Supports two strategies:
//   DIRECT_CATALOG_ORDER — catalog_builder products (Phase 5.1)
//   SYNC_VARIANT         — printful_sync products (existing behavior)
//
// Fails closed: throws if any required manufacturing field is missing.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  FulfillmentSnapshot,
  FulfillmentFile,
  FulfillmentOption,
} from "./types";

// Trusted Supabase Storage host — artwork must originate here.
const TRUSTED_STORAGE_HOST = "supabase.co";

function assertTrustedArtwork(url: string): void {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(TRUSTED_STORAGE_HOST)) {
      throw new Error(
        `Artwork URL is not from trusted storage: ${parsed.hostname}`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Artwork URL")) throw e;
    throw new Error(`Artwork URL is not a valid URL: ${url}`);
  }
}

// Build embroidery options for a given placement.
// Printful requires placement-specific thread color option IDs.
// e.g. placement "embroidery_front_large" → option "thread_colors_front_large"
function buildEmbroideryOptions(
  placement: string,
  configuration: Record<string, unknown>
): FulfillmentOption[] {
  const options: FulfillmentOption[] = [
    { id: "embroidery_type", value: "flat" },
  ];

  // Derive placement-specific thread color option ID
  // Printful naming: thread_colors_<placement_suffix>
  // e.g. embroidery_front_large → thread_colors_front_large
  const placementSuffix = placement.replace(/^embroidery_/, "");
  const threadColorOptionId = `thread_colors_${placementSuffix}`;

  // Use configured thread colors or default to white
  const configuredColors = configuration?.thread_colors as string[] | undefined;
  const threadColors: string[] =
    Array.isArray(configuredColors) && configuredColors.length > 0
      ? configuredColors
      : ["#FFFFFF"];

  options.push({ id: threadColorOptionId, value: threadColors });
  return options;
}

function buildFiles(placement: string, artworkUrl: string): FulfillmentFile[] {
  return [{ type: placement, url: artworkUrl }];
}

function buildOptions(
  technique: string,
  placement: string,
  configuration: Record<string, unknown>
): FulfillmentOption[] {
  const tech = technique.toUpperCase();
  if (tech === "EMBROIDERY") {
    return buildEmbroideryOptions(placement, configuration);
  }
  // DTG, DTF, sublimation — no required options beyond files
  return [];
}

// ── Main resolver ─────────────────────────────────────────────────────────────

export async function resolveFulfillmentSnapshot(
  storeVariantId: string,
  supabase?: SupabaseClient
): Promise<FulfillmentSnapshot> {
  const sb =
    supabase ??
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

  // 1. Resolve store variant → product
  const { data: variant, error: variantError } = await sb
    .from("product_variants")
    .select(
      "id, product_id, printful_variant_id, label, retail_price, available, provider"
    )
    .eq("id", storeVariantId)
    .maybeSingle();

  if (variantError || !variant) {
    throw new Error(`Store variant not found: ${storeVariantId}`);
  }
  if (!variant.available) {
    throw new Error(`Store variant is not available: ${storeVariantId}`);
  }
  if (!variant.printful_variant_id) {
    throw new Error(
      `Store variant ${storeVariantId} has no Printful catalog variant mapping`
    );
  }

  const printfulCatalogVariantId = Number(variant.printful_variant_id);
  if (!Number.isFinite(printfulCatalogVariantId) || printfulCatalogVariantId <= 0) {
    throw new Error(
      `Store variant ${storeVariantId} has invalid printful_variant_id: ${variant.printful_variant_id}`
    );
  }

  // 2. Resolve product
  const { data: product, error: productError } = await sb
    .from("products")
    .select(
      "id, title, catalog_source, printful_id, printful_catalog_id, status"
    )
    .eq("id", variant.product_id)
    .maybeSingle();

  if (productError || !product) {
    throw new Error(`Product not found for variant ${storeVariantId}`);
  }
  if (product.status !== "active") {
    throw new Error(
      `Product ${product.id} is not active (status: ${product.status})`
    );
  }
  if (!product.printful_catalog_id) {
    throw new Error(
      `Product ${product.id} has no printful_catalog_id`
    );
  }

  const catalogSource = product.catalog_source ?? "printful_sync";

  // 3. Resolve primary product design
  const { data: productDesign, error: designError } = await sb
    .from("product_designs")
    .select("id, design_id, placement, technique, configuration")
    .eq("product_id", product.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (designError || !productDesign) {
    throw new Error(
      `No primary product design found for product ${product.id}`
    );
  }
  if (!productDesign.placement) {
    throw new Error(`Product design for ${product.id} has no placement`);
  }
  if (!productDesign.technique) {
    throw new Error(`Product design for ${product.id} has no technique`);
  }

  // 4. Resolve design artwork
  const { data: design, error: artworkError } = await sb
    .from("designs")
    .select("id, artwork_url, status")
    .eq("id", productDesign.design_id)
    .maybeSingle();

  if (artworkError || !design) {
    throw new Error(
      `Design not found: ${productDesign.design_id} for product ${product.id}`
    );
  }
  if (design.status !== "active") {
    throw new Error(`Design ${design.id} is not active`);
  }
  if (!design.artwork_url) {
    throw new Error(`Design ${design.id} has no artwork_url`);
  }

  // 5. Validate artwork is from trusted storage
  assertTrustedArtwork(design.artwork_url);

  // 6. Build manufacturing configuration
  const configuration = (productDesign.configuration ?? {}) as Record<
    string,
    unknown
  >;
  const files = buildFiles(productDesign.placement, design.artwork_url);
  const options = buildOptions(
    productDesign.technique,
    productDesign.placement,
    configuration
  );

  // 7. Determine strategy
  // catalog_builder → DIRECT_CATALOG_ORDER (no sync product required)
  // printful_sync / manual → SYNC_VARIANT (existing behavior)
  const strategy =
    catalogSource === "catalog_builder"
      ? "DIRECT_CATALOG_ORDER"
      : "SYNC_VARIANT";

  return {
    version: 1,
    strategy,
    store_product_id: product.id,
    store_variant_id: storeVariantId,
    printful_catalog_product_id: Number(product.printful_catalog_id),
    printful_catalog_variant_id: printfulCatalogVariantId,
    design_id: design.id,
    artwork_url: design.artwork_url,
    placement: productDesign.placement,
    technique: productDesign.technique,
    files,
    options,
    frozen_at: new Date().toISOString(),
  };
}
