import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return errorResponse("Stripe is not configured. Set the STRIPE_SECRET_KEY secret.", 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const body = await req.json();
    const { items, shipping_address, shipping_name, email, shipping_cost, subtotal, total } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse("Items are required", 400);
    }

    // Determine origin for success/cancel URLs
    const origin = body.origin || req.headers.get("origin") || "http://localhost:5173";

    // Create Stripe checkout session with line items
    const lineItems = items.map((item: any) => ({
      quantity: item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(item.price * 100),
        product_data: {
          name: `${item.title}${item.variant_label ? ` (${item.variant_label})` : ""}`,
          images: item.image_url ? [item.image_url] : [],
          metadata: {
            product_id: item.product_id || "",
            printify_product_id: item.printify_id || "",
            printify_variant_id: item.variant_id || "",
          },
        },
      },
    }));

    // Add shipping as a line item if applicable
    if (shipping_cost && shipping_cost > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(shipping_cost * 100),
          product_data: {
            name: "Shipping",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: lineItems,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      metadata: {
        email,
        shipping_name,
        shipping_address: JSON.stringify(shipping_address),
        shipping_cost: String(shipping_cost || 0),
        subtotal: String(subtotal),
        total: String(total),
        items: JSON.stringify(items.map((item: any) => ({
          printify_id: item.printify_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          title: item.title?.slice(0, 60),
          price: item.price,
        }))),
      },
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      phone_number_collection: {
        enabled: true,
      },
    });

    // Create a pending order in the database
    const { error: orderError } = await supabase.from("orders").insert({
      stripe_session_id: session.id,
      email,
      shipping_name,
      shipping_address: shipping_address,
      shipping_cost: shipping_cost || 0,
      subtotal,
      total,
      status: "pending",
      items: items,
    });

    if (orderError) {
      console.error("Failed to create order:", orderError.message);
    }

    return jsonResponse({ url: session.url, session_id: session.id });
  } catch (err) {
    return errorResponse(err.message || "Internal server error", 500);
  }
});
