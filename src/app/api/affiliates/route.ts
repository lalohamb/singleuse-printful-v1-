import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthedSb(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  if (!token) return null;
  const { data: { user } } = await sb().auth.getUser(token);
  if (!user) return null;
  const { data } = await sb().from("admins").select("id").eq("id", user.id).maybeSingle();
  if (!data) return null;
  return sb();
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Your Store <no-reply@${new URL(siteUrl).hostname}>`, to, subject, html }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const client = await getAuthedSb(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: affiliates } = await client
    .from("affiliates")
    .select("*, affiliate_conversions(id, commission_amount, status)")
    .order("created_at", { ascending: false });

  return NextResponse.json({ affiliates: affiliates ?? [] });
}

export async function POST(req: NextRequest) {
  const client = await getAuthedSb(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, affiliate_id, notes, commission_rate, conversion_id, memo, period } = await req.json();

  try {
    if (action === "approve") {
      const { data: aff } = await sb().from("affiliates").update({ status: "active" }).eq("id", affiliate_id).select("name, email, code").maybeSingle();
      if (aff) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
        await sendEmail(aff.email, "You're approved! Welcome to the affiliate program 🎉",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2>Welcome, ${aff.name}!</h2>
            <p>Your affiliate application has been approved. You can now start earning commissions.</p>
            <p><strong>Your referral link:</strong><br/><a href="${siteUrl}?ref=${aff.code}">${siteUrl}?ref=${aff.code}</a></p>
            <p>Share this link on your platforms. You earn 10% commission on every sale you drive.</p>
            <p><a href="${siteUrl}/affiliates/dashboard?code=${aff.code}" style="background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">View Your Dashboard →</a></p>
          </div>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      const { data: aff } = await sb().from("affiliates").update({ status: "rejected" }).eq("id", affiliate_id).select("name, email").maybeSingle();
      if (aff) {
        await sendEmail(aff.email, "Update on your affiliate application",
          `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <h2>Hi ${aff.name},</h2>
            <p>Thank you for applying to our affiliate program. After reviewing your application, we're unable to approve it at this time.</p>
            <p>You're welcome to reapply in the future if your platform grows.</p>
          </div>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "suspend") {
      await sb().from("affiliates").update({ status: "suspended" }).eq("id", affiliate_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "reactivate") {
      await sb().from("affiliates").update({ status: "active" }).eq("id", affiliate_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "save_notes") {
      const update: Record<string, unknown> = {};
      if (notes !== undefined) update.notes = notes;
      if (commission_rate !== undefined) update.commission_rate = Number(commission_rate);
      await sb().from("affiliates").update(update).eq("id", affiliate_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "approve_conversion") {
      await sb().from("affiliate_conversions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", conversion_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "void_conversion") {
      await sb().from("affiliate_conversions").update({ status: "voided" }).eq("id", conversion_id);
      return NextResponse.json({ ok: true });
    }

    if (action === "payout") {
      const { data: aff } = await sb().from("affiliates").select("id, name, email, payout_method, payout_handle, commission_rate").eq("id", affiliate_id).maybeSingle();
      if (!aff) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

      const { data: approved } = await sb().from("affiliate_conversions").select("id, commission_amount").eq("affiliate_id", affiliate_id).eq("status", "approved");
      if (!approved?.length) return NextResponse.json({ error: "No approved conversions" }, { status: 400 });

      const total = approved.reduce((s, c) => s + Number(c.commission_amount), 0);
      const { data: payout } = await sb().from("affiliate_payouts").insert({
        affiliate_id,
        period: period ?? new Date().toISOString().slice(0, 7),
        total_amount: Math.round(total * 100) / 100,
        payout_method: aff.payout_method,
        payout_handle: aff.payout_handle,
        stripe_memo: memo ?? null,
        status: "paid",
        paid_at: new Date().toISOString(),
      }).select("id").maybeSingle();

      if (payout) {
        await sb().from("affiliate_conversions")
          .update({ status: "paid", paid_at: new Date().toISOString(), payout_id: payout.id })
          .in("id", approved.map((c) => c.id));
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      await sendEmail(aff.email, `Your payout of $${total.toFixed(2)} has been sent! 💸`,
        `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h2>Payout Sent, ${aff.name}!</h2>
          <p>We've sent your commission payout of <strong>$${total.toFixed(2)}</strong> via ${aff.payout_method} to ${aff.payout_handle}.</p>
          ${memo ? `<p><strong>Note:</strong> ${memo}</p>` : ""}
          <p><a href="${siteUrl}/affiliates/dashboard?code=${aff.code}" style="background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">View Dashboard →</a></p>
        </div>`
      );

      return NextResponse.json({ ok: true, total });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
