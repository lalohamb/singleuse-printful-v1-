import { NextResponse } from "next/server";
import { createMockupTask } from "@/lib/printful/mockups";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";
import { resolvePrintfulProductIdentity } from "@/lib/printful/identity";
import type { PrintfulMockupTaskRequest } from "@/lib/printful/types";

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { storeProductId?: string; productId?: number; productDesignId?: string } & PrintfulMockupTaskRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { storeProductId, productId: legacyProductId, productDesignId, variant_ids, files, ...rest } = body;

  if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
    return NextResponse.json({ error: "variant_ids must be a non-empty array" }, { status: 400 });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "files must be a non-empty array" }, { status: 400 });
  }

  for (const f of files) {
    if (!f.image_url?.startsWith("http")) {
      return NextResponse.json(
        { error: `Invalid image_url for placement "${f.placement}". Must be an absolute URL.` },
        { status: 400 }
      );
    }
  }

  // Resolve catalog product ID.
  // Preferred: storeProductId (store UUID) → resolvePrintfulProductIdentity() → catalogProductId
  // Legacy: productId (numeric catalog ID passed directly) — still accepted for backward compat
  let catalogProductId: number;

  if (storeProductId) {
    try {
      const identity = await resolvePrintfulProductIdentity(storeProductId);

      // Conflict detection: if productDesignId is provided, check configuration.catalog_product_id
      // If it disagrees with the resolved catalog ID, stop and report.
      if (productDesignId) {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: pd } = await sb
          .from("product_designs")
          .select("configuration")
          .eq("id", productDesignId)
          .maybeSingle();
        const configCatalogId = (pd?.configuration as Record<string, unknown>)?.catalog_product_id;
        if (
          configCatalogId !== undefined &&
          configCatalogId !== null &&
          Number(configCatalogId) !== identity.catalogProductId
        ) {
          return NextResponse.json(
            {
              error:
                `Catalog product ID conflict: products.printful_catalog_id=${identity.catalogProductId} ` +
                `but product_designs.configuration.catalog_product_id=${configCatalogId}. ` +
                `Resolve the conflict before generating mockups.`,
            },
            { status: 409 }
          );
        }
      }

      catalogProductId = identity.catalogProductId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Cannot resolve catalog product ID: ${msg}` }, { status: 400 });
    }
  } else if (legacyProductId && typeof legacyProductId === "number" && legacyProductId > 0) {
    // Legacy path: numeric catalog product ID passed directly
    catalogProductId = legacyProductId;
  } else {
    return NextResponse.json(
      { error: "Provide storeProductId (store UUID) or productId (numeric Printful catalog ID)" },
      { status: 400 }
    );
  }

  try {
    const task = await createMockupTask(catalogProductId, { variant_ids, files, ...rest });
    return NextResponse.json({ result: task });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      const status = err.isRateLimit ? 429 : err.status;
      console.error("[printful/mockups POST] Printful error", err.status, err.message, JSON.stringify({ catalogProductId, variant_ids, files, ...rest }));
      const detail = err.message !== err.clientMessage ? ` (${err.message})` : "";
      return NextResponse.json({ error: err.clientMessage + detail }, { status });
    }
    console.error("[printful/mockups POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
