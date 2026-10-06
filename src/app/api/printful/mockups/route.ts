import { NextResponse } from "next/server";
import { createMockupTaskV2, type V2MockupTaskRequest } from "@/lib/printful/mockups";
import { createMockupTask } from "@/lib/printful/mockups";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";
import { resolvePrintfulProductIdentity } from "@/lib/printful/identity";
import type { PrintfulMockupTaskRequest } from "@/lib/printful/types";

// POST /api/printful/mockups
//
// V2 path (Catalog Builder):
//   Body: { productId: number, catalog_variant_ids: number[], technique: string,
//           files: [{ placement, image_url, position }] }
//   Uses POST /v2/mockup-tasks with catalog_variant_ids explicitly supplied.
//
// Legacy V1 path (ProductDesigner / printful_sync):
//   Body: { storeProductId?: string, productId?: number, variant_ids: number[], files: [...] }
//   Uses POST /mockup-generator/create-task/{id}
//   Detected by presence of variant_ids (V1 field) vs catalog_variant_ids (V2 field).

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    storeProductId?: string;
    productId?: number;
    productDesignId?: string;
    // V2 Catalog Builder fields
    catalog_variant_ids?: number[];
    // V1 legacy fields
    variant_ids?: number[];
    files?: Array<{ placement: string; image_url: string; position?: unknown }>;
    technique?: string;
    format?: string;
    width?: number;
    options?: unknown[];
    option_groups?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { storeProductId, productId: legacyProductId, productDesignId } = body;

  // ── Resolve catalog product ID ──────────────────────────────────────────────
  let catalogProductId: number;

  if (storeProductId) {
    try {
      const identity = await resolvePrintfulProductIdentity(storeProductId);

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
    catalogProductId = legacyProductId;
  } else {
    return NextResponse.json(
      { error: "Provide storeProductId (store UUID) or productId (numeric Printful catalog ID)" },
      { status: 400 }
    );
  }

  const { files } = body;
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

  // ── V2 path: Catalog Builder ────────────────────────────────────────────────
  // Detected by presence of catalog_variant_ids (V2 field).
  if (Array.isArray(body.catalog_variant_ids) && body.catalog_variant_ids.length > 0) {
    if (!body.technique) {
      return NextResponse.json({ error: "technique is required for V2 mockup generation" }, { status: 400 });
    }

    const v2Request: V2MockupTaskRequest = {
      products: [{
        source: "catalog",
        catalog_product_id: catalogProductId,
        catalog_variant_ids: body.catalog_variant_ids,
        placements: files.map((f) => ({
          placement: f.placement,
          technique: body.technique!,
          layers: [{ type: "file" as const, url: f.image_url }],
        })),
      }],
    };

    try {
      const task = await createMockupTaskV2(v2Request);
      return NextResponse.json({ result: task });
    } catch (err) {
      if (err instanceof PrintfulApiError) {
        const status = err.isRateLimit ? 429 : err.status;
        console.error("[printful/mockups POST V2] Printful error", err.status, err.message);
        const detail = err.message !== err.clientMessage ? ` (${err.message})` : "";
        return NextResponse.json({ error: err.clientMessage + detail }, { status });
      }
      console.error("[printful/mockups POST V2]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // ── V1 legacy path: ProductDesigner / printful_sync ─────────────────────────
  const { variant_ids, technique, format, width, options, option_groups } = body;
  if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
    return NextResponse.json(
      { error: "Provide catalog_variant_ids (V2 Catalog Builder) or variant_ids (legacy ProductDesigner)" },
      { status: 400 }
    );
  }

  const v1Request: PrintfulMockupTaskRequest = {
    variant_ids,
    files: files.map((f) => ({
      placement: f.placement,
      image_url: f.image_url,
      position: f.position as PrintfulMockupTaskRequest["files"][0]["position"],
    })),
    ...(technique ? { technique } : {}),
    ...(format ? { format: format as "jpg" | "png" } : {}),
    ...(width ? { width } : {}),
    ...(options ? { options: options as Record<string, string>[] } : {}),
    ...(option_groups ? { option_groups } : {}),
  };

  try {
    const task = await createMockupTask(catalogProductId, v1Request);
    return NextResponse.json({ result: task });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      const status = err.isRateLimit ? 429 : err.status;
      console.error("[printful/mockups POST V1] Printful error", err.status, err.message, JSON.stringify({ catalogProductId, variant_ids, files }));
      const detail = err.message !== err.clientMessage ? ` (${err.message})` : "";
      return NextResponse.json({ error: err.clientMessage + detail }, { status });
    }
    console.error("[printful/mockups POST V1]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
