import { NextResponse } from "next/server";
import { getCatalogProductsV2 } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

// GET /api/printful/products
// Returns V2CatalogProduct[] — Catalog Builder and ProductSelector.
// V2CatalogProduct does NOT include currency, files[], or options[].
// ProductDesigner variant loading uses /api/printful/products/[productId]/v1 (V1 path).
export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const products = await getCatalogProductsV2();
    return NextResponse.json({ result: products });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
