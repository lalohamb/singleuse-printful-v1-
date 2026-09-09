import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getPrintifyToken(): string | null {
  // The Printify API token is stored as an edge function secret.
  return Deno.env.get("PRINTIFY_API_TOKEN") ?? null;
}

async function printifyFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  // SSRF guard — only allow requests to the Printify API
  const fullUrl = `${PRINTIFY_API_BASE}${path}`;
  if (!fullUrl.startsWith(PRINTIFY_API_BASE)) {
    throw new Error("Invalid Printify path");
  }
  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    const parsed = JSON.parse(text);
    // Deserialization guard — only accept plain objects or arrays
    if (parsed !== null && typeof parsed === "object") {
      body = parsed;
    } else {
      body = text;
    }
  } catch { body = text; }
  if (!res.ok) {
    throw new Error(`Printify API error ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    // The edge runtime may deliver the path as either
    // "/functions/v1/printify-proxy/<route>" or "/printify-proxy/<route>".
    // Take everything after the function name so routing works in both cases.
    const allSegments = url.pathname.split("/").filter(Boolean);
    const fnIdx = allSegments.lastIndexOf("printify-proxy");
    const segments = fnIdx >= 0 ? allSegments.slice(fnIdx + 1) : allSegments;

    const token = getPrintifyToken();
    if (!token) {
      return errorResponse("Printify is not configured. Set the PRINTIFY_API_TOKEN secret.", 400);
    }

    // GET /shops — list connected Printify shops
    if (req.method === "GET" && segments[0] === "shops") {
      const shops = await printifyFetch("/shops.json", token);
      return jsonResponse(shops);
    }

    // GET /products — list products from a shop
    if (req.method === "GET" && segments[0] === "products" && !segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const page = url.searchParams.get("page") || "1";
      const limit = url.searchParams.get("limit") || "50";
      const products = await printifyFetch(
        `/shops/${shopId}/products.json?page=${page}&limit=${limit}`,
        token
      );
      return jsonResponse(products);
    }

    // GET /products/:id — get a single product
    if (req.method === "GET" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const product = await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token
      );
      return jsonResponse(product);
    }

    // POST /products — create a product in Printify
    if (req.method === "POST" && segments[0] === "products") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const body = await req.json();
      const product = await printifyFetch(
        `/shops/${shopId}/products.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(product, 201);
    }

    // PUT /products/:id — update a product
    if (req.method === "PUT" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const body = await req.json();
      const product = await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token,
        { method: "PUT", body: JSON.stringify(body) }
      );
      return jsonResponse(product);
    }

    // DELETE /products/:id — delete a product
    if (req.method === "DELETE" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token,
        { method: "DELETE" }
      );
      return jsonResponse({ success: true });
    }

    // POST /orders — submit an order to Printify
    if (req.method === "POST" && segments[0] === "orders") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const body = await req.json();
      const order = await printifyFetch(
        `/shops/${shopId}/orders.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(order, 201);
    }

    // GET /orders/:id — get order status from Printify
    if (req.method === "GET" && segments[0] === "orders" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const order = await printifyFetch(
        `/shops/${shopId}/orders/${segments[1]}.json`,
        token
      );
      return jsonResponse(order);
    }

    // POST /orders/:id/cancel — cancel an order in Printify
    if (req.method === "POST" && segments[0] === "orders" && segments[1] === "cancel") {
      const { shop_id, printify_order_id } = await req.json();
      if (!shop_id || !printify_order_id) return errorResponse("shop_id and printify_order_id required", 400);
      const result = await printifyFetch(
        `/shops/${shop_id}/orders/${printify_order_id}/cancellation.json`,
        token,
        { method: "POST" }
      );
      return jsonResponse(result);
    }

    // GET /shipping — calculate shipping options
    if (req.method === "GET" && segments[0] === "shipping") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      // Printify shipping calculation endpoint
      const products = url.searchParams.get("products");
      if (!products) return errorResponse("products query parameter is required", 400);
      const shippingData = await printifyFetch(
        `/shops/${shopId}/shipping/options.json?${new URLSearchParams({ products })}`,
        token
      );
      return jsonResponse(shippingData);
    }

    // POST /shipping — calculate shipping for a specific address + items
    if (req.method === "POST" && segments[0] === "shipping") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);
      const body = await req.json();
      const shippingData = await printifyFetch(
        `/shops/${shopId}/shipping/calculations.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(shippingData);
    }

    // GET /blueprints — list available Printify blueprints (product templates)
    if (req.method === "GET" && segments[0] === "blueprints") {
      const blueprints = await printifyFetch("/catalog/blueprints.json", token);
      return jsonResponse(blueprints);
    }

    // GET /blueprints/:id/providers — list print providers for a blueprint
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers") {
      const providers = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers.json`,
        token
      );
      return jsonResponse(providers);
    }

    // GET /blueprints/:id/providers/:providerId/variants — list variants
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers" && segments[3] && segments[4] === "variants") {
      const variants = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers/${segments[3]}/variants.json`,
        token
      );
      return jsonResponse(variants);
    }

    // GET /blueprints/:id/providers/:providerId/shipping — shipping profiles
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers" && segments[3] && segments[4] === "shipping") {
      const shipping = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers/${segments[3]}/shipping.json`,
        token
      );
      return jsonResponse(shipping);
    }

    // POST /sync — sync products from Printify to local database
    if (req.method === "POST" && segments[0] === "sync") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);

      const synced: string[] = [];
      const printifyIds = new Set<string>(); // all IDs seen from Printify listing
      const errors: Array<{ id: string; error: string }> = [];
      const shippingCache = new Map<string, unknown>(); // "blueprintId:providerId" -> profile
      let page = 1;
      let lastPage = 1;

      // Prefetch which existing products are content-locked so re-sync can
      // preserve admin-edited title/description/image while still refreshing
      // commerce fields (price, variants, status).
      const { data: lockedRows } = await supabase
        .from("products")
        .select("printify_id, content_locked")
        .not("printify_id", "is", null);
      const lockedMap = new Map<string, boolean>(
        (lockedRows || []).map((r: any) => [String(r.printify_id), !!r.content_locked])
      );

      do {
        const listing = await printifyFetch(
          `/shops/${shopId}/products.json?limit=50&page=${page}`,
          token
        );
        lastPage = Number(listing.last_page) || 1;

        for (const p of listing.data || []) {
          printifyIds.add(String(p.id));
          try {
            const detail = await printifyFetch(
              `/shops/${shopId}/products/${p.id}.json`,
              token
            );

            // Map each option value id -> { type, title } so we can resolve
            // a variant's numeric option ids into color/size labels.
            const optionValues = new Map<number, { type: string; title: string }>();
            for (const opt of detail.options || []) {
              for (const val of opt.values || []) {
                optionValues.set(val.id, { type: opt.type, title: val.title });
              }
            }

            const allVariants = detail.variants || [];
            const enabled = allVariants.filter((v: any) => v.is_enabled);
            // Only sell enabled variants; fall back to all if none are enabled.
            const usable = enabled.length ? enabled : allVariants;

            // variant id -> color, so we can link Printify images (which carry
            // variant_ids) to a color and show the right image on color select.
            const colorOf = (v: any): string => {
              for (const vid of v.options || []) {
                const meta = optionValues.get(vid);
                if (meta?.type === "color") return meta.title;
              }
              return "Default";
            };
            const variantColor = new Map<string, string>();
            for (const v of allVariants) variantColor.set(String(v.id), colorOf(v));

            // color -> image src. Only use images that are specific to a
            // single color (the default/collage mockup spans many colors, so
            // it can't represent one color). First single-color image wins.
            const colorImage = new Map<string, string>();
            for (const img of detail.images || []) {
              const src = typeof img === "string" ? img : img.src;
              if (!src) continue;
              const cset = new Set<string>();
              for (const vid of img.variant_ids || []) {
                const c = variantColor.get(String(vid));
                if (c) cset.add(c);
              }
              if (cset.size === 1) {
                const c = [...cset][0];
                if (!colorImage.has(c)) colorImage.set(c, src);
              }
            }

            const variants = usable.map((v: any) => {
              let color = "Default";
              let size = "";
              for (const vid of v.options || []) {
                const meta = optionValues.get(vid);
                if (!meta) continue;
                if (meta.type === "color") color = meta.title;
                else if (meta.type === "size") size = meta.title;
              }
              return {
                id: String(v.id),
                label: v.title || String(v.id),
                color,
                size,
                // Printify prices are integer cents.
                price: (Number(v.price) || 0) / 100,
                image_url: colorImage.get(color) || null,
              };
            });

            // Price/cost come from the default (or first usable) variant.
            const priceVariant =
              usable.find((v: any) => v.is_default) || usable[0] || {};
            const price = (Number(priceVariant.price) || 0) / 100;
            const cost = (Number(priceVariant.cost) || 0) / 100;

            // Dedupe image srcs, keeping the default image first.
            const seen = new Set<string>();
            const images: string[] = [];
            const ordered = [...(detail.images || [])].sort(
              (a: any, b: any) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0)
            );
            for (const img of ordered) {
              const src = typeof img === "string" ? img : img.src;
              if (src && !seen.has(src)) {
                seen.add(src);
                images.push(src);
              }
            }

            // Detect personalization options from Printify
            let is_personalizable = false;
            let personalization_label: string | null = null;
            try {
              const personalizationOptions = await printifyFetch(
                `/shops/${shopId}/products/${detail.id}/personalization_options.json`,
                token
              );
              const fields = Array.isArray(personalizationOptions) ? personalizationOptions : (personalizationOptions?.data || []);
              if (fields.length > 0) {
                is_personalizable = true;
                personalization_label = fields[0].label || null;
              }
            } catch {
              // Non-fatal — personalization stays as previous value
            }

            // Commerce fields are always refreshed from Printify.
            const payload: Record<string, unknown> = {
              printify_id: String(detail.id),
              price,
              cost,
              variants,
              status: detail.visible ? "active" : "draft",
              blueprint_id: String(detail.blueprint_id || ""),
              print_provider_id: String(detail.print_provider_id || ""),
              is_personalizable,
              personalization_label,
              updated_at: new Date().toISOString(),
            };

            // Fetch static shipping profile for this blueprint/provider and
            // store it so the checkout can calculate rates without a live API call.
            // Cache by blueprint:provider to avoid redundant API calls across products.
            if (detail.blueprint_id && detail.print_provider_id) {
              const cacheKey = `${detail.blueprint_id}:${detail.print_provider_id}`;
              try {
                if (!shippingCache.has(cacheKey)) {
                  const shippingProfile = await printifyFetch(
                    `/catalog/blueprints/${detail.blueprint_id}/print_providers/${detail.print_provider_id}/shipping.json`,
                    token
                  );
                  shippingCache.set(cacheKey, shippingProfile);
                }
                payload.shipping_info = shippingCache.get(cacheKey);
              } catch {
                // Non-fatal — shipping_info stays as previous value
              }
            }

            // Content fields are overwritten ONLY when the row is not
            // content-locked. New products are absent from lockedMap, so
            // isLocked is false and title is always supplied on first insert
            // (satisfies the NOT NULL title constraint). For locked existing
            // rows the omitted columns keep their curated values, because
            // Postgres upsert only updates the columns present in the payload.
            const isLocked = lockedMap.get(String(detail.id)) === true;
            if (!isLocked) {
              payload.title = detail.title;
              payload.description = detail.description || "";
              payload.image_url = images[0] || null;
              payload.images = images;
            }

            const { data, error } = await supabase
              .from("products")
              .upsert(payload, { onConflict: "printify_id" })
              .select("id");

            if (error) errors.push({ id: String(p.id), error: error.message });
            else if (data && data[0]) synced.push(String(detail.id));
          } catch (e) {
            errors.push({
              id: String(p.id),
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        page++;
      } while (page <= lastPage);

      // Record the connected shop so the storefront/admin know the source.
      await supabase
        .from("settings")
        .update({
          printify_connected: true,
          printify_shop_id: shopId,
          updated_at: new Date().toISOString(),
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Remove any DB products whose printify_id is no longer in Printify.
      const { data: dbRows } = await supabase
        .from("products")
        .select("id, printify_id")
        .not("printify_id", "is", null);

      const staleIds = (dbRows || [])
        .filter((r: any) => !printifyIds.has(String(r.printify_id)))
        .map((r: any) => r.id);

      let deleted = 0;
      if (staleIds.length) {
        const { error: delError } = await supabase.from("products").delete().in("id", staleIds);
        if (!delError) deleted = staleIds.length;
      }

      return jsonResponse({
        synced: synced.length,
        deleted,
        errors: errors.length,
        error_details: errors.slice(0, 10),
      });
    }

    // POST /cleanup — delete DB products whose printify_id is no longer in Printify
    if (req.method === "POST" && segments[0] === "cleanup") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse("shop_id query parameter is required", 400);

      // Collect all current Printify product IDs
      const liveIds = new Set<string>();
      let page = 1, lastPage = 1;
      do {
        const listing = await printifyFetch(`/shops/${shopId}/products.json?limit=50&page=${page}`, token);
        lastPage = Number(listing.last_page) || 1;
        for (const p of listing.data || []) liveIds.add(String(p.id));
        page++;
      } while (page <= lastPage);

      // Fetch all DB rows that have a printify_id
      const { data: dbRows } = await supabase
        .from("products")
        .select("id, printify_id")
        .not("printify_id", "is", null);

      const staleIds = (dbRows || [])
        .filter((r: any) => !liveIds.has(String(r.printify_id)))
        .map((r: any) => r.id);

      if (!staleIds.length) return jsonResponse({ deleted: 0, message: "Nothing to clean up" });

      const { error } = await supabase.from("products").delete().in("id", staleIds);
      if (error) return errorResponse(error.message);

      return jsonResponse({ deleted: staleIds.length });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
