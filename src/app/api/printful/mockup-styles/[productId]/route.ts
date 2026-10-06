import { NextResponse } from "next/server";
import { getMockupStyles } from "@/lib/printful/templates";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

// GET /api/printful/mockup-styles/[productId]
// Returns all V2 mockup styles for a catalog product.
// Used by Catalog Builder for placement display names and V2 DPI validation.
// Admin-only.
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
    const styles = await getMockupStyles(id);
    return NextResponse.json({ result: styles });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/mockup-styles/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
