import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeConfig } from "@/lib/stripe-config";
import { getErrorMessage } from "@/lib/errors";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function sbService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getResendKey(): Promise<string | null> {
  const { data } = await sbService().from("settings").select("resend_api_key").limit(1).maybeSingle();
  return data?.resend_api_key || process.env.RESEND_API_KEY || null;
}

async function getStripe() {
  const config = await getStripeConfig();
  if (!config) return null;
  return new Stripe(config.secretKey, { apiVersion: "2026-08-26.dahlia" });
}

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const stripe = await getStripe();
  if (!stripe)
    return NextResponse.json({ error: "Stripe keys not configured. Set up Stripe in the admin panel." }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "balance") return NextResponse.json(await stripe.balance.retrieve());
    if (action === "charges") {
      const limit = parseInt(searchParams.get("limit") || "20");
      const starting_after = searchParams.get("starting_after") || undefined;
      return NextResponse.json(await stripe.charges.list({ limit, starting_after }));
    }
    if (action === "payouts") return NextResponse.json(await stripe.payouts.list({ limit: 10 }));
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { action, charge_id, amount, secret_key, webhook_url } = await req.json();

  try {
    if (action === "refund") {
      const stripe = await getStripe();
      if (!stripe)
        return NextResponse.json({ error: "Stripe keys not configured." }, { status: 500 });
      if (!charge_id || typeof charge_id !== "string" || !/^ch_[\w-]{1,255}$/.test(charge_id))
        return NextResponse.json({ error: "Invalid charge_id" }, { status: 400 });
      const params: Stripe.RefundCreateParams = { charge: charge_id };
      if (amount !== undefined) {
        const parsed = parseInt(amount, 10);
        if (!Number.isInteger(parsed) || parsed <= 0)
          return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
        params.amount = parsed;
      }
      const refund = await stripe.refunds.create(params);

      // Send refund confirmation email
      try {
        const supabase = sbService();
        const resendKey = await getResendKey();
        if (resendKey) {
          // Look up order by stripe_payment_intent_id via the charge
          const charge = await stripe.charges.retrieve(charge_id);
          const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
          const { data: order } = paymentIntentId
            ? await supabase.from("orders").select("email, shipping_name, total, id").eq("stripe_payment_intent_id", paymentIntentId).maybeSingle()
            : { data: null };
          const { data: emailSettings } = await supabase.from("settings").select("store_name, email_from, email_support").limit(1).maybeSingle();
          const fromAddr = emailSettings?.email_from || process.env.RESEND_API_KEY || "orders@your-store.example";
          const supportAddr = emailSettings?.email_support || emailSettings?.email_from || "hello@your-store.example";
          const storeName = emailSettings?.store_name || "Your Store";
          const customerEmail = order?.email || charge.billing_details?.email;
          const refundAmount = ((refund.amount ?? 0) / 100).toFixed(2);
          const orderRef = order?.id ? order.id.slice(-8).toUpperCase() : charge_id.slice(-8).toUpperCase();
          const firstName = order?.shipping_name?.split(" ")[0] || "there";

          if (customerEmail) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: `${storeName} <${fromAddr}>`,
                to: customerEmail,
                subject: `Your refund of $${refundAmount} is on its way — #${orderRef}`,
                html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
                  <div style="background:#1a1a1a;padding:24px;text-align:center">
                    <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px">${storeName.toUpperCase()}</h1>
                  </div>
                  <div style="padding:32px 24px">
                    <h2 style="margin-top:0">Refund Confirmed, ${firstName}</h2>
                    <p style="color:#555">We've issued a refund of <strong>$${refundAmount}</strong> for order <strong>#${orderRef}</strong>.</p>
                    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px;margin:24px 0">
                      <table style="width:100%;border-collapse:collapse;font-size:14px">
                        <tr><td style="padding:6px 0;color:#666">Refund amount</td><td style="padding:6px 0;text-align:right;font-weight:600">$${refundAmount}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Order</td><td style="padding:6px 0;text-align:right">#${orderRef}</td></tr>
                        <tr><td style="padding:6px 0;color:#666">Status</td><td style="padding:6px 0;text-align:right;color:#16a34a;font-weight:600">Processed</td></tr>
                      </table>
                    </div>
                    <p style="color:#555">Refunds typically appear on your statement within <strong>5–10 business days</strong> depending on your bank.</p>
                    <p style="color:#888;font-size:13px;margin-top:32px">Questions? Contact us at <a href="mailto:${supportAddr}">${supportAddr}</a></p>
                    <p style="color:#888;font-size:13px">— ${storeName} Team</p>
                  </div>
                </div>`,
              }),
            });
          }
        }
      } catch (emailErr) {
        // Non-fatal — refund already succeeded, just log
        console.error("Refund email failed:", getErrorMessage(emailErr));
      }

      return NextResponse.json(refund);
    }

    if (action === "register_webhook") {
      if (!secret_key || !webhook_url)
        return NextResponse.json({ error: "secret_key and webhook_url required" }, { status: 400 });
      let parsedUrl: URL;
      try { parsedUrl = new URL(webhook_url); } catch {
        return NextResponse.json({ error: "Invalid webhook_url" }, { status: 400 });
      }
      if (parsedUrl.protocol !== "https:")
        return NextResponse.json({ error: "webhook_url must use https" }, { status: 400 });
      const client = new Stripe(secret_key, { apiVersion: "2026-08-26.dahlia" });
      const existing = await client.webhookEndpoints.list({ limit: 20 });
      const match = existing.data.find((ep) => ep.url === webhook_url);
      if (match) {
        return NextResponse.json({ webhook_id: match.id, signing_secret: null, livemode: !secret_key.startsWith("sk_test"), reused: true });
      }
      const endpoint = await client.webhookEndpoints.create({
        url: webhook_url,
        enabled_events: ["checkout.session.completed", "payment_intent.payment_failed"],
      });
      return NextResponse.json({ webhook_id: endpoint.id, signing_secret: endpoint.secret, livemode: !secret_key.startsWith("sk_test"), reused: false });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
