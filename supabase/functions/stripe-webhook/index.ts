import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

// This function is called server-to-server by Stripe only.
// No CORS headers are needed or set.
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      return json({ error: "Stripe not configured" }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (!webhookSecret) return json({ error: "Webhook secret not configured" }, 500);

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return json({ error: "Missing stripe-signature header" }, 400);

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = session.payment_intent as string;

        // Update the order from pending to paid
        const { data: updatedOrder } = await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            livemode: event.livemode,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id)
          .select("id, subtotal, affiliate_code")
          .maybeSingle();

        // Record affiliate conversion
        const affiliateCode = updatedOrder?.affiliate_code || session.metadata?.affiliate_code;
        if (affiliateCode && updatedOrder?.subtotal) {
          const { data: affiliate } = await supabase
            .from("affiliates")
            .select("id, commission_rate, email")
            .eq("code", affiliateCode)
            .eq("status", "active")
            .maybeSingle();

          if (affiliate) {
            const commission = Math.round(updatedOrder.subtotal * affiliate.commission_rate * 100) / 100;
            await supabase.from("affiliate_conversions").insert({
              affiliate_id: affiliate.id,
              order_id: updatedOrder.id,
              order_subtotal: updatedOrder.subtotal,
              commission_amount: commission,
              status: "pending",
            });

            // Notify affiliate of new conversion
            const resendKey = Deno.env.get("RESEND_API_KEY");
            const siteUrl = Deno.env.get("SITE_URL") || "https://your-store.example";
            if (resendKey && affiliate.email) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: "Your Store <no-reply@your-store.example>",
                  to: affiliate.email,
                  subject: `You earned ${commission.toFixed(2)} — new sale through your link! 🎉`,
                  html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
                    <h2 style="color:#111">New Sale!</h2>
                    <p>Someone just purchased through your referral link.</p>
                    <table style="width:100%;border-collapse:collapse;margin:24px 0">
                      <tr><td style="padding:8px 0;color:#666">Order Value</td><td style="padding:8px 0;font-weight:600;text-align:right">$${updatedOrder.subtotal.toFixed(2)}</td></tr>
                      <tr><td style="padding:8px 0;color:#666">Your Commission</td><td style="padding:8px 0;font-weight:700;color:#16a34a;text-align:right">$${commission.toFixed(2)}</td></tr>
                      <tr><td style="padding:8px 0;color:#666">Status</td><td style="padding:8px 0;text-align:right">Pending (14-day review)</td></tr>
                    </table>
                    <p><a href="${siteUrl}/affiliates/dashboard" style="background:#d4af37;color:#111;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View Dashboard →</a></p>
                    <p style="color:#666;font-size:13px;margin-top:32px">— The Body &amp; Sleeves Team</p>
                  </div>`,
                }),
              }).catch((e: Error) => console.error("Affiliate notification error:", String(e?.message ?? e).replace(/[\r\n]/g, " ")));
            }
          }
        }

        // Add customer to MailerLite
        const mailerLiteKey = Deno.env.get("MAILER_LITE_API_KEY");
        if (mailerLiteKey && session.metadata?.email) {
          const mlName = session.metadata.shipping_name?.split(" ")[0] || "";
          await fetch("https://api.mailerlite.com/api/v2/groups/182701481182365511/subscribers", {
            method: "POST",
            headers: { "X-MailerLite-ApiKey": mailerLiteKey, "Content-Type": "application/json" },
            body: JSON.stringify({ email: session.metadata.email, name: mlName }),
          }).catch((e: Error) => console.error("MailerLite sync error:", String(e?.message ?? e).replace(/[\r\n]/g, " ")));
        }

        // Send order confirmation email via Resend
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey && session.metadata?.email) {
          const customerEmail = session.metadata.email;
          // Fetch full items from DB (has image_url, stripped from metadata to avoid Stripe 500-char limit)
          const { data: orderRow } = await supabase
            .from("orders")
            .select("items")
            .eq("stripe_session_id", session.id)
            .maybeSingle();
          const orderItems = orderRow?.items ?? (session.metadata?.items ? JSON.parse(session.metadata.items) : []);
          const itemsHtml = orderItems.map((item: any) =>
            `<tr>
              <td style="padding:12px 0;vertical-align:top">
                ${ item.image_url ? `<img src="${item.image_url}" alt="${item.title}" width="100" height="100" style="border-radius:8px;object-fit:cover;display:block;margin-right:16px;float:left" />` : "" }
                <span style="display:block;padding-left:${item.image_url ? "116px" : "0"}">
                  <strong>${item.title}</strong><br/>
                  <span style="color:#666;font-size:13px">${item.variant_label} &times; ${item.quantity}</span>
                  ${item.personalization_text ? `<span style="color:#7c3aed;font-size:12px;display:block;margin-top:2px">✏️ ${item.personalization_text}</span>` : ""}
                </span>
              </td>
              <td style="padding:12px 0;vertical-align:top;text-align:right;white-space:nowrap">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>`
          ).join("");
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Your Store <orders@your-store.example>",
              to: customerEmail,
              subject: `Order Confirmed – #${session.id.slice(-8).toUpperCase()}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2>Thanks for your order, ${session.metadata.shipping_name?.split(" ")[0]}!</h2>
                <p>Your order <strong>#${session.id.slice(-8).toUpperCase()}</strong> has been confirmed and is being processed.</p>
                <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
                <hr/>
                <p><strong>Total: $${((session.amount_total ?? 0) / 100).toFixed(2)}</strong></p>
                <p>We'll send you another email when your order ships.</p>
                <p></p>
                <p>If you have any questions, feel free to reply to this email </p>
                <p>or contact us at <a href="mailto:hello@your-store.example?subject=Regarding%20Order%20%23${session.id.slice(-8).toUpperCase()}">hello@your-store.example</a></p>
                <p>Thanks for supporting our small business!</p>
                <p>— Your Store</p>
              </div>`,
            }),
          }).catch((e: Error) => console.error("Resend error:", String(e?.message ?? e).replace(/[\r\n]/g, " ")));
        }

        // Optionally forward to Printify for fulfillment
        const printifyToken = Deno.env.get("PRINTIFY_API_TOKEN");
        const { data: settingsData } = await supabase.from("settings").select("printify_shop_id").limit(1).maybeSingle();
        const printifyShopId = settingsData?.printify_shop_id || Deno.env.get("PRINTIFY_SHOP_ID");

        if (printifyToken && printifyShopId && session.metadata?.items && event.livemode) {
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
                ...(item.personalization_text ? { print_details: [{ print_on_side: "front", text: item.personalization_text }] } : {}),
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
            console.error("Printify order submission failed:", String((printifyErr as any)?.message ?? printifyErr).replace(/[\r\n]/g, " "));
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

    return json({ received: true });
  } catch (err) {
    return json({ error: err.message || "Webhook handler error" }, 500);
  }
});
