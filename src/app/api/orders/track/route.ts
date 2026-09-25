import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order")?.trim().toUpperCase();
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!orderId || !email)
    return NextResponse.json({ error: "Order ID and email are required" }, { status: 400 });

  if (!/^[A-Z0-9]{8}$/.test(orderId))
    return NextResponse.json({ error: "Invalid order ID format" }, { status: 400 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });

  const { data: orders } = await sb()
    .from("orders")
    .select("id, status, fulfillment_status, tracking_number, tracking_url, shipping_name, shipping_address, subtotal, shipping_cost, total, items, created_at, printify_order_id")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(50);

  const order = (orders ?? []).find(
    (o) => o.id.slice(-8).toUpperCase() === orderId
  );

  if (!order)
    return NextResponse.json({ error: "No order found matching that ID and email address" }, { status: 404 });

  return NextResponse.json({ order });
}
