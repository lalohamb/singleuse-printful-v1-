import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

async function printifyFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
  // SSRF guard — only allow requests to the Printify API
  const fullUrl = `${PRINTIFY_API_BASE}${path}`;
  if (!fullUrl.startsWith(PRINTIFY_API_BASE)) {
    throw new Error("Invalid Printify path");
  }
  const res = await fetch(fullUrl, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  const text = await res.text();
  let body: unknown;
  try {
    const parsed = JSON.parse(text);
    body = (parsed !== null && typeof parsed === "object") ? parsed : text;
  } catch { body = text; }
  if (!res.ok) throw new Error(`Printify ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}

async function mapAndUpsertProduct(supabase: any, detail: any, token: string, isLocked: boolean) {
  const optionValues = new Map<number, { type: string; title: string }>();
  for (const opt of detail.options || []) {
    for (const val of opt.values || []) {
      optionValues.set(val.id, { type: opt.type, title: val.title });
    }
  }

  const allVariants = detail.variants || [];
  const enabled = allVariants.filter((v: any) => v.is_enabled);
  const usable = enabled.length ? enabled : allVariants;

  const colorOf = (v: any): string => {
    for (const vid of v.options || []) {
      const meta = optionValues.get(vid);
      if (meta?.type === "color") return meta.title;
    }
    return "Default";
  };
  const variantColor = new Map<string, string>();
  for (const v of allVariants) variantColor.set(String(v.id), colorOf(v));

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
    let color = "Default", size = "";
    for (const vid of v.options || []) {
      const meta = optionValues.get(vid);
      if (!meta) continue;
      if (meta.type === "color") color = meta.title;
      else if (meta.type === "size") size = meta.title;
    }
    return {
      id: String(v.id), label: v.title || String(v.id), color, size,
      price: (Number(v.price) || 0) / 100,
      image_url: colorImage.get(color) || null,
    };
  });

  const priceVariant = usable.find((v: any) => v.is_default) || usable[0] || {};
  const price = (Number(priceVariant.price) || 0) / 100;
  const cost = (Number(priceVariant.cost) || 0) / 100;

  const seen = new Set<string>();
  const images: string[] = [];
  const ordered = [...(detail.images || [])].sort((a: any, b: any) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));
  for (const img of ordered) {
    const src = typeof img === "string" ? img : img.src;
    if (src && !seen.has(src)) { seen.add(src); images.push(src); }
  }

  const payload: Record<string, unknown> = {
    printify_id: String(detail.id),
    price, cost, variants,
    // Use Printify's visible flag — only products published via the handshake are active
    status: detail.visible ? "active" : "draft",
    blueprint_id: String(detail.blueprint_id || ""),
    print_provider_id: String(detail.print_provider_id || ""),
    updated_at: new Date().toISOString(),
  };

  if (detail.blueprint_id && detail.print_provider_id) {
    try {
      const shippingProfile = await printifyFetch(
        `/catalog/blueprints/${detail.blueprint_id}/print_providers/${detail.print_provider_id}/shipping.json`,
        token
      );
      payload.shipping_info = shippingProfile;
    } catch { /* non-fatal */ }
  }

  // Content fields: always write on first insert; respect lock on updates
  if (!isLocked) {
    payload.title = detail.title;
    payload.description = detail.description || "";
    payload.image_url = images[0] || null;
    payload.images = images;
  }

  return supabase.from("products").upsert(payload, { onConflict: "printify_id" }).select("id");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendShippingEmail(resendKey: string, order: {
  email: string;
  shipping_name: string;
  id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  items: Array<{ title: string; variant_label: string; quantity: number }>;
}) {
  const firstName = order.shipping_name.split(" ")[0];
  const orderRef = order.id.slice(-8).toUpperCase();

  const trackingHtml = order.tracking_url
    ? `<p><a href="${order.tracking_url}" style="background:#1a1a1a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px">Track Your Order →</a></p>`
    : order.tracking_number
    ? `<p>Tracking number: <strong>${order.tracking_number}</strong></p>`
    : "";

  const itemsHtml = (order.items ?? [])
    .map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f0f0f0">${i.title} — ${i.variant_label}</td><td style="padding:6px 0;border-bottom:1px solid #f0f0f0;text-align:right">×${i.quantity}</td></tr>`)
    .join("");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Body & Sleeves <orders@bodyandsleeves.com>",
      to: order.email,
      subject: `Your order #${orderRef} has shipped! 📦`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
          <div style="background:#1a1a1a;padding:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px">BODY & SLEEVES</h1>
          </div>
          <div style="padding:32px 24px">
            <h2 style="margin-top:0">Your order is on its way, ${firstName}! 🎉</h2>
            <p style="color:#555">Order <strong>#${orderRef}</strong> has shipped and is heading to you.</p>
            ${trackingHtml}
            <h3 style="margin-top:32px;margin-bottom:8px;font-size:14px;text-transform:uppercase;letter-spacing:1px;color:#888">Items Shipped</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">${itemsHtml}</table>
            <p style="margin-top:32px;color:#888;font-size:13px">Questions? Reply to this email or reach us at Hello.BodyandSleeves@gmail.com</p>
            <p style="color:#888;font-size:13px">— The Body & Sleeves Team</p>
          </div>
        </div>
      `,
    }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method === "GET") return json({ received: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    // Deserialization guard — validate payload shape before use
    if (!payload || typeof payload !== "object" || typeof payload.type !== "string") {
      return json({ error: "Invalid payload" }, 400);
    }
    const { type, resource } = payload as { type: string; resource: any };

    // ── product:publish / product:publish:started — upsert product and confirm publish to Printify
    if (type === "product:publish" || type === "product:publish:started") {
      const token = Deno.env.get("PRINTIFY_API_TOKEN");
      const shopId = Deno.env.get("PRINTIFY_SHOP_ID");
      if (!token || !shopId) return json({ error: "Printify not configured" }, 400);

      const printifyProductId = resource?.id ? String(resource.id) : null;
      if (!printifyProductId) return json({ received: true });

      try {
        // Check if this product is content-locked in our DB
        const { data: existing } = await supabase
          .from("products")
          .select("content_locked")
          .eq("printify_id", printifyProductId)
          .maybeSingle();
        const isLocked = existing?.content_locked === true;

        // Fetch full product detail from Printify
        const detail = await printifyFetch(`/shops/${shopId}/products/${printifyProductId}.json`, token);
        await mapAndUpsertProduct(supabase, detail, token, isLocked);

        // Mark shop as connected
        await supabase.from("settings")
          .update({ printify_connected: true, printify_shop_id: shopId, updated_at: new Date().toISOString() })
          .neq("id", "00000000-0000-0000-0000-000000000000");

        // Confirm publish back to Printify — required for custom integration shops.
        // Without this the product stays stuck at "Publishing" in Printify.
        await printifyFetch(
          `/shops/${shopId}/products/${printifyProductId}/publishing_succeeded.json`,
          token,
          {
            method: "POST",
            body: JSON.stringify({
              title: true,
              description: true,
              images: true,
              variants: true,
              tags: true,
              keyFeatures: true,
              shipping_template: true,
            }),
          }
        );

        // Now that Printify confirmed publish, mark the product active in our DB
        await supabase
          .from("products")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("printify_id", printifyProductId);
      } catch (e: any) {
        // If upsert succeeded but publish confirmation failed, try to notify Printify of failure
        try {
          await printifyFetch(
            `/shops/${shopId}/products/${printifyProductId}/publishing_failed.json`,
            token,
            { method: "POST", body: JSON.stringify({ reason: e.message }) }
          );
        } catch { /* best effort */ }
        throw e;
      }

      return json({ received: true, product_id: printifyProductId });
    }

    const printifyOrderId = resource?.id ? String(resource.id) : null;
    if (!printifyOrderId) return json({ received: true });

    if (type === "order:shipment:created") {
      const shipment = resource.shipments?.[0] ?? {};
      const trackingNumber: string | null = shipment.tracking_number ?? null;
      const trackingUrl: string | null = shipment.tracking_url ?? null;

      const { data: order } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "shipped",
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("printify_order_id", printifyOrderId)
        .select("id, email, shipping_name, items, tracking_number, tracking_url")
        .maybeSingle();

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && order?.email) {
        await sendShippingEmail(resendKey, {
          ...order,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
        }).catch((e: Error) => console.error("Resend shipping email failed:", e.message));
      }
    }

    if (type === "order:shipment:delivered" || type === "order:fulfilled") {
      await supabase
        .from("orders")
        .update({
          fulfillment_status: "fulfilled",
          status: "fulfilled",
          updated_at: new Date().toISOString(),
        })
        .eq("printify_order_id", printifyOrderId);
    }

    if (type === "order:created") {
      await supabase
        .from("orders")
        .update({
          fulfillment_status: "in-production",
          status: "fulfilled",
          updated_at: new Date().toISOString(),
        })
        .eq("printify_order_id", printifyOrderId);
    }

    if (type === "order:canceled") {
      await supabase
        .from("orders")
        .update({
          fulfillment_status: "cancelled",
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("printify_order_id", printifyOrderId);
    }

    if (type === "order:payment:failed") {
      await supabase
        .from("orders")
        .update({
          fulfillment_status: "payment-failed",
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("printify_order_id", printifyOrderId);
    }

    return json({ received: true });
  } catch (err) {
    const safeMsg = String(err instanceof Error ? err.message : err).replace(/[\r\n]/g, " ");
    console.error("Printify webhook error:", safeMsg);
    return json({ error: safeMsg }, 500);
  }
});
