import { NextResponse } from "next/server";
import { getCatalogProducts } from "@/lib/printful/catalog";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  try {
    const products = await getCatalogProducts();
    return NextResponse.json({ result: products });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
