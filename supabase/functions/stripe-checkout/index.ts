import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

// CORS is restricted to the configured site origin.
// SITE_URL must be set as a Supabase edge function secret, e.g.:
//   supabase secrets set SITE_URL=https://yourdomain.com
function corsHeaders(req: Request): Record<string, string> {
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const allowedOrigin = siteUrl || "http://localhost:3000";
  const requestOrigin = req.headers.get("origin") ?? "";
  // Only reflect the origin header when it matches the allowed origin
  const origin = requestOrigin === allowedOrigin ? allowedOrigin : "null";
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

// ── Printify live shipping quote ────────────────────────────────────────────
type VerifiedItemForShipping = {
  printify_id: string | null;
  variant_id: string;
  quantity: number;
};

async function getLiveShippingCost(
  supabase: ReturnType<typeof createClient>,
  items: VerifiedItemForShipping[]
): Promise<number> {
  const FALLBACK = 6.99;

  try {
    const { data: settings } = await supabase
      .from("settings")
      .select("printify_shop_id, default_shipping_cost")
      .limit(1)
      .maybeSingle();

    const shopId = settings?.printify_shop_id;
    const fallback = Number(settings?.default_shipping_cost) || FALLBACK;
    const token = Deno.env.get("PRINTIFY_API_TOKEN");

    if (!shopId || !token) return fallback;

    // Only include items that have a Printify product ID
    const lineItems = items
      .filter((i) => i.printify_id)
      .map((i) => ({
        product_id: i.printify_id!,
        variant_id: Number(i.variant_id),
        quantity: i.quantity,
      }));

    if (!lineItems.length) return fallback;

    const res = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/orders/shipping.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          line_items: lineItems,
          address_to: { country: "US" },
        }),
      }
    );

    if (!res.ok) return fallback;

    const data = await res.json();
    // Printify returns costs in cents — convert to dollars
    const cents = Number(data?.standard) || 0;
    if (cents <= 0) return fallback;

    return Math.round(cents) / 100;
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

    // Derive livemode from the key prefix — test keys start with sk_test_
    const isLiveMode = !stripeSecretKey.startsWith("sk_test_");

    const body = sanitize(await req.json());
    const { items, shipping_address, shipping_name, email, affiliate_code } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(req, "Items are required", 400);
    }

    // Determine origin for success/cancel URLs
    const origin = body.origin || req.headers.get("origin") || "http://localhost:5173";

    // ── Server-side price lookup ──────────────────────────────────────────────
    // Never trust client-supplied prices. Fetch authoritative price/variant data
    // from the database and use those values exclusively.
    const productIds: string[] = [...new Set(items.map((i: any) => String(i.product_id)))];
    const { data: dbProducts, error: dbError } = await supabase
      .from("products")
      .select("id, title, image_url, images, printify_id, variants, price")
      .in("id", productIds)
      .eq("status", "active");

    if (dbError) return errorResponse(req, "Failed to load products", 500);

    const productMap = new Map<string, any>();
    for (const p of dbProducts ?? []) productMap.set(String(p.id), p);

    // Build verified line items using only DB prices
    type VerifiedItem = {
      product_id: string;
      printify_id: string | null;
      variant_id: string;
      variant_label: string;
      title: string;
      image_url: string;
      price: number;        // authoritative, from DB
      quantity: number;
      personalization_text?: string;
    };

    const verifiedItems: VerifiedItem[] = [];

    for (const item of items) {
      const product = productMap.get(String(item.product_id));
      if (!product) {
        return errorResponse(req, `Product not found or unavailable: ${item.product_id}`, 400);
      }

      const variants: any[] = Array.isArray(product.variants) ? product.variants : [];
      const variant = variants.find((v: any) => String(v.id) === String(item.variant_id));
      if (!variant) {
        return errorResponse(req, `Variant not found: ${item.variant_id} for product ${item.product_id}`, 400);
      }

      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      // Fall back to product-level price if variant has no price
      const price: number = Number(variant.price) || Number(product.price);
      if (!price || price <= 0) {
        return errorResponse(req, `Invalid price for variant ${item.variant_id}`, 400);
      }

      // Prefer the variant-specific image, fall back to product hero image
      const image_url: string = variant.image_url || product.images?.[0] || product.image_url || "";

      verifiedItems.push({
        product_id: String(item.product_id),
        printify_id: product.printify_id ?? null,
        variant_id: String(item.variant_id),
        variant_label: variant.label || "",
        title: product.title,
        image_url,
        price,
        quantity,
        personalization_text: typeof item.personalization_text === "string"
          ? item.personalization_text.slice(0, 200)
          : undefined,
      });
    }

    // Compute authoritative subtotal from verified items
    const verifiedSubtotal = Math.round(
      verifiedItems.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
    ) / 100;

    // ── Live Printify shipping quote ──────────────────────────────────────────
    // Fetch the real fulfillment cost from Printify instead of trusting the
    // client-supplied value. Falls back to DB-cached rates on any error.
    const resolvedShipping = await getLiveShippingCost(supabase, verifiedItems);
    // ─────────────────────────────────────────────────────────────────────────

    const verifiedTotal = Math.round((verifiedSubtotal + resolvedShipping) * 100) / 100;
    // ─────────────────────────────────────────────────────────────────────────

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
            printify_product_id: item.printify_id || "",
            printify_variant_id: item.variant_id,
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
          printify_id: item.printify_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          ...(item.personalization_text ? { pt: item.personalization_text.slice(0, 50) } : {}),
        }))),
        ...(affiliate_code ? { affiliate_code: String(affiliate_code).slice(0, 50) } : {}),
      },
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    // Create a pending order using verified server-side values only
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
