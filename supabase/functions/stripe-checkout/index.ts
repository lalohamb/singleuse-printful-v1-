import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

// CORS is restricted to the configured site origin.
function corsHeaders(req: Request): Record<string, string> {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const requestOrigin = req.headers.get("origin") ?? "";
  const isLocalhost = requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:");
  const isAllowed = requestOrigin === siteUrl || isLocalhost;
  const origin = isAllowed ? requestOrigin : "null";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  };
}

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

function sanitize<T>(value: T, depth = 0): T {
  if (depth > 10 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1)) as unknown as T;
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(value as object)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    safe[key] = sanitize((value as Record<string, unknown>)[key], depth + 1);
  }
  return safe as T;
}

// ── Phase 5.1A: Snapshot validation ──────────────────────────────────────────
// Validates a FulfillmentSnapshot has all required fields before checkout proceeds.
// For catalog_builder items this is FATAL — missing snapshot blocks checkout.
function validateSnapshot(snap: Record<string, unknown>): string | null {
  if (snap.version !== 1) return "invalid snapshot version";
  if (snap.strategy !== "DIRECT_CATALOG_ORDER") return "snapshot strategy must be DIRECT_CATALOG_ORDER";
  if (!snap.store_product_id || typeof snap.store_product_id !== "string") return "missing store_product_id";
  if (!snap.store_variant_id || typeof snap.store_variant_id !== "string") return "missing store_variant_id";
  const cpid = Number(snap.printful_catalog_product_id);
  if (!Number.isFinite(cpid) || cpid <= 0) return "invalid printful_catalog_product_id";
  const cvid = Number(snap.printful_catalog_variant_id);
  if (!Number.isFinite(cvid) || cvid <= 0) return "invalid printful_catalog_variant_id";
  if (!snap.design_id || typeof snap.design_id !== "string") return "missing design_id";
  if (!snap.artwork_url || typeof snap.artwork_url !== "string") return "missing artwork_url";
  if (!snap.placement || typeof snap.placement !== "string") return "missing placement";
  if (!snap.technique || typeof snap.technique !== "string") return "missing technique";
  if (!Array.isArray(snap.files) || snap.files.length === 0) return "missing files";
  if (!Array.isArray(snap.options)) return "missing options";
  if (!snap.frozen_at || typeof snap.frozen_at !== "string") return "missing frozen_at";
  return null;
}

// ── Printful live shipping quote ──────────────────────────────────────────────
type VerifiedItemForShipping = {
  printful_id: string | null;
  variant_id: string;
  quantity: number;
};

