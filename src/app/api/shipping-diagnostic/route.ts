import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ShippingProfile = {
  countries?: string[];
  first_item?: { cost?: number | string | null };
};

export async function GET() {
  const authError = await requireAdmin();
  if (authError) return authError;
  // 1. Settings
  const { data: settings } = await supabase
    .from("settings")
    .select("printful_connected, printful_store_id")
    .limit(1)
    .maybeSingle();

  const printfulConnected = !!settings?.printful_connected;

  // 2. Product coverage
  const { data: products } = await supabase
    .from("products")
    .select("id, title, shipping_info")
    .eq("status", "active");

  const total = products?.length ?? 0;
  const withShippingInfo = 0; // Printful uses live rates — no static profiles
  const missingShippingInfo: { id: string; title: string }[] = [];

  const mode: "live" | "partial" | "fallback" = printfulConnected ? "live" : "fallback";

  return NextResponse.json({
    mode,
    printfulConnected,
    products: { total, withShippingInfo, missingShippingInfo },
    sampleRate: null,
    sampleProduct: null,
  });
}
