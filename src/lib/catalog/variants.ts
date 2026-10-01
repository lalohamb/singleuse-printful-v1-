import { createClient } from "@supabase/supabase-js";
import type { StoreVariant } from "@/types";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

// Returns available store variants for a product.
// RLS on product_variants enforces available = true for public reads.
export async function getProductVariants(productId: string): Promise<StoreVariant[]> {
  const sb = getClient();
  const { data } = await sb
    .from("product_variants")
    .select("id, product_id, provider, printful_variant_id, label, color, size, retail_price, image_url, available")
    .eq("product_id", productId)
    .eq("available", true)
    .order("label");
  return (data ?? []) as StoreVariant[];
}
