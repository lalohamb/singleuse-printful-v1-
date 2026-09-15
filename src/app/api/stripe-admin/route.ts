import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    if (action === "balance") {
      const balance = await stripe.balance.retrieve();
      return NextResponse.json(balance);
    }
    if (action === "charges") {
      const limit = parseInt(searchParams.get("limit") || "20");
      const starting_after = searchParams.get("starting_after") || undefined;
      const charges = await stripe.charges.list({ limit, starting_after });
      return NextResponse.json(charges);
    }
    if (action === "payouts") {
      const payouts = await stripe.payouts.list({ limit: 10 });
      return NextResponse.json(payouts);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-08-26.dahlia" });

  const { action, charge_id, amount, secret_key, webhook_url } = await req.json();

  try {
    if (action === "refund") {
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
      return NextResponse.json(refund);
    }

    if (action === "register_webhook") {
      if (!secret_key || !webhook_url) return NextResponse.json({ error: "secret_key and webhook_url required" }, { status: 400 });
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(webhook_url);
      } catch {
        return NextResponse.json({ error: "Invalid webhook_url" }, { status: 400 });
      }
      if (parsedUrl.protocol !== "https:") return NextResponse.json({ error: "webhook_url must use https" }, { status: 400 });
      const client = new Stripe(secret_key, { apiVersion: "2026-08-26.dahlia" });

      // Reuse existing webhook at this URL if one exists — avoids invalidating a saved signing secret
      const existing = await client.webhookEndpoints.list({ limit: 20 });
      const match = existing.data.find((ep) => ep.url === webhook_url);
      if (match) {
        const isLive = !secret_key.startsWith("sk_test");
        // Stripe never re-exposes the signing secret after creation — caller must re-register to rotate
        return NextResponse.json({ webhook_id: match.id, signing_secret: null, livemode: isLive, reused: true });
      }

      const endpoint = await client.webhookEndpoints.create({
        url: webhook_url,
        enabled_events: ["checkout.session.completed", "payment_intent.payment_failed"],
      });
      const isLive = !secret_key.startsWith("sk_test");
      return NextResponse.json({ webhook_id: endpoint.id, signing_secret: endpoint.secret, livemode: isLive, reused: false });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
