import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeConfig } from "@/lib/stripe-config";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

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
      return NextResponse.json(await stripe.refunds.create(params));
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
