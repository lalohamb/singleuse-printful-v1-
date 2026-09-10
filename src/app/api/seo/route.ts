import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "sitemap_products") {
    const { data } = await supabase
      .from("products")
      .select("id, updated_at")
      .eq("status", "active");
    return NextResponse.json(data || []);
  }

  const { data, error } = await supabase
    .from("seo_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { error } = await supabase
    .from("seo_settings")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", "00000000-0000-0000-0000-000000000001");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
