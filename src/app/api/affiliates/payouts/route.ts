import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function GET(req: NextRequest) {
  const client = await getAuthedSb(req);
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [affRes, convRes, payRes] = await Promise.all([
    client.from("affiliates").select("id, name, email, payout_method, payout_handle").eq("status", "active"),
    client.from("affiliate_conversions").select("id, affiliate_id, order_id, order_subtotal, commission_amount, status, created_at").in("status", ["pending", "approved"]).order("created_at", { ascending: true }),
    client.from("affiliate_payouts").select("*, affiliates(name, email)").order("created_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    affiliates: affRes.data ?? [],
    conversions: convRes.data ?? [],
    payouts: payRes.data ?? [],
  });
}
