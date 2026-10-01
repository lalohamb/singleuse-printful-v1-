import { createClient } from "@supabase/supabase-js";

export interface ProductImage {
  id: string;
  product_id: string;
  product_variant_id: string | null;
  source: string;
  storage_path: string | null;
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
  mockup_task_key: string | null;
  created_at: string;
  updated_at: string;
}

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

// Returns all product_images for a product, ordered by display_order.
export async function getProductImages(productId: string): Promise<ProductImage[]> {
  const { data } = await getClient()
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("display_order");
  return (data ?? []) as ProductImage[];
}

// Returns the primary product image URL with fallback chain:
//   1. product_images.is_primary = true
//   2. first ordered product_images row
//   3. legacy products.image_url
//   4. first legacy products.images entry
//   5. /product-placeholder.svg
export async function getPrimaryProductImageUrl(
  productId: string,
  legacyImageUrl: string | null,
  legacyImages: string[]
): Promise<string> {
  const images = await getProductImages(productId);
  if (images.length > 0) {
    const primary = images.find((i) => i.is_primary) ?? images[0];
    return primary.image_url;
  }
  if (legacyImageUrl) return legacyImageUrl;
  if (legacyImages.length > 0) return legacyImages[0];
  return "/product-placeholder.svg";
}
