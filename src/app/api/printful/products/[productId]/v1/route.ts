import { NextResponse } from "next/server";
import { getCatalogProduct } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

// GET /api/printful/products/[productId]/v1
// LEGACY V1 ONLY — ProductDesigner path.
//
// Returns a genuine V1 PrintfulProduct with:
//   - V1 variant IDs (used as variant_ids in V1 mockup POST)
//   - currency, files[], options[] from V1 provider response
//
// Do NOT use this route for Catalog Builder development.
// Catalog Builder uses /api/printful/products/[productId] (V2).
//
// ProductDesigner calls this route to load V1 variants so that
// selectedVariant.id is a genuine V1 variant ID for the V1 mockup pipeline.
// The V2 route returns CatalogVariant[] (V2 IDs) which are a different
// identity namespace and must not be passed to V1 mockup endpoints.

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
    // V1 GET /products/{id} — returns flat product object with genuine V1 fields.
    // The V1 response does not include a variants array; variants come from a
    // separate V1 endpoint. ProductDesigner fetches variants via the V1 printfiles
    // endpoint which returns variant_printfiles[].variant_id (V1 IDs).
    // For the variant list itself, ProductDesigner uses the V1 templates response
    // which contains variant_mapping[].variant_id (V1 IDs).
    //
    // NOTE: GET /products/{id} does not return variants[]. ProductDesigner
    // populates its variant list from the V1 templates response (variant_mapping),
    // not from this endpoint. This route provides the product metadata only.
    const product = await getCatalogProduct(id);
    return NextResponse.json({ result: product });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/products/[productId]/v1]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
