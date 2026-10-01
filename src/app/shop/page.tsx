import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import ShopClient from "./ShopClient";
import { getPublishedProducts } from "@/lib/catalog/products";
import { getCategories } from "@/lib/catalog/categories";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { data: seo } = await supabase.from("seo_settings").select("default_og_image, site_url").limit(1).maybeSingle();
  return {
    title: "Shop",
    description: "Browse made-to-order clothing — T-shirts, hoodies, hats, and more.",
    ...(seo?.default_og_image && { openGraph: { images: [{ url: seo.default_og_image }] } }),
  };
}

export default async function ShopPage() {
  const [products, categories] = await Promise.all([
    getPublishedProducts(),
    getCategories(),
  ]);

  // Fetch primary normalized images for all products in one query.
  // Falls back to product.image_url in ProductCard when no normalized image exists.
  const productIds = products.map((p) => p.id);
  let primaryImagesByProductId: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: primaryImages } = await supabase
      .from("product_images")
      .select("product_id, image_url, is_primary, display_order")
      .in("product_id", productIds)
      .order("display_order", { ascending: true });
    if (primaryImages) {
      // For each product: prefer is_primary=true, else first by display_order
      for (const img of primaryImages) {
        const existing = primaryImagesByProductId[img.product_id];
        if (!existing || img.is_primary) {
          primaryImagesByProductId[img.product_id] = img.image_url;
        }
      }
    }
  }

  return (
    <StorefrontLayout>
      <Suspense fallback={null}>
        <ShopClient
          products={products as any}
          categories={categories}
          primaryImagesByProductId={primaryImagesByProductId}
        />
      </Suspense>
    </StorefrontLayout>
  );
}
