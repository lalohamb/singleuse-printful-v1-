import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const PRINTFUL_BASE = "https://api.printful.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pfHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function pfGet(token: string, path: string) {
  const res = await fetch(`${PRINTFUL_BASE}${path}`, { headers: pfHeaders(token) });
  if (!res.ok) throw new Error(`Printful ${path} → ${res.status}`);
  return res.json();
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/printful-proxy/, "");
  const token = Deno.env.get("PRINTFUL_API_TOKEN");
  if (!token) return json({ error: "PRINTFUL_API_TOKEN not set" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // GET /stores
    if (req.method === "GET" && route === "/stores") {
      const data = await pfGet(token, "/stores");
      return json(data);
    }

    // GET /products
    if (req.method === "GET" && route === "/products") {
      const limit = 100;
      let offset = 0;
      const all: any[] = [];
      while (true) {
        const data = await pfGet(token, `/store/products?limit=${limit}&offset=${offset}`);
        const results: any[] = data.result ?? [];
        all.push(...results);
        if (results.length < limit) break;
        offset += limit;
      }
      return json({ result: all });
    }

    // GET /products/:id
    const productMatch = route.match(/^\/products\/(\d+)$/);
    if (req.method === "GET" && productMatch) {
      const data = await pfGet(token, `/store/products/${productMatch[1]}`);
      return json(data);
    }

    // POST /sync
    if (req.method === "POST" && route === "/sync") {
      const storeId = url.searchParams.get("store_id") || Deno.env.get("PRINTFUL_STORE_ID");

      const limit = 100;
      let offset = 0;
      const allProducts: any[] = [];
      while (true) {
        const data = await pfGet(token, `/store/products?limit=${limit}&offset=${offset}`);
        const results: any[] = data.result ?? [];
        allProducts.push(...results);
        if (results.length < limit) break;
        offset += limit;
      }

      const rows: any[] = [];
      for (const p of allProducts) {
        const detail = await pfGet(token, `/store/products/${p.id}`);
        const { sync_product, sync_variants } = detail.result;
        const previews = sync_variants.flatMap((v: any) =>
          (v.files ?? []).filter((f: any) => f.type === "preview").map((f: any) => f.preview_url)
        ).filter(Boolean);
        const uniquePreviews = [...new Set(previews)] as string[];

        const variants = sync_variants.map((v: any) => {
          const preview = (v.files ?? []).find((f: any) => f.type === "preview")?.preview_url ?? null;
          const parts = (v.name ?? "").split(" / ");
          return {
            id: String(v.variant_id),
            label: v.name,
            color: parts[0] ?? "",
            size: parts[1] ?? "",
            price: parseFloat(v.retail_price) || 0,
            image_url: preview,
          };
        });

        const firstPreview = (sync_variants[0]?.files ?? []).find((f: any) => f.type === "preview")?.preview_url
          ?? sync_product.thumbnail_url;

        // Derive Printful CATALOG product ID from sync variants.
        // sync_variant.product.product_id is the catalog product ID (e.g. 903).
        // This is DIFFERENT from sync_product.id (store/sync product ID, e.g. 476330305).
        // All variants of one sync product should share the same catalog product ID.
        // If they conflict, log the inconsistency and leave printful_catalog_id unset.
        const catalogProductIds = new Set<number>();
        for (const sv of sync_variants) {
          const catalogId = sv.product?.product_id;
          if (typeof catalogId === "number" && catalogId > 0) {
            catalogProductIds.add(catalogId);
          }
        }

        let printfulCatalogId: number | null = null;
        if (catalogProductIds.size === 1) {
          printfulCatalogId = [...catalogProductIds][0];
        } else if (catalogProductIds.size > 1) {
          console.error(
            `[printful-proxy] CONFLICT: sync product ${sync_product.id} ("${sync_product.name}") ` +
            `has variants with conflicting catalog product IDs: [${[...catalogProductIds].join(", ")}]. ` +
            `printful_catalog_id will NOT be set for this product.`
          );
        } else {
          // No catalog ID found in any variant — log and leave null
          console.warn(
            `[printful-proxy] No catalog product ID found in sync variants for ` +
            `sync product ${sync_product.id} ("${sync_product.name}"). printful_catalog_id will be NULL.`
          );
        }

        rows.push({
          printful_id: String(sync_product.id),
          printful_catalog_id: printfulCatalogId,
          title: sync_product.name,
          image_url: firstPreview,
          images: uniquePreviews,
          price: parseFloat(sync_variants[0]?.retail_price) || 0,
          variants,
          status: "active",
          shipping_info: {},
          updated_at: new Date().toISOString(),
        });
      }

      const printfulIds = rows.map((r) => r.printful_id);

      // Fetch existing products to determine which are content_locked (store-owned).
      // content_locked = true means admin has curated this product — never overwrite
      // store-owned fields (title, description, image_url, images) on re-sync.
      const { data: existingProducts } = await supabase
        .from("products")
        .select("id, printful_id, content_locked, slug")
        .in("printful_id", printfulIds);

      const existingByPrintfulId = new Map<string, { id: string; content_locked: boolean; slug: string | null }>();
      for (const ep of existingProducts ?? []) {
        existingByPrintfulId.set(ep.printful_id, ep);
      }

      // For each row: if product already exists and is content_locked,
      // only update provider-owned fields. Otherwise seed all fields.
      for (const row of rows) {
        const existing = existingByPrintfulId.get(row.printful_id);
        if (existing?.content_locked) {
          // STORE-OWNED: preserve title, description, image_url, images, slug.
          // PROVIDER-OWNED: update price (base display), updated_at, printful_catalog_id.
          const updatePayload: Record<string, unknown> = {
            price: row.price,
            updated_at: row.updated_at,
          };
          // Always update printful_catalog_id — it's provider-owned identity, not store content.
          if (row.printful_catalog_id !== null) {
            updatePayload.printful_catalog_id = row.printful_catalog_id;
          }
          const { error: updateErr } = await supabase
            .from("products")
            .update(updatePayload)
            .eq("printful_id", row.printful_id);
          if (updateErr) throw new Error(updateErr.message);
        } else {
          // New product or unlocked: seed/update all fields.
          // Generate slug from title if this is a new product (no existing row).
          const slugBase = row.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
          const upsertRow: Record<string, unknown> = { ...row };
          if (!existing) {
            // New product: assign slug (will be made unique by DB constraint on conflict)
            upsertRow.slug = slugBase;
            upsertRow.status = "active";
            upsertRow.published_at = new Date().toISOString();
            upsertRow.catalog_source = "printful_sync";
          }
          const { error: upsertErr } = await supabase
            .from("products")
            .upsert(upsertRow, { onConflict: "printful_id", ignoreDuplicates: false });
          if (upsertErr) throw new Error(upsertErr.message);
        }
      }

      // Fetch store product UUIDs for variant upsert
      const { data: syncedProducts } = await supabase
        .from("products")
        .select("id, printful_id")
        .in("printful_id", printfulIds);

      const productIdByPrintfulId = new Map<string, string>();
      for (const sp of syncedProducts ?? []) {
        productIdByPrintfulId.set(sp.printful_id, sp.id);
      }

      // Upsert product_variants — preserves stable store UUIDs across syncs.
      // ON CONFLICT on (product_id, provider, printful_variant_id) updates
      // mutable fields only; the store UUID (id) is never regenerated.
      for (const row of rows) {
        const storeProductId = productIdByPrintfulId.get(row.printful_id);
        if (!storeProductId) continue;

        const variantRows = (row.variants as any[]).map((v: any) => ({
          product_id: storeProductId,
          provider: "printful",
          printful_variant_id: String(v.id),
          label: v.label ?? "",
          color: v.color ?? null,
          size: v.size ?? null,
          retail_price: v.price ?? 0,
          image_url: v.image_url ?? null,
          available: true,
          updated_at: new Date().toISOString(),
        }));

        if (variantRows.length > 0) {
          // Insert new variants; on conflict update mutable fields only (preserves store UUID).
          const { error: variantErr } = await supabase
            .from("product_variants")
            .upsert(variantRows, {
              onConflict: "product_id,provider,printful_variant_id",
              ignoreDuplicates: false,
            });
          if (variantErr) {
            console.error("product_variants upsert error:", variantErr.message);
          }

          // Mark variants no longer in Printful as unavailable (do not delete)
          const currentPrintfulVariantIds = variantRows.map((v: any) => v.printful_variant_id);
          await supabase
            .from("product_variants")
            .update({ available: false, updated_at: new Date().toISOString() })
            .eq("product_id", storeProductId)
            .eq("provider", "printful")
            .not("printful_variant_id", "in", `(${currentPrintfulVariantIds.map((id: string) => `"${id}"`).join(",")})`);
        }
      }

      const { data: existing } = await supabase
        .from("products")
        .select("id, printful_id")
        .not("printful_id", "is", null)
        .eq("catalog_source", "printful_sync"); // CRITICAL: never archive catalog_builder or manual products

      // Products no longer in Printful: mark archived (do not delete storefront content).
      // Only operates on printful_sync products — catalog_builder products are never archived by sync.
      const toArchive = (existing ?? [])
        .filter((p: any) => !printfulIds.includes(p.printful_id))
        .map((p: any) => p.id);

      if (toArchive.length) {
        await supabase.from("products").update({ status: "archived", updated_at: new Date().toISOString() }).in("id", toArchive);
      }

      if (storeId) {
        await supabase
          .from("settings")
          .update({ printful_connected: true, printful_store_id: storeId })
          .not("id", "is", null);
      }

      return json({ synced: rows.length, archived: toArchive.length, variants_synced: rows.reduce((s: number, r: any) => s + (r.variants?.length ?? 0), 0) });
    }

    // GET /orders/:id  — fetch a single Printful order by numeric ID
    const orderGetMatch = route.match(/^\/orders\/(\d+)$/);
    if (req.method === "GET" && orderGetMatch) {
      const data = await pfGet(token, `/orders/${orderGetMatch[1]}`);
      return json(data);
    }

    // POST /orders/:id/confirm  — manually confirm a Printful draft order
    // Admin-only: caller must be authenticated admin (enforced at Next.js API layer).
    // Printful: POST /orders/{id}/confirm transitions draft → pending/in-production.
    const orderConfirmMatch = route.match(/^\/orders\/(\d+)\/confirm$/);
    if (req.method === "POST" && orderConfirmMatch) {
      const res = await fetch(`${PRINTFUL_BASE}/orders/${orderConfirmMatch[1]}/confirm`, {
        method: "POST",
        headers: pfHeaders(token),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    // DELETE /orders/:id  — cancel a Printful draft order
    // Only works while order is in draft status. Printful rejects cancellation
    // of orders already in production.
    const orderCancelMatch = route.match(/^\/orders\/(\d+)$/);
    if (req.method === "DELETE" && orderCancelMatch) {
      const res = await fetch(`${PRINTFUL_BASE}/orders/${orderCancelMatch[1]}`, {
        method: "DELETE",
        headers: pfHeaders(token),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    // POST /orders
    if (req.method === "POST" && route === "/orders") {
      const body = await req.json();
      const res = await fetch(`${PRINTFUL_BASE}/orders?confirm=true`, {
        method: "POST",
        headers: pfHeaders(token),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    // POST /shipping
    if (req.method === "POST" && route === "/shipping") {
      const body = await req.json();
      const res = await fetch(`${PRINTFUL_BASE}/shipping/rates`, {
        method: "POST",
        headers: pfHeaders(token),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return json(data, res.status);
    }

    return json({ error: "Not found" }, 404);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});
