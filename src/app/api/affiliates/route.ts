import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type AffiliatePayoutProfile = {
  name?: string | null;
  email: string;
  code: string;
  payout_method?: string | null;
  payout_handle?: string | null;
};

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Gender Apparel <no-reply@genderapparel.example>",
      to,
      subject,
      html,
    }),
  }).catch((e) => console.error("Resend error:", String(e.message).replace(/[\r\n]/g, " ")));
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { action, ...payload } = await req.json();

  // ── Approve affiliate ────────────────────────────────────────────────────
  if (action === "approve") {
    const { affiliate_id } = payload;
    const supabase = sb();

    const { data: aff, error } = await supabase
      .from("affiliates")
      .update({ status: "active" })
      .eq("id", affiliate_id)
      .select("name, email, code")
      .single();

    if (error || !aff) return NextResponse.json({ error: error?.message || "Not found" }, { status: 400 });

    const dashUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://genderapparel.example"}/affiliates/dashboard`;
    await sendEmail(
      aff.email,
      "You're approved! Welcome to the Gender Apparel Affiliate Program 🎉",
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#111">Welcome to the team, ${aff.name.split(" ")[0]}!</h2>
        <p>Your affiliate application has been <strong>approved</strong>. You're now part of the Gender Apparel affiliate program.</p>
        <h3 style="color:#111;margin-top:24px">Your Details</h3>
        <ul>
          <li>Your referral code: <strong>${aff.code}</strong></li>
          <li>Commission: <strong>10% of every order subtotal</strong></li>
          <li>Cookie window: <strong>30 days</strong></li>
          <li>Payout threshold: <strong>$99</strong> (paid monthly on the 1st)</li>
        </ul>
        <p style="margin-top:24px">
          <a href="${dashUrl}" style="background:#d4af37;color:#111;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Go to Your Dashboard →
          </a>
        </p>
        <p style="color:#666;font-size:13px;margin-top:32px">Questions? Reply to this email and we'll get back to you.</p>
        <p style="color:#666;font-size:13px">— The Gender Apparel Team</p>
      </div>`
    );

    return NextResponse.json({ ok: true });
  }

  // ── Send payout (Stripe transfer + email) ────────────────────────────────
  if (action === "payout") {
    const { payout_id } = payload;
    const supabase = sb();

    const { data: payout } = await supabase
      .from("affiliate_payouts")
      .select("*, affiliates(name, email, code, payout_method, payout_handle)")
      .eq("id", payout_id)
      .single();

    if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

    const aff = payout.affiliates as AffiliatePayoutProfile;
    let stripeTransferId: string | null = null;

    // Attempt Stripe transfer if connected account exists
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && payload.stripe_account_id) {
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2026-08-26.dahlia" });
        const transfer = await stripe.transfers.create({
          amount: Math.round(payout.total_amount * 100),
          currency: "usd",
          destination: payload.stripe_account_id,
          description: `Affiliate payout — ${aff.code} — ${payout.period}`,
          metadata: {
            affiliate_code: aff.code,
            affiliate_email: aff.email,
            period: payout.period,
            payout_id,
          },
        });
        stripeTransferId = transfer.id;
      } catch (e: unknown) {
        console.error("Stripe transfer failed:", getErrorMessage(e).replace(/[\r\n]/g, " "));
        // Non-fatal — still mark paid and email
      }
    }

    // Update payout record
    await supabase.from("affiliate_payouts").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_memo: stripeTransferId || payout.stripe_memo || payload.memo || "",
    }).eq("id", payout_id);

    // Mark conversions paid
    await supabase.from("affiliate_conversions")
      .update({ status: "paid", paid_at: new Date().toISOString(), payout_id })
      .eq("payout_id", payout_id);

    // Email affiliate
    const dashUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://genderapparel.example"}/affiliates/dashboard`;
    const affiliateFirstName = (aff.name || aff.email).split(" ")[0];
    await sendEmail(
      aff.email,
      `Your affiliate payout of $${payout.total_amount.toFixed(2)} has been sent 💸`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h2 style="color:#111">Payout Sent, ${affiliateFirstName}!</h2>
        <p>We've sent your affiliate payout for <strong>${payout.period}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr><td style="padding:8px 0;color:#666">Amount</td><td style="padding:8px 0;font-weight:600;text-align:right">$${payout.total_amount.toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Method</td><td style="padding:8px 0;text-align:right;text-transform:capitalize">${aff.payout_method}: ${aff.payout_handle}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Period</td><td style="padding:8px 0;text-align:right">${payout.period}</td></tr>
          ${stripeTransferId ? `<tr><td style="padding:8px 0;color:#666">Transfer ID</td><td style="padding:8px 0;text-align:right;font-size:12px;font-family:monospace">${stripeTransferId}</td></tr>` : ""}
        </table>
        <p>
          <a href="${dashUrl}" style="background:#d4af37;color:#111;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            View Dashboard →
          </a>
        </p>
        <p style="color:#666;font-size:13px;margin-top:32px">Keep sharing your link — next payout is on the 1st of next month.</p>
        <p style="color:#666;font-size:13px">— The Gender Apparel Team</p>
      </div>`
    );

    return NextResponse.json({ ok: true, stripe_transfer_id: stripeTransferId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
