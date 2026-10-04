import { NextResponse } from "next/server";
import { getCatalogProduct, getCatalogVariants } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

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
    // Product metadata (V1) and catalog variants (V2) fetched in parallel.
    // getCatalogVariants never throws — it returns a CatalogVariantResult.
    const [product, variantResult] = await Promise.all([
      getCatalogProduct(id),
      getCatalogVariants(id),
    ]);

    // Merge into a stable CountyBuys response shape.
    // Consumers read result.variants (array) and result.eligibility.
    // eligibility: "eligible" | "unavailable" | "error"
    // When eligibility !== "eligible", variants is [] and reason explains why.
    return NextResponse.json({
      result: {
        ...product,
        variants: variantResult.variants,
        eligibility: variantResult.eligibility,
        eligibility_reason: variantResult.reason ?? null,
      },
    });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/products/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
