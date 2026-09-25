import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const shopId = new URL(req.url).searchParams.get("shop_id");
  if (!shopId || !/^\d+$/.test(shopId))
    return NextResponse.json({ error: "Invalid shop_id" }, { status: 400 });

  const token = process.env.PRINTIFY_API_TOKEN;
  if (!token)
    return NextResponse.json({ error: "PRINTIFY_API_TOKEN not set" }, { status: 500 });

  const res = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok)
    return NextResponse.json({ error: "Could not reach Printify API" }, { status: 502 });

  const data = await res.json();
  const shop = (data as Array<{ id: number; title: string }>).find(
    (s) => String(s.id) === shopId
  );

  if (!shop)
    return NextResponse.json({ error: "Shop not found" }, { status: 404 });

  return NextResponse.json({ id: shop.id, title: shop.title });
}
