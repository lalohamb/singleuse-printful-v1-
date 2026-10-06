import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Phase 5.1 / 5.1A: Direct Catalog Order types ─────────────────────────────

interface FulfillmentFile {
  type: string;
  url: string;
}

interface FulfillmentOption {
  id: string;
  value: string | string[];
}

interface FulfillmentSnapshot {
  version: 1;
  strategy: "DIRECT_CATALOG_ORDER" | "SYNC_VARIANT";
  store_product_id: string;
  store_variant_id: string;
  printful_catalog_product_id: number;
  printful_catalog_variant_id: number;
  design_id: string;
  artwork_url: string;
  placement: string;
  technique: string;
  files: FulfillmentFile[];
  options: FulfillmentOption[];
  frozen_at: string;
}

// Deterministic external_id — same store order always produces the same value.
// Used for idempotency and lost-response recovery.
// NOTE: Printful external_id max length is 32 characters.
// We use "so-" prefix + first 29 chars of UUID (dashes stripped) = 32 chars.
// NOTE: Printful returns HTTP 400 (OR-13) on duplicate external_id — it does NOT
// silently return the existing order. Application-level duplicate protection via
// printful_order_id guard is therefore required. The @external_id lookup endpoint
// (GET /orders/@<external_id>) is used for lost-response recovery.
function buildExternalId(storeOrderId: string): string {
  const stripped = storeOrderId.replace(/-/g, "").substring(0, 29);
  return `so-${stripped}`;
}

// Phase 5.1A: Validate a stored FulfillmentSnapshot before using it.
// Returns error string or null if valid.
function validateStoredSnapshot(snap: FulfillmentSnapshot): string | null {
  if (snap.version !== 1) return `unsupported version: ${snap.version}`;
  if (snap.strategy !== "DIRECT_CATALOG_ORDER") return `unexpected strategy: ${snap.strategy}`;
  if (!snap.printful_catalog_variant_id || snap.printful_catalog_variant_id <= 0)
    return "invalid printful_catalog_variant_id";
  if (!snap.files || snap.files.length === 0) return "no manufacturing files";
  if (!snap.artwork_url) return "no artwork_url";
  if (!snap.placement) return "no placement";
  if (!snap.technique) return "no technique";
  if (!Array.isArray(snap.options)) return "options must be array";
  return null;
}

// Build Printful V2 direct catalog order item from immutable snapshot.
// V2 shape: source="catalog", catalog_variant_id, placements[]
// Live-proven: POST /v2/orders with this shape → HTTP 200, status: draft
function buildV2CatalogOrderItem(
  snapshot: FulfillmentSnapshot,
  quantity: number,
  retailPrice: number
): Record<string, unknown> {
  return {
    source: "catalog" as const,
    catalog_variant_id: snapshot.printful_catalog_variant_id,
    quantity: Math.max(1, Math.floor(quantity)),
    retail_price: retailPrice.toFixed(2),
    placements: [{
      placement: snapshot.placement,
      technique: snapshot.technique,
      layers: [{ type: "file", url: snapshot.artwork_url }],
    }],
  };
}

// Build Printful V1 direct catalog order item from immutable snapshot.
// V1 shape: variant_id, files[], options[] — preserved for SYNC_VARIANT path.
function buildV1CatalogItem(
  snapshot: FulfillmentSnapshot,
  quantity: number,
  retailPrice: number,
  variantLabel: string
): Record<string, unknown> {
  return {
    variant_id: snapshot.printful_catalog_variant_id,
    quantity: Math.max(1, Math.floor(quantity)),
    retail_price: retailPrice.toFixed(2),
    name: variantLabel,
    files: snapshot.files,
    options: snapshot.options,
  };
}

