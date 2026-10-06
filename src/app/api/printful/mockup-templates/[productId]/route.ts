import { NextResponse } from "next/server";
import { getMockupTemplates } from "@/lib/printful/templates";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

// GET /api/printful/mockup-templates/[productId]
// Returns all V2 mockup templates for a catalog product, all pages accumulated.
// Used by Catalog Builder for production geometry and placement discovery.
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
    const templates = await getMockupTemplates(id);
    return NextResponse.json({ result: templates });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/mockup-templates/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
