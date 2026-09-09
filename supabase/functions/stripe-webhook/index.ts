import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;
    if (webhookSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } else {
      event = JSON.parse(body);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = session.payment_intent as string;

        // Update the order from pending to paid
        await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id);

        // Send order confirmation email via Resend
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey && session.metadata?.email) {
          const customerEmail = session.metadata.email;
          const orderItems = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
          const itemsHtml = orderItems.map((item: any) =>
            `<tr><td style="padding:8px 0">${item.title} (${item.variant_label}) x${item.quantity}</td><td style="padding:8px 0;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td></tr>`
          ).join("");
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Body & Sleeves <orders@bodyandsleeves.com>",
              to: customerEmail,
              subject: `Order Confirmed – #${session.id.slice(-8).toUpperCase()}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2>Thanks for your order, ${session.metadata.shipping_name?.split(" ")[0]}!</h2>
                <p>Your order <strong>#${session.id.slice(-8).toUpperCase()}</strong> has been confirmed and is being processed.</p>
                <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
                <hr/>
                <p><strong>Total: $${((session.amount_total ?? 0) / 100).toFixed(2)}</strong></p>
                <p>We'll send you another email when your order ships.</p>
                <p>— Body & Sleeves</p>
              </div>`,
            }),
          }).catch((e: Error) => console.error("Resend error:", e.message));
        }

        // Optionally forward to Printify for fulfillment
        const printifyToken = Deno.env.get("PRINTIFY_API_TOKEN");
        const { data: settingsData } = await supabase.from("settings").select("printify_shop_id").limit(1).maybeSingle();
        const printifyShopId = settingsData?.printify_shop_id || Deno.env.get("PRINTIFY_SHOP_ID");

        if (printifyToken && printifyShopId && session.metadata?.items) {
          try {
            const items = JSON.parse(session.metadata.items);
            const shippingAddress = JSON.parse(session.metadata.shipping_address || "{}");

            const printifyOrder: any = {
              external_id: session.id,
              label: `BS-${session.id.slice(-8)}`,
              line_items: items.map((item: any) => ({
                product_id: item.printify_id || undefined,
                variant_id: parseInt(item.variant_id) || undefined,
                quantity: item.quantity,
              })),
              shipping_method: 1,
              send_shipping_notification: false,
              address_to: {
                first_name: session.metadata.shipping_name?.split(" ")[0] || "",
                last_name: session.metadata.shipping_name?.split(" ").slice(1).join(" ") || "",
                email: session.metadata.email || "",
                phone: session.customer_details?.phone || "",
                country: shippingAddress.country || "US",
                region: shippingAddress.state || "",
                city: shippingAddress.city || "",
                address1: shippingAddress.line1 || "",
                address2: shippingAddress.line2 || "",
                zip: shippingAddress.zip || "",
              },
            };

            const printifyRes = await fetch(
              `https://api.printify.com/v1/shops/${printifyShopId}/orders.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${printifyToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(printifyOrder),
              }
            );

            if (printifyRes.ok) {
              const printifyOrderData = await printifyRes.json();
              await supabase
                .from("orders")
                .update({
                  printify_order_id: String(printifyOrderData.id),
                  fulfillment_status: printifyOrderData.status || "pending",
                  updated_at: new Date().toISOString(),
                })
                .eq("stripe_session_id", session.id);
            }
          } catch (printifyErr) {
            console.error("Printify order submission failed:", printifyErr.message);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabase
          .from("orders")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Webhook handler error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