async function getPrintfulShipping(
  supabase: ReturnType<typeof createClient>,
  items: VerifiedItemForShipping[]
): Promise<number> {
  const FALLBACK = 6.99;
  try {
    const { data: settings } = await supabase
      .from("settings")
      .select("default_shipping_cost")
      .limit(1)
      .maybeSingle();
    const fallback = Number(settings?.default_shipping_cost) || FALLBACK;
    const token = Deno.env.get("PRINTFUL_API_TOKEN");
    if (!token) return fallback;

    const lineItems = items
      .filter((i) => i.variant_id)
      .map((i) => ({ variant_id: Number(i.variant_id), quantity: i.quantity }));
    if (!lineItems.length) return fallback;

    const res = await fetch("https://api.printful.com/shipping/rates", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { address1: "1 Main St", city: "New York", state_code: "NY", country_code: "US", zip: "10001" },
        items: lineItems,
        currency: "USD",
        locale: "en_US",
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const rate = parseFloat(data?.result?.[0]?.rate ?? "0");
    return rate > 0 ? rate : fallback;
  } catch {
    return 6.99;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders(req) });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return errorResponse(req, "Stripe is not configured. Set the STRIPE_SECRET_KEY secret.", 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const isLiveMode = !stripeSecretKey.startsWith("sk_test_");

    const body = sanitize(await req.json());
    const { items, shipping_address, shipping_name, email, affiliate_code } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(req, "Items are required", 400);
    }

    const origin = body.origin || req.headers.get("origin") || "http://localhost:5173";

    // ── Server-side price lookup ──────────────────────────────────────────────
    const productIds: string[] = [...new Set(items.map((i: any) => String(i.product_id)))];
    const { data: dbProducts, error: dbError } = await supabase
      .from("products")
      .select("id, title, image_url, images, printful_id, catalog_source, printful_catalog_id, variants, price")
      .in("id", productIds)
      .eq("status", "active");

    if (dbError) return errorResponse(req, "Failed to load products", 500);

    const productMap = new Map<string, any>();
    for (const p of dbProducts ?? []) productMap.set(String(p.id), p);

    const variantIds: string[] = items.map((i: any) => String(i.variant_id));
    const { data: dbVariants } = await supabase
      .from("product_variants")
      .select("id, product_id, printful_variant_id, label, color, size, retail_price, image_url, available, provider")
      .in("id", variantIds);

    const variantMap = new Map<string, any>();
    for (const v of dbVariants ?? []) variantMap.set(String(v.id), v);

    type VerifiedItem = {
      product_id: string;
      store_variant_id: string;
      printful_id: string | null;
      printful_variant_id: string | null;
      variant_id: string;
      variant_label: string;
      title: string;
      image_url: string;
      price: number;
      quantity: number;
      personalization_text?: string;
    };

    const verifiedItems: VerifiedItem[] = [];

    for (const item of items) {
      const product = productMap.get(String(item.product_id));
      if (!product) {
        return errorResponse(req, `Product not found or unavailable: ${item.product_id}`, 400);
      }

      const storeVariant = variantMap.get(String(item.variant_id));
      let price: number;
      let variantLabel: string;
      let imageUrl: string;
      let printfulVariantId: string | null;

      if (storeVariant) {
        if (String(storeVariant.product_id) !== String(item.product_id)) {
          return errorResponse(req, `Variant ${item.variant_id} does not belong to product ${item.product_id}`, 400);
        }
        if (!storeVariant.available) {
          return errorResponse(req, `Variant ${item.variant_id} is not available`, 400);
        }
        price = Number(storeVariant.retail_price);
        variantLabel = storeVariant.label || "";
        imageUrl = storeVariant.image_url || product.images?.[0] || product.image_url || "";
        printfulVariantId = storeVariant.printful_variant_id ?? null;
      } else {
        const legacyVariants: any[] = Array.isArray(product.variants) ? product.variants : [];
        const legacyVariant = legacyVariants.find((v: any) => String(v.id) === String(item.variant_id));
        if (!legacyVariant) {
          return errorResponse(req, `Variant not found: ${item.variant_id} for product ${item.product_id}`, 400);
        }
        price = Number(legacyVariant.price) || Number(product.price);
        variantLabel = legacyVariant.label || "";
        imageUrl = legacyVariant.image_url || product.images?.[0] || product.image_url || "";
        printfulVariantId = legacyVariant.id ?? null;
      }

      if (!price || price <= 0) {
        return errorResponse(req, `Invalid price for variant ${item.variant_id}`, 400);
      }

      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

      verifiedItems.push({
        product_id: String(item.product_id),
        store_variant_id: String(item.variant_id),
        printful_id: product.printful_id ?? null,
        printful_variant_id: printfulVariantId,
        variant_id: String(item.variant_id),
        variant_label: variantLabel,
        title: product.title,
        image_url: imageUrl,
        price,
        quantity,
        personalization_text: typeof item.personalization_text === "string"
          ? item.personalization_text.slice(0, 200)
          : undefined,
      });
    }

    // ── Phase 5.1A: Mandatory fulfillment snapshots for catalog_builder ───────
    // For catalog_builder items: snapshot resolution is FATAL.
    // A missing or invalid snapshot blocks Stripe session creation entirely.
    // The customer must never pay for an item whose manufacturing config cannot be frozen.
    //
    // For printful_sync / legacy items: no snapshot required (existing behavior).
    const fulfillmentSnapshot: Record<string, unknown> = {};

    for (const item of verifiedItems) {
      const product = productMap.get(item.product_id);
      const catalogSource = product?.catalog_source ?? "printful_sync";

      if (catalogSource !== "catalog_builder") continue;

      // FATAL path: any failure here blocks checkout for this item.
      try {
        const { data: pdRow, error: pdErr } = await supabase
          .from("product_designs")
          .select("design_id, placement, technique, configuration")
          .eq("product_id", item.product_id)
          .eq("is_primary", true)
          .maybeSingle();

        if (pdErr || !pdRow) {
          console.error("[checkout] no primary product_design for", item.product_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }
        if (!pdRow.placement || !pdRow.technique) {
          console.error("[checkout] product_design missing placement/technique for", item.product_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        const { data: dRow, error: dErr } = await supabase
          .from("designs")
          .select("id, artwork_url, status")
          .eq("id", pdRow.design_id)
          .maybeSingle();

        if (dErr || !dRow || dRow.status !== "active" || !dRow.artwork_url) {
          console.error("[checkout] design unavailable for product", item.product_id, "design", pdRow.design_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        // Validate artwork is from trusted storage
        try {
          const parsed = new URL(dRow.artwork_url);
          if (!parsed.hostname.endsWith("supabase.co")) {
            console.error("[checkout] untrusted artwork host:", parsed.hostname);
            return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
          }
        } catch {
          console.error("[checkout] invalid artwork URL for product", item.product_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        const printfulCatalogVariantId = Number(item.printful_variant_id);
        if (!Number.isFinite(printfulCatalogVariantId) || printfulCatalogVariantId <= 0) {
          console.error("[checkout] invalid printful_variant_id for store_variant", item.store_variant_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        const printfulCatalogProductId = Number(product?.printful_catalog_id);
        if (!Number.isFinite(printfulCatalogProductId) || printfulCatalogProductId <= 0) {
          console.error("[checkout] invalid printful_catalog_id for product", item.product_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        const placement: string = pdRow.placement;
        const technique: string = pdRow.technique;
        const configuration = (pdRow.configuration ?? {}) as Record<string, unknown>;

        const files = [{ type: placement, url: dRow.artwork_url }];
        const options: { id: string; value: string | string[] }[] = [];
        if (technique.toUpperCase() === "EMBROIDERY") {
          const placementSuffix = placement.replace(/^embroidery_/, "");
          const threadColorOptionId = `thread_colors_${placementSuffix}`;
          const configuredColors = configuration?.thread_colors as string[] | undefined;
          const threadColors = Array.isArray(configuredColors) && configuredColors.length > 0
            ? configuredColors : ["#FFFFFF"];
          options.push({ id: "embroidery_type", value: "flat" });
          options.push({ id: threadColorOptionId, value: threadColors });
        }

        const snap: Record<string, unknown> = {
          version: 1,
          strategy: "DIRECT_CATALOG_ORDER",
          store_product_id: item.product_id,
          store_variant_id: item.store_variant_id,
          printful_catalog_product_id: printfulCatalogProductId,
          printful_catalog_variant_id: printfulCatalogVariantId,
          design_id: dRow.id,
          artwork_url: dRow.artwork_url,
          placement,
          technique,
          files,
          options,
          frozen_at: new Date().toISOString(),
        };

        // Final validation of the constructed snapshot
        const validationError = validateSnapshot(snap);
        if (validationError) {
          console.error("[checkout] snapshot validation failed:", validationError, "for product", item.product_id);
          return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
        }

        fulfillmentSnapshot[item.store_variant_id] = snap;

      } catch (snapErr) {
        // Any unexpected error is also fatal for catalog_builder items
        console.error(
          "[checkout] fatal snapshot error for catalog_builder variant",
          item.store_variant_id,
          String((snapErr as Error)?.message ?? snapErr).replace(/[\r\n]/g, " ")
        );
        return errorResponse(req, "This product is temporarily unavailable for checkout.", 400);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const verifiedSubtotal = Math.round(
      verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
    ) / 100;

    const shippingItems = verifiedItems.map((i) => ({
      printful_id: i.printful_id,
      variant_id: i.printful_variant_id ?? i.variant_id,
      quantity: i.quantity,
    }));
    const resolvedShipping = await getPrintfulShipping(supabase, shippingItems);

    const verifiedTotal = Math.round((verifiedSubtotal + resolvedShipping) * 100) / 100;

    const lineItems = verifiedItems.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: `${item.title}${item.variant_label ? ` (${item.variant_label})` : ""}`,
          images: item.image_url ? [item.image_url] : [],
          metadata: {
            product_id: item.product_id,
            printful_product_id: item.printful_id || "",
            printful_variant_id: item.variant_id,
          },
        },
      },
    }));

    const shippingOptions = resolvedShipping > 0
      ? [{
          shipping_rate_data: {
            type: "fixed_amount" as const,
            fixed_amount: { amount: Math.round(resolvedShipping * 100), currency: "usd" },
            display_name: "Standard Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day" as const, value: 7 },
              maximum: { unit: "business_day" as const, value: 14 },
            },
          },
        }]
      : [];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      ...(shippingOptions.length ? { shipping_options: shippingOptions } : {}),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        email,
        shipping_name,
        shipping_address: JSON.stringify(shipping_address),
        shipping_cost: String(resolvedShipping),
        subtotal: String(verifiedSubtotal),
        total: String(verifiedTotal),
        items: JSON.stringify(verifiedItems.map((item) => ({
          product_id: item.product_id,
          store_variant_id: item.store_variant_id,
          printful_variant_id: item.printful_variant_id,
          quantity: item.quantity,
          ...(item.personalization_text ? { pt: item.personalization_text.slice(0, 50) } : {}),
        }))),
        ...(affiliate_code ? { affiliate_code: String(affiliate_code).slice(0, 50) } : {}),
        ...(body.phone ? { phone: String(body.phone).slice(0, 20) } : {}),
      },
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      allow_promotion_codes: true,
      phone_number_collection: {
        enabled: true,
      },
    });

    const { error: orderError } = await supabase.from("orders").insert({
      stripe_session_id: session.id,
      email,
      shipping_name,
      shipping_address,
      shipping_cost: resolvedShipping,
      subtotal: verifiedSubtotal,
      total: verifiedTotal,
      status: "pending",
      livemode: isLiveMode,
      items: verifiedItems,
      ...(Object.keys(fulfillmentSnapshot).length > 0 ? { fulfillment_snapshot: fulfillmentSnapshot } : {}),
      ...(affiliate_code ? { affiliate_code } : {}),
    });

    if (orderError) {
      console.error("Failed to create order:", String(orderError?.message ?? orderError).replace(/[\r\n]/g, " "));
    }

    return jsonResponse(req, { url: session.url, session_id: session.id });
  } catch (err) {
    return errorResponse(req, err.message || "Internal server error", 500);
  }
});
