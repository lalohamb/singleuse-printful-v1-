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

// Build Printful direct catalog order item from immutable snapshot.
// variant_id = Printful catalog variant ID — NOT sync_variant_id.
function buildDirectCatalogItem(
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

        // ── Phase 5.1A: Origin-aware Printful fulfillment ─────────────────────
        //
        // catalog_builder → DIRECT_CATALOG_ORDER from frozen snapshot ONLY.
        //   NO live-resolution fallback. Missing snapshot = fulfillment blocked.
        //
        // printful_sync → SYNC_VARIANT (existing behavior, preserved).
        //
        // Duplicate protection:
        //   If printful_order_id is already set on this order, a Printful order
        //   was already created. Skip to avoid duplicate. This guards against
        //   concurrent webhook executions and Stripe retries.
        //
        // Lost-response recovery:
        //   If POST /orders returns 400 OR-13 (duplicate external_id), the order
        //   was already created but the response was lost. Recover via
        //   GET /orders/@<external_id>.
        //
        // PRINTFUL_AUTO_CONFIRM:
        //   Missing/empty/invalid = false (draft only, safe default).
        //   Only explicit "true" triggers manufacturing.
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

            const printfulItems: Record<string, unknown>[] = [];

            for (const item of orderItems) {
              const storeVariantId: string = item.store_variant_id ?? item.variant_id;
              const snapshot = storedSnapshots[storeVariantId] as FulfillmentSnapshot | undefined;

              if (snapshot?.strategy === "DIRECT_CATALOG_ORDER") {
                // ── DIRECT_CATALOG_ORDER: catalog_builder product ─────────────
                // Phase 5.1A: validate snapshot before use — no live fallback.
                const snapError = validateStoredSnapshot(snapshot);
                if (snapError) {
                  throw new Error(
                    `Catalog Builder snapshot invalid for store_variant_id=${storeVariantId}: ${snapError}. ` +
                    `Order preserved. Admin resolution required.`
                  );
                }
                printfulItems.push(
                  buildDirectCatalogItem(
                    snapshot,
                    item.quantity,
                    item.price ?? 0,
                    item.variant_label ?? item.title ?? ""
                  )
                );
              } else if (snapshot === undefined || snapshot === null) {
                // ── Phase 5.1A: No snapshot present ──────────────────────────
                // Check if this is a catalog_builder item — if so, block fulfillment.
                // We cannot live-resolve for catalog_builder items.
                // For printful_sync items without a snapshot, use existing path.
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
                printfulItems.push(pfItem);
              } else {
                // SYNC_VARIANT snapshot present — use existing path
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
                printfulItems.push(pfItem);
              }
            }

            if (printfulItems.length === 0) {
              throw new Error("No fulfillable items in order");
            }

            const externalId = buildExternalId(updatedOrder.id);

            const printfulOrder = {
              external_id: externalId,
              shipping: "STANDARD",
              recipient: {
                name: session.metadata?.shipping_name || "",
                address1: shippingAddress.line1 || "",
                address2: shippingAddress.line2 || "",
                city: shippingAddress.city || "",
                state_code: shippingAddress.state || "",
                country_code: shippingAddress.country || "US",
                zip: shippingAddress.zip || "",
                email: session.metadata?.email || "",
                phone: session.customer_details?.phone || session.metadata?.phone || "",
              },
              items: printfulItems,
            };

            const confirmParam = autoConfirm ? "?confirm=true" : "";
            const printfulRes = await fetch(
              `https://api.printful.com/orders${confirmParam}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${printfulToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(printfulOrder),
              }
            );

            if (printfulRes.ok) {
              const printfulData = await printfulRes.json();
              await supabase
                .from("orders")
                .update({
                  printful_order_id: String(printfulData.result.id),
                  fulfillment_status: printfulData.result.status || "pending",
                  printful_fulfillment_status: printfulData.result.status || "pending",
                  fulfillment_provider: "printful",
                  updated_at: new Date().toISOString(),
                })
                .eq("stripe_session_id", session.id);
            } else {
              const errBody = await printfulRes.json().catch(() => ({}));
              const errCode = (errBody as any)?.error?.api_error_code ?? "";

              // ── Lost-response recovery ──────────────────────────────────────
              // Printful OR-13: order with this external_id already exists.
              // This means a previous webhook execution created the order but
              // the response was lost before we could record printful_order_id.
              // Recover by fetching the existing order via @external_id.
              if (errCode === "OR-13" || printfulRes.status === 400 && String((errBody as any)?.error?.message ?? "").includes("External ID")) {
                console.log("[webhook] OR-13 duplicate external_id — recovering via GET /orders/@", externalId);
                const recoverRes = await fetch(
                  `https://api.printful.com/orders/@${encodeURIComponent(externalId)}`,
                  {
                    headers: {
                      Authorization: `Bearer ${printfulToken}`,
                      "Content-Type": "application/json",
                    },
                  }
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
                  console.log("[webhook] recovered Printful order", recoverData.result.id, "via external_id lookup");
                } else {
                  console.error("[webhook] OR-13 recovery failed:", recoverRes.status);
                  await supabase
                    .from("orders")
                    .update({
                      printful_fulfillment_status: "failed",
                      fulfillment_provider: "printful",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("stripe_session_id", session.id);
                }
              } else {
                const errText = JSON.stringify(errBody);
                console.error("Printful order failed:", printfulRes.status, errText.replace(/[\r\n]/g, " "));
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