// ── Printful live shipping quote ──────────────────────────────────────────────
// V2 path (DIRECT_CATALOG_ORDER items only):
//   POST /v2/shipping-rates
//   order_items[].source = "catalog", catalog_variant_id, quantity
//   Response: { data: [{ shipping, rate, currency, ... }], extra: [] }
//
// V1 path (SYNC_VARIANT items or mixed carts):
//   POST /shipping/rates
//   items[].variant_id, quantity
//   Response: { code, result: [{ rate, ... }] }
type VerifiedItemForShipping = {
  printful_id: string | null;
  variant_id: string;
  quantity: number;
  catalog_variant_id?: number | null;
  is_catalog_builder?: boolean;
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

    // Use V2 only when ALL items are catalog_builder (DIRECT_CATALOG_ORDER).
    // Mixed or sync carts use V1 to preserve existing behavior.
    const allCatalogBuilder = items.length > 0 && items.every((i) => i.is_catalog_builder && i.catalog_variant_id);

    if (allCatalogBuilder) {
      // V2 path: POST /v2/shipping-rates
      // Live-proven: order_items[].source="catalog", catalog_variant_id, quantity
      // Response envelope: { data: [{ shipping, rate, currency, ... }], extra: [] }
      const orderItems = items.map((i) => ({
        source: "catalog" as const,
        catalog_variant_id: i.catalog_variant_id!,
        quantity: i.quantity,
      }));
      const res = await fetch("https://api.printful.com/v2/shipping-rates", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { address1: "1 Main St", city: "New York", state_code: "NY", country_code: "US", zip: "10001" },
          order_items: orderItems,
          currency: "USD",
          locale: "en_US",
        }),
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      // V2 envelope: data[0].rate (string)
      const rate = parseFloat(data?.data?.[0]?.rate ?? "0");
      return rate > 0 ? rate : fallback;
    }

    // V1 path: POST /shipping/rates — sync/mixed carts (preserved)
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
    // V1 envelope: result[0].rate (string)
    const rate = parseFloat(data?.result?.[0]?.rate ?? "0");
    return rate > 0 ? rate : fallback;
  } catch {
    return 6.99;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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

        let { data: updatedOrder } = await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            livemode: event.livemode,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id)
          .select("id, subtotal, affiliate_code, fulfillment_snapshot, items, printful_order_id")
          .maybeSingle();

        // ── Phase 5.2A: Crash-window recovery ────────────────────────────────
        // If updatedOrder is null, the stripe-checkout edge function created the
        // Stripe session but the local order INSERT failed (DB error / timeout).
        // The customer paid; we must not lose the record.
        // Reconstruct the order from session metadata and insert it now.
        // NOTE: fulfillment_snapshot is NOT in metadata (too large), so
        // Printful fulfillment will be blocked for catalog_builder items on this
        // recovered order — status will be set to "needs_admin_review".
        // The order record exists; admin can resolve fulfillment manually.
        if (!updatedOrder) {
          console.warn("[webhook] no local order for session", session.id, "— attempting recovery from metadata");
          try {
            const meta = session.metadata ?? {};
            const recoveredItems = meta.items ? JSON.parse(meta.items) : [];
            const recoveredShipping = Number(meta.shipping_cost) || 0;
            const recoveredSubtotal = Number(meta.subtotal) || ((session.amount_total ?? 0) / 100) - recoveredShipping;
            const recoveredTotal = Number(meta.total) || (session.amount_total ?? 0) / 100;
            const recoveredAddress = meta.shipping_address ? JSON.parse(meta.shipping_address) : {};

            if (meta.email && meta.shipping_name) {
              const { data: inserted } = await supabase
                .from("orders")
                .insert({
                  stripe_session_id: session.id,
                  stripe_payment_intent_id: paymentIntentId,
                  email: meta.email,
                  shipping_name: meta.shipping_name,
                  shipping_address: recoveredAddress,
                  shipping_cost: recoveredShipping,
                  subtotal: recoveredSubtotal,
                  total: recoveredTotal,
                  status: "paid",
                  livemode: event.livemode,
                  items: recoveredItems,
                  fulfillment_status: "needs_admin_review",
                  ...(meta.affiliate_code ? { affiliate_code: meta.affiliate_code } : {}),
                })
                .select("id, subtotal, affiliate_code, fulfillment_snapshot, items, printful_order_id")
                .maybeSingle();

              if (inserted) {
                updatedOrder = inserted;
                console.log("[webhook] recovered order inserted:", inserted.id, "for session", session.id);
              } else {
                console.error("[webhook] recovery insert failed for session", session.id);
              }
            } else {
              console.error("[webhook] recovery impossible — missing email/shipping_name in metadata for session", session.id);
            }
          } catch (recoveryErr) {
            console.error("[webhook] recovery error for session", session.id, ":",
              String((recoveryErr as Error)?.message ?? recoveryErr).replace(/[\r\n]/g, " "));
          }
        }
        // ─────────────────────────────────────────────────────────────────────

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

            const resendKey = Deno.env.get("RESEND_API_KEY");
            const siteUrl = Deno.env.get("SITE_URL") || "https://your-store.example";
            const { data: affSettings } = await supabase.from("settings").select("store_name, email_from").limit(1).maybeSingle();
            const affFromAddr = affSettings?.email_from || Deno.env.get("EMAIL_FROM") || "no-reply@your-store.example";
            const affStoreName = affSettings?.store_name || "Your Store";
            if (resendKey && affiliate.email) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from: `${affStoreName} <${affFromAddr}>`,
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
        const { data: emailSettings } = await supabase.from("settings").select("store_name, email_from, email_support").limit(1).maybeSingle();
        const fromAddr = emailSettings?.email_from || Deno.env.get("EMAIL_FROM") || "orders@your-store.example";
        const supportAddr = emailSettings?.email_support || emailSettings?.email_from || Deno.env.get("EMAIL_FROM") || "hello@your-store.example";
        const storeName = emailSettings?.store_name || "Your Store";
        if (resendKey && session.metadata?.email) {
          const customerEmail = session.metadata.email;
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
          const resendRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: `${storeName} <${fromAddr}>`,
              to: customerEmail,
              subject: `Order Confirmed – #${session.id.slice(-8).toUpperCase()}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2>Thanks for your order, ${session.metadata.shipping_name?.split(" ")[0]}!</h2>
                <p>Your order <strong>#${session.id.slice(-8).toUpperCase()}</strong> has been confirmed and is being processed.</p>
                <table style="width:100%;border-collapse:collapse">${itemsHtml}</table>
                <hr/>
                <p><strong>Total: $${((session.amount_total ?? 0) / 100).toFixed(2)}</strong></p>
                <p>We'll send you another email when your order ships.</p>
                <p>If you have any questions, feel free to reply to this email or contact us at <a href="mailto:${supportAddr}?subject=Regarding%20Order%20%23${session.id.slice(-8).toUpperCase()}">${supportAddr}</a></p>
                <p>Thanks for supporting our small business!</p>
                <p>— ${storeName}</p>
              </div>`,
            }),
          });
          if (!resendRes.ok) {
            const resendErr = await resendRes.text();
            console.error("Resend error:", resendRes.status, resendErr.replace(/[\r\n]/g, " "));
          }
        }

        // ── Phase 5.1A / Workstream B: Origin-aware Printful fulfillment ──────
        //
        // DIRECT_CATALOG_ORDER (all-catalog_builder cart) → V2 POST /v2/orders
        //   order_items[].source="catalog", catalog_variant_id, placements[]
        //   Response: { data: { id, external_id, status, ... }, extra: [] }
        //   Live-proven: Batch 2 verification, order 179545353.
        //
        // SYNC_VARIANT (any sync item, or mixed cart) → V1 POST /orders
        //   Preserved exactly. Mixed carts use V1 whole-order behavior.
        //   Do NOT invent a V2 sync item shape.
        //
        // Duplicate protection:
        //   If printful_order_id is already set on this order, a Printful order
        //   was already created. Skip to avoid duplicate. This guards against
        //   concurrent webhook executions and Stripe retries.
        //
        // Lost-response recovery (V2):
        //   V2 returns error.reason="BadRequest" + "External ID validation error"
        //   (not OR-13). Recover via GET /v2/orders/@<external_id>.
        //   Response: { data: { id, ... }, extra: [] } — parse data.id.
        //
        // Lost-response recovery (V1):
        //   OR-13 → GET /orders/@<external_id> → result.id (unchanged).
        //
        // PRINTFUL_AUTO_CONFIRM:
        //   Missing/empty/invalid = false (draft only, safe default).
        //   Only explicit "true" triggers manufacturing.
        //   V2 orders are draft by default — no confirm parameter needed.
        const printfulToken = Deno.env.get("PRINTFUL_API_TOKEN");
        const autoConfirmRaw = Deno.env.get("PRINTFUL_AUTO_CONFIRM");
        const autoConfirm = autoConfirmRaw === "true"; // fail-safe: anything else = false

        if (printfulToken && updatedOrder) {
          // ── Duplicate protection guard ──────────────────────────────────────
          // If printful_order_id is already set, a Printful order exists.
          // This handles concurrent webhook executions and Stripe retries.
          if (updatedOrder.printful_order_id) {
            console.log(
              "[webhook] Printful order already exists for store order",
              updatedOrder.id,
              "printful_order_id:", updatedOrder.printful_order_id,
              "— skipping duplicate submission"
            );
            break;
          }

          try {
            const orderItems: any[] = updatedOrder.items ?? [];
            const storedSnapshots: Record<string, FulfillmentSnapshot> =
              updatedOrder.fulfillment_snapshot ?? {};

            const shippingAddress = session.metadata?.shipping_address
              ? JSON.parse(session.metadata.shipping_address)
              : {};

            // Determine fulfillment path: V2 if ALL items are DIRECT_CATALOG_ORDER,
            // V1 if any item is SYNC_VARIANT or has no snapshot (mixed/sync cart).
            // Do NOT invent a V2 shape for sync items.
            const allDirectCatalog = orderItems.length > 0 && orderItems.every((item: any) => {
              const svId: string = item.store_variant_id ?? item.variant_id;
              const snap = storedSnapshots[svId] as FulfillmentSnapshot | undefined;
              return snap?.strategy === "DIRECT_CATALOG_ORDER";
            });

            const v2OrderItems: Record<string, unknown>[] = [];
            const v1PrintfulItems: Record<string, unknown>[] = [];

            for (const item of orderItems) {
              const storeVariantId: string = item.store_variant_id ?? item.variant_id;
              const snapshot = storedSnapshots[storeVariantId] as FulfillmentSnapshot | undefined;

              if (snapshot?.strategy === "DIRECT_CATALOG_ORDER") {
                // ── DIRECT_CATALOG_ORDER: validate snapshot before use ─────────
                const snapError = validateStoredSnapshot(snapshot);
                if (snapError) {
                  throw new Error(
                    `Catalog Builder snapshot invalid for store_variant_id=${storeVariantId}: ${snapError}. ` +
                    `Order preserved. Admin resolution required.`
                  );
                }
                if (allDirectCatalog) {
                  // V2 path: build V2 order item with placements[]
                  v2OrderItems.push(buildV2CatalogOrderItem(snapshot, item.quantity, item.price ?? 0));
                } else {
                  // Mixed cart: fall back to V1 shape for this item
                  v1PrintfulItems.push(buildV1CatalogItem(
                    snapshot, item.quantity, item.price ?? 0, item.variant_label ?? item.title ?? ""
                  ));
                }
              } else {
                // ── SYNC_VARIANT or no snapshot: V1 path (preserved) ──────────
                const pfVariantId = item.printful_variant_id;
                if (!pfVariantId) {
                  throw new Error(
                    `No Printful variant ID for store_variant_id=${storeVariantId}. ` +
                    `Order preserved in DB for admin resolution.`
                  );
                }
                const numericId = Number(pfVariantId);
                if (!Number.isFinite(numericId) || numericId <= 0) {
                  throw new Error(
                    `printful_variant_id "${pfVariantId}" is not a valid numeric provider ID ` +
                    `for store_variant_id=${storeVariantId}.`
                  );
                }
                const pfItem: Record<string, unknown> = {
                  variant_id: numericId,
                  quantity: item.quantity,
                  retail_price: String((item.price || 0).toFixed(2)),
                  name: item.title || "",
                };
                if (item.personalization_text || item.pt) {
                  pfItem.files = [{ type: "default", url: "", options: [{ id: "text", value: item.personalization_text || item.pt }] }];
                }
                v1PrintfulItems.push(pfItem);
              }
            }

            const externalId = buildExternalId(updatedOrder.id);
            const recipient = {
              name: session.metadata?.shipping_name || "",
              address1: shippingAddress.line1 || "",
              address2: shippingAddress.line2 || "",
              city: shippingAddress.city || "",
              state_code: shippingAddress.state || "",
              country_code: shippingAddress.country || "US",
              zip: shippingAddress.zip || "",
              email: session.metadata?.email || "",
              phone: session.customer_details?.phone || session.metadata?.phone || "",
            };

            let printfulRes: Response;
            let useV2 = allDirectCatalog;

            if (useV2) {
              // ── V2 path: POST /v2/orders ──────────────────────────────────────
              // Live-proven: Batch 2 verification. Draft by default — no confirm param.
              // Response envelope: { data: { id, external_id, status, ... }, extra: [] }
              if (v2OrderItems.length === 0) throw new Error("No fulfillable V2 items in order");
              const v2Order = {
                external_id: externalId,
                shipping: "STANDARD",
                recipient,
                order_items: v2OrderItems,
              };
              printfulRes = await fetch("https://api.printful.com/v2/orders", {
                method: "POST",
                headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(v2Order),
              });
            } else {
              // ── V1 path: POST /orders — sync/mixed carts (preserved) ──────────
              if (v1PrintfulItems.length === 0) throw new Error("No fulfillable items in order");
              const confirmParam = autoConfirm ? "?confirm=true" : "";
              const v1Order = {
                external_id: externalId,
                shipping: "STANDARD",
                recipient,
                items: v1PrintfulItems,
              };
              printfulRes = await fetch(`https://api.printful.com/orders${confirmParam}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
                body: JSON.stringify(v1Order),
              });
            }

            if (printfulRes.ok) {
              const printfulData = await printfulRes.json();
              // V2 envelope: data.id  |  V1 envelope: result.id
              const providerId = useV2
                ? String(printfulData.data.id)
                : String(printfulData.result.id);
              const providerStatus = useV2
                ? (printfulData.data.status || "draft")
                : (printfulData.result.status || "pending");
              await supabase
                .from("orders")
                .update({
                  printful_order_id: providerId,
                  fulfillment_status: providerStatus,
                  printful_fulfillment_status: providerStatus,
                  fulfillment_provider: "printful",
                  updated_at: new Date().toISOString(),
                })
                .eq("stripe_session_id", session.id);
            } else {
              const errBody = await printfulRes.json().catch(() => ({}));

              // ── Lost-response recovery ────────────────────────────────────────
              // V2: error.reason="BadRequest" AND message contains "External ID validation error"
              //   → recover via GET /v2/orders/@{external_id} → data.id
              // V1: api_error_code="OR-13" (preserved)
              //   → recover via GET /orders/@{external_id} → result.id
              const isV2Duplicate =
                useV2 &&
                (errBody as any)?.error?.reason === "BadRequest" &&
                String((errBody as any)?.error?.message ?? "").includes("External ID validation error");
              const isV1Duplicate =
                !useV2 &&
                ((errBody as any)?.error?.api_error_code === "OR-13" ||
                  (printfulRes.status === 400 && String((errBody as any)?.error?.message ?? "").includes("External ID")));

              if (isV2Duplicate) {
                console.log("[webhook] V2 duplicate external_id — recovering via GET /v2/orders/@", externalId);
                const recoverRes = await fetch(
                  `https://api.printful.com/v2/orders/@${encodeURIComponent(externalId)}`,
                  { headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" } }
                );
                if (recoverRes.ok) {
                  const recoverData = await recoverRes.json();
                  // V2 recovery envelope: { data: { id, status, ... }, extra: [] }
                  await supabase
                    .from("orders")
                    .update({
                      printful_order_id: String(recoverData.data.id),
                      fulfillment_status: recoverData.data.status || "draft",
                      printful_fulfillment_status: recoverData.data.status || "draft",
                      fulfillment_provider: "printful",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("stripe_session_id", session.id);
                  console.log("[webhook] V2 recovered Printful order", recoverData.data.id, "via external_id lookup");
                } else {
                  console.error("[webhook] V2 recovery failed:", recoverRes.status);
                  await supabase
                    .from("orders")
                    .update({ printful_fulfillment_status: "failed", fulfillment_provider: "printful", updated_at: new Date().toISOString() })
                    .eq("stripe_session_id", session.id);
                }
              } else if (isV1Duplicate) {
                console.log("[webhook] V1 OR-13 duplicate external_id — recovering via GET /orders/@", externalId);
                const recoverRes = await fetch(
                  `https://api.printful.com/orders/@${encodeURIComponent(externalId)}`,
                  { headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" } }
                );
                if (recoverRes.ok) {
                  const recoverData = await recoverRes.json();
                  await supabase
                    .from("orders")
                    .update({
                      printful_order_id: String(recoverData.result.id),
                      fulfillment_status: recoverData.result.status || "pending",
                      printful_fulfillment_status: recoverData.result.status || "pending",
                      fulfillment_provider: "printful",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("stripe_session_id", session.id);
                  console.log("[webhook] V1 recovered Printful order", recoverData.result.id, "via external_id lookup");
                } else {
                  console.error("[webhook] V1 OR-13 recovery failed:", recoverRes.status);
                  await supabase
                    .from("orders")
                    .update({ printful_fulfillment_status: "failed", fulfillment_provider: "printful", updated_at: new Date().toISOString() })
                    .eq("stripe_session_id", session.id);
                }
              } else {
                const errText = JSON.stringify(errBody);
                console.error("Printful order failed:", printfulRes.status, errText.replace(/[\r\n]/g, " "));
                await supabase
                  .from("orders")
                  .update({ printful_fulfillment_status: "failed", fulfillment_provider: "printful", updated_at: new Date().toISOString() })
                  .eq("stripe_session_id", session.id);
              }
            }
          } catch (printfulErr) {
            console.error(
              "Printful order submission failed:",
              String((printfulErr as any)?.message ?? printfulErr).replace(/[\r\n]/g, " ")
            );
            await supabase
              .from("orders")
              .update({
                printful_fulfillment_status: "failed",
                fulfillment_provider: "printful",
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_session_id", session.id);
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
