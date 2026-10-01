import { createClient } from "npm:@supabase/supabase-js@2.57.4";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sendShippingEmail(
  resendKey: string,
  fromAddr: string,
  supportAddr: string,
  storeName: string,
  order: {
    email: string;
    shipping_name: string;
    id: string;
    tracking_number: string | null;
    tracking_url: string | null;
    items: Array<{ title: string; variant_label: string; quantity: number }>;
  }
) {
  const firstName = order.shipping_name.split(" ")[0];
  const orderRef = order.id.slice(-8).toUpperCase();

  const trackingHtml = order.tracking_url
    ? `<p><a href="${order.tracking_url}" style="background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px">Track Your Order →</a></p>`
    : order.tracking_number
    ? `<p>Tracking number: <strong>${order.tracking_number}</strong></p>`
    : "";

  const itemsHtml = (order.items ?? [])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${i.title} — ${i.variant_label}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right">×${i.quantity}</td></tr>`
    )
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${storeName} <${fromAddr}>`,
      to: order.email,
      subject: `Your order #${orderRef} has shipped! 📦`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#1a1a1a;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px">${storeName.toUpperCase()}</h1>
          </div>
          <div style="padding:32px 24px">
            <h2 style="margin-top:0">Your order is on its way, ${firstName}! 🎉</h2>
            <p style="color:#555">Order <strong>#${orderRef}</strong> has shipped and is heading to you.</p>
            ${trackingHtml}
            <h3 style="margin-top:32px;margin-bottom:8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#888">Items Shipped</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">${itemsHtml}</table>
            <p style="margin-top:32px;color:#888;font-size:13px">Questions? Reply to this email or reach us at ${supportAddr}</p>
            <p style="color:#888;font-size:13px">— ${storeName} Team</p>
          </div>
        </div>
      `,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = Deno.env.get("PRINTFUL_WEBHOOK_SECRET");
    const sig = req.headers.get("X-PF-Signature");
    const rawBody = await req.text();

    if (secret) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const expected = Array.from(new Uint8Array(sigBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (sig !== expected) return json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(rawBody);
    if (!payload || typeof payload.type !== "string") return json({ error: "Invalid payload" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, data } = payload as { type: string; data: any };

    if (type === "package_shipped") {
      const printfulOrderId = String(data?.order?.id ?? "");
      const shipment = data?.shipment ?? {};

      const { data: order } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "shipped",
          tracking_number: shipment.tracking_number ?? null,
          tracking_url: shipment.tracking_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("printful_order_id", printfulOrderId)
        .select("id, email, shipping_name, items, tracking_number, tracking_url")
        .maybeSingle();

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && order?.email) {
        const { data: emailSettings } = await supabase
          .from("settings")
          .select("store_name, email_from, email_support")
          .limit(1)
          .maybeSingle();
        const fromAddr = emailSettings?.email_from || Deno.env.get("EMAIL_FROM") || "orders@your-store.example";
        const supportAddr = emailSettings?.email_support || emailSettings?.email_from || Deno.env.get("EMAIL_FROM") || "hello@your-store.example";
        const storeName = emailSettings?.store_name || "Your Store";
        await sendShippingEmail(resendKey, fromAddr, supportAddr, storeName, {
          ...order,
          tracking_number: shipment.tracking_number ?? null,
          tracking_url: shipment.tracking_url ?? null,
        }).catch((e: Error) => console.error("Resend shipping email failed:", e.message));
      }
    }

    if (type === "order_updated") {
      const printfulOrderId = String(data?.order?.id ?? "");
      const status = data?.order?.status;
      if (status === "fulfilled") {
        await supabase
          .from("orders")
          .update({ fulfillment_status: "fulfilled", status: "fulfilled", updated_at: new Date().toISOString() })
          .eq("printful_order_id", printfulOrderId);
      } else if (status === "canceled") {
        await supabase
          .from("orders")
          .update({ fulfillment_status: "cancelled", status: "cancelled", updated_at: new Date().toISOString() })
          .eq("printful_order_id", printfulOrderId);
      }
    }

    return json({ received: true });
  } catch (err: any) {
    const safeMsg = String(err?.message ?? err).replace(/[\r\n]/g, " ");
    console.error("Printful webhook error:", safeMsg);
    return json({ error: safeMsg }, 500);
  }
});
