import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// CORS is restricted to the configured site origin.
// SITE_URL must be set as a Supabase edge function secret, e.g.:
//   supabase secrets set SITE_URL=https://yourdomain.com
function corsHeaders(req: Request): Record<string, string> {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const requestOrigin = req.headers.get("origin") ?? "";
  const isLocalhost = requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:");
  const isAllowed = requestOrigin === siteUrl || isLocalhost;
  const origin = isAllowed ? requestOrigin : "null";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

function jsonResponse(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function errorResponse(req: Request, message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
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
    return new Response(null, { status: 200, headers: corsHeaders(req) });
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
      return errorResponse(req, "Printify is not configured. Set the PRINTIFY_API_TOKEN secret.", 400);
    }

    // GET /shops — list connected Printify shops
    if (req.method === "GET" && segments[0] === "shops") {
      const shops = await printifyFetch("/shops.json", token);
      return jsonResponse(req, shops);
    }

    // GET /products — list products from a shop
    if (req.method === "GET" && segments[0] === "products" && !segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const page = url.searchParams.get("page") || "1";
      const limit = url.searchParams.get("limit") || "50";
      const products = await printifyFetch(
        `/shops/${shopId}/products.json?page=${page}&limit=${limit}`,
        token
      );
      return jsonResponse(req, products);
    }

    // GET /products/:id — get a single product
    if (req.method === "GET" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const product = await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token
      );
      return jsonResponse(req, product);
    }

    // POST /products — create a product in Printify
    if (req.method === "POST" && segments[0] === "products") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const body = await req.json();
      const product = await printifyFetch(
        `/shops/${shopId}/products.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(req, product, 201);
    }

    // PUT /products/:id — update a product
    if (req.method === "PUT" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const body = await req.json();
      const product = await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token,
        { method: "PUT", body: JSON.stringify(body) }
      );
      return jsonResponse(req, product);
    }

    // DELETE /products/:id — delete a product
    if (req.method === "DELETE" && segments[0] === "products" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      await printifyFetch(
        `/shops/${shopId}/products/${segments[1]}.json`,
        token,
        { method: "DELETE" }
      );
      return jsonResponse(req, { success: true });
    }

    // POST /orders — submit an order to Printify
    if (req.method === "POST" && segments[0] === "orders") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const body = await req.json();
      const order = await printifyFetch(
        `/shops/${shopId}/orders.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(req, order, 201);
    }

    // GET /orders/:id — get order status from Printify
    if (req.method === "GET" && segments[0] === "orders" && segments[1]) {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const order = await printifyFetch(
        `/shops/${shopId}/orders/${segments[1]}.json`,
        token
      );
      return jsonResponse(req, order);
    }

    // POST /orders/:id/cancel — cancel an order in Printify
    if (req.method === "POST" && segments[0] === "orders" && segments[1] === "cancel") {
      const { shop_id, printify_order_id } = await req.json();
      if (!shop_id || !printify_order_id) return errorResponse(req, "shop_id and printify_order_id required", 400);
      const result = await printifyFetch(
        `/shops/${shop_id}/orders/${printify_order_id}/cancellation.json`,
        token,
        { method: "POST" }
      );
      return jsonResponse(req, result);
    }

    // GET /shipping — calculate shipping options
    if (req.method === "GET" && segments[0] === "shipping") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const products = url.searchParams.get("products");
      if (!products) return errorResponse(req, "products query parameter is required", 400);
      const shippingData = await printifyFetch(
        `/shops/${shopId}/shipping/options.json?${new URLSearchParams({ products })}`,
        token
      );
      return jsonResponse(req, shippingData);
    }

    // POST /shipping — calculate shipping for a specific address + items
    if (req.method === "POST" && segments[0] === "shipping") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);
      const body = await req.json();
      const shippingData = await printifyFetch(
        `/shops/${shopId}/shipping/calculations.json`,
        token,
        { method: "POST", body: JSON.stringify(body) }
      );
      return jsonResponse(req, shippingData);
    }

    // GET /blueprints — list available Printify blueprints (product templates)
    if (req.method === "GET" && segments[0] === "blueprints") {
      const blueprints = await printifyFetch("/catalog/blueprints.json", token);
      return jsonResponse(req, blueprints);
    }

    // GET /blueprints/:id/providers — list print providers for a blueprint
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers") {
      const providers = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers.json`,
        token
      );
      return jsonResponse(req, providers);
    }

    // GET /blueprints/:id/providers/:providerId/variants — list variants
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers" && segments[3] && segments[4] === "variants") {
      const variants = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers/${segments[3]}/variants.json`,
        token
      );
      return jsonResponse(req, variants);
    }

    // GET /blueprints/:id/providers/:providerId/shipping — shipping profiles
    if (req.method === "GET" && segments[0] === "blueprints" && segments[1] && segments[2] === "providers" && segments[3] && segments[4] === "shipping") {
      const shipping = await printifyFetch(
        `/catalog/blueprints/${segments[1]}/print_providers/${segments[3]}/shipping.json`,
        token
      );
      return jsonResponse(req, shipping);
    }

    // POST /sync — sync products from Printify to local database
    if (req.method === "POST" && segments[0] === "sync") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);

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

            // Detect personalization options from Printify.
            // Only write these fields if the API responds — never overwrite with false on error.
            let personalizationPayload: Record<string, unknown> = {};
            try {
              const personalizationOptions = await printifyFetch(
                `/shops/${shopId}/products/${detail.id}/personalization_options.json`,
                token
              );
              const fields = Array.isArray(personalizationOptions) ? personalizationOptions : (personalizationOptions?.data || []);
              personalizationPayload = {
                is_personalizable: fields.length > 0,
                personalization_label: fields.length > 0 ? (fields[0].label || null) : null,
              };
            } catch {
              // Non-fatal — skip personalization fields so existing DB values are preserved
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
              ...personalizationPayload,
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
              const rawDesc = detail.description || "";
              payload.title = detail.title;
              payload.description = rawDesc
                .replace(/<[^>]*>/g, " ")
                .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
                .replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
                .replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
                .replace(/&mdash;/g, "\u2014").replace(/&ndash;/g, "\u2013")
                .replace(/&hellip;/g, "...").replace(/&#[0-9]+;/g, "")
                .replace(/&[a-z]+;/g, "").replace(/[ \t]+/g, " ")
                .replace(/\n{3,}/g, "\n\n").trim();
              payload.image_url = images[0] || null;
              payload.images = images;
            }

            const { data, error } = await supabase
              .from("products")
              .upsert(payload, { onConflict: "printify_id" })
              .select("id");

            if (error) errors.push({ id: String(p.id), error: error.message });
            else if (data && data[0]) {
              synced.push(String(detail.id));
              // Confirm publish to Printify so products don't get stuck in "Publishing" state.
              // Fire-and-forget — failure is non-fatal.
              printifyFetch(
                `/shops/${shopId}/products/${detail.id}/publishing_succeeded.json`,
                token,
                { method: "POST", body: JSON.stringify({ title: true, description: true, images: true, variants: true, tags: true }) }
              ).catch(() => {});
            }
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

      return jsonResponse(req, {
        synced: synced.length,
        deleted,
        errors: errors.length,
        error_details: errors.slice(0, 10),
      });
    }

    // POST /cleanup — delete DB products whose printify_id is no longer in Printify
    if (req.method === "POST" && segments[0] === "cleanup") {
      const shopId = url.searchParams.get("shop_id");
      if (!shopId) return errorResponse(req, "shop_id query parameter is required", 400);

      const liveIds = new Set<string>();
      let page = 1, lastPage = 1;
      do {
        const listing = await printifyFetch(`/shops/${shopId}/products.json?limit=50&page=${page}`, token);
        lastPage = Number(listing.last_page) || 1;
        for (const p of listing.data || []) liveIds.add(String(p.id));
        page++;
      } while (page <= lastPage);

      const { data: dbRows } = await supabase
        .from("products")
        .select("id, printify_id")
        .not("printify_id", "is", null);

      const staleIds = (dbRows || [])
        .filter((r: any) => !liveIds.has(String(r.printify_id)))
        .map((r: any) => r.id);

      if (!staleIds.length) return jsonResponse(req, { deleted: 0, message: "Nothing to clean up" });

      const { error } = await supabase.from("products").delete().in("id", staleIds);
      if (error) return errorResponse(req, error.message);

      return jsonResponse(req, { deleted: staleIds.length });
    }

    return errorResponse(req, "Not found", 404);
  } catch (err) {
    return errorResponse(req, err.message || "Internal server error", 500);
  }
});
