import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const { data: affiliate } = await sb()
    .from("affiliates")
    .select("id, name, email, code, status, commission_rate, payout_method, payout_handle, created_at")
    .eq("code", code)
    .maybeSingle();

  if (!affiliate) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (affiliate.status !== "active") return NextResponse.json({ error: "Account not active" }, { status: 403 });

  const [clicksRes, conversionsRes, payoutsRes] = await Promise.all([
    sb().from("affiliate_clicks").select("id, created_at").eq("code", code).order("created_at", { ascending: false }),
    sb().from("affiliate_conversions").select("id, order_subtotal, commission_amount, status, created_at").eq("affiliate_id", affiliate.id).order("created_at", { ascending: false }),
    sb().from("affiliate_payouts").select("id, period, total_amount, payout_method, payout_handle, status, paid_at, created_at").eq("affiliate_id", affiliate.id).order("created_at", { ascending: false }),
  ]);

  const conversions = conversionsRes.data ?? [];
  const pendingEarnings = conversions.filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_amount), 0);
  const approvedEarnings = conversions.filter((c) => c.status === "approved").reduce((s, c) => s + Number(c.commission_amount), 0);
  const paidEarnings = conversions.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount), 0);

  return NextResponse.json({
    affiliate,
    stats: {
      total_clicks: clicksRes.data?.length ?? 0,
      total_conversions: conversions.length,
      pending_earnings: Math.round(pendingEarnings * 100) / 100,
      approved_earnings: Math.round(approvedEarnings * 100) / 100,
      paid_earnings: Math.round(paidEarnings * 100) / 100,
    },
    conversions,
    payouts: payoutsRes.data ?? [],
    referral_url: `${process.env.NEXT_PUBLIC_SITE_URL}?ref=${code}`,
  });
}
