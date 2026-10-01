import { NextResponse } from "next/server";
import { getPrintfiles } from "@/lib/printful/templates";
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
    const data = await getPrintfiles(id);
    return NextResponse.json({ result: data });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/printfiles/[productId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
