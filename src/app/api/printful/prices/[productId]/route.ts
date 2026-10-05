import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCatalogProductPrices } from "@/lib/printful/pricing";
import { PrintfulApiError } from "@/lib/printful/errors";

// GET /api/printful/prices/[productId]
// Returns provider pricing for all variants of a catalog product.
// Used by the Catalog Builder pricing stage — not called during catalog browsing.
//
// Response shape:
// {
//   catalog_product_id: number,
//   currency: string,
//   placements: PrintfulPlacementPrice[],
//   variants: { id: number, techniques: PrintfulVariantTechniquePrice[] }[]
// }
//
// Map is serialized to array for JSON transport.
// Caller reconstructs lookup by variant ID.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { productId } = await params;
  const id = parseInt(productId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  try {
    const pricing = await getCatalogProductPrices(id);

    // Serialize Map → array for JSON transport
    const variants = Array.from(pricing.variantPrices.entries()).map(([variantId, techniques]) => ({
      id: variantId,
      techniques,
    }));

    return NextResponse.json({
      catalog_product_id: pricing.catalog_product_id,
      currency: pricing.currency,
      placements: pricing.placements,
      variants,
    });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/prices/[productId]]", err);
    return NextResponse.json({ error: "Failed to load product pricing" }, { status: 500 });
  }
}
