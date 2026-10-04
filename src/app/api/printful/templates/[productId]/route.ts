import { NextResponse } from "next/server";
import { getLayoutTemplates } from "@/lib/printful/templates";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";
import { VALID_TECHNIQUES } from "@/lib/printful/techniques";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { productId } = await params;
  const id = parseInt(productId, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const url = new URL(req.url);
  const technique = url.searchParams.get("technique") ?? undefined;
  const orientation = url.searchParams.get("orientation") ?? undefined;

  if (technique && !VALID_TECHNIQUES.has(technique.toUpperCase())) {
    return NextResponse.json({ error: "Invalid technique" }, { status: 400 });
  }

  try {
    const data = await getLayoutTemplates(id, {
      technique: technique?.toUpperCase(),
      orientation,
    });
    return NextResponse.json({ result: data });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/templates/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
