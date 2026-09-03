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

async function getPrintifyToken(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("printify_connected")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // The Printify API token is stored as an edge function secret
  return Deno.env.get("PRINTIFY_API_TOKEN") ?? null;
}

async function printifyFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${PRINTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
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
    const path = url.pathname.replace("/functions/v1/printify-proxy", "");
    const segments = path.split("/").filter(Boolean);

    const token = await getPrintifyToken(supabase);
    if (!token) {
      return errorResponse("Printify is not configured. Set the PRINTIFY_API_TOKEN secret.", 400);
    }

    // GET /shops — list connected Printify shops
    if (req.method === "GET" && segments[0] === "shops") {
      const shops = await printifyFetch("/shops.json", token);
      return jsonResponse(shops);
    }

    // GET /products — list products from a shop
    if (req.method === "GET" && segments[0] === "products") {
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

      const printifyProducts = await printifyFetch(
        `/shops/${shopId}/products.json?limit=100`,
        token
      );

      const synced: any[] = [];
      for (const p of printifyProducts.data || []) {
        const detail = await printifyFetch(
          `/shops/${shopId}/products/${p.id}.json`,
          token
        );

        const variants = (detail.variants || []).map((v: any) => ({
          id: String(v.id),
          label: v.title || v.id,
          color: v.options?.color || "Default",
          size: v.options?.size || "",
          price: parseFloat(v.cost) || 0,
        }));

        const images = (detail.images || []).map((img: any) => img.src || img);

        // Upsert into local products table
        const { data, error } = await supabase
          .from("products")
          .upsert({
            printify_id: String(detail.id),
            title: detail.title,
            description: detail.description || "",
            price: parseFloat(detail.variants?.[0]?.retail_price || "0") / 100,
            cost: parseFloat(detail.variants?.[0]?.cost || "0") / 100,
            image_url: images[0] || null,
            images: images,
            variants: variants,
            status: detail.is_locked ? "active" : "active",
            blueprint_id: String(detail.blueprint_id || ""),
            print_provider_id: String(detail.print_provider_id || ""),
            updated_at: new Date().toISOString(),
          }, { onConflict: "printify_id" })
          .select();

        if (!error && data) synced.push(data[0]);
      }

      // Update settings to mark printify as connected
      await supabase
        .from("settings")
        .update({ printify_connected: true, updated_at: new Date().toISOString() })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      return jsonResponse({ synced: synced.length, products: synced });
    }

    return errorResponse("Not found", 404);
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
