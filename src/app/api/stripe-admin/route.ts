import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-08-26.dahlia" });

export async function GET(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 });
  }
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 500 });
  }
  const { action, charge_id, amount } = await req.json();

  try {
    if (action === "refund") {
      const params: Stripe.RefundCreateParams = { charge: charge_id };
      if (amount) params.amount = amount;
      const refund = await stripe.refunds.create(params);
      return NextResponse.json(refund);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
