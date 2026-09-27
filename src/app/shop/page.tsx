import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import ShopClient from "./ShopClient";

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
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }).limit(500),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <StorefrontLayout>
      <Suspense fallback={null}>
        <ShopClient products={productsRes.data || []} categories={categoriesRes.data || []} />
      </Suspense>
    </StorefrontLayout>
  );
}
