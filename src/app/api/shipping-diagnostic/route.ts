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
    .select("printify_connected, printify_shop_id")
    .limit(1)
    .maybeSingle();

  const shopId = settings?.printify_shop_id ?? null;
  const printifyConnected = !!settings?.printify_connected;

  // 2. Product coverage — blueprint_id, print_provider_id, and shipping_info
  const { data: products } = await supabase
    .from("products")
    .select("id, title, blueprint_id, print_provider_id, shipping_info")
    .eq("status", "active");

  const total = products?.length ?? 0;

  const withBlueprint = products?.filter(
    (p) => p.blueprint_id && p.print_provider_id
  ).length ?? 0;

  const withShippingInfo = products?.filter(
    (p) => Array.isArray(p.shipping_info?.profiles) && p.shipping_info.profiles.length > 0
  ).length ?? 0;

  const missingShippingInfo = products
    ?.filter((p) => !Array.isArray(p.shipping_info?.profiles) || p.shipping_info.profiles.length === 0)
    .map((p) => ({ id: p.id, title: p.title })) ?? [];

  // 3. Sample rate — pick a product with shipping_info and calculate a US rate
  let sampleRate: number | null = null;
  let sampleProduct: string | null = null;

  const sampleP = products?.find((p) => Array.isArray(p.shipping_info?.profiles) && p.shipping_info.profiles.length > 0);
  if (sampleP) {
    const profile =
      sampleP.shipping_info.profiles.find((profile: ShippingProfile) =>
        Array.isArray(profile.countries) &&
        (profile.countries.includes("US") || profile.countries.includes("*"))
      ) ??
      sampleP.shipping_info.profiles.find((profile: ShippingProfile) =>
        Array.isArray(profile.countries) && profile.countries.includes("REST_OF_THE_WORLD")
      ) ??
      sampleP.shipping_info.profiles[0];

    if (profile) {
      sampleRate = (Number(profile.first_item?.cost) || 0) / 100;
      sampleProduct = sampleP.title;
    }
  }

  // 4. Mode
  const mode: "live" | "partial" | "fallback" =
    withShippingInfo === total && total > 0
      ? "live"
      : withShippingInfo > 0
      ? "partial"
      : "fallback";

  return NextResponse.json({
    mode,
    printifyConnected,
    shopId,
    products: { total, withBlueprint, withShippingInfo, missingShippingInfo },
    sampleRate,
    sampleProduct,
  });
}
