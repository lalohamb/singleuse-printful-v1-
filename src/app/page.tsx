import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Body & Sleeves — Black-Owned Apparel",
  description: "Empower yourself. Empower the Culture. Shop made-to-order apparel celebrating Black culture, faith, and family.",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Always fetch fresh data from Supabase on every request.
export const revalidate = 0;

export default async function HomePage() {
  const [settingsRes, featuredRes, newArrivalsRes, trendingRes, categoriesRes, catImgRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").eq("featured", true).limit(8),
    supabase.from("products").select("*").eq("status", "active").eq("is_new_arrival", true).order("created_at", { ascending: false }).limit(12),
    supabase.from("products").select("*").eq("status", "active").eq("is_trending", true).limit(12),
    supabase.from("categories").select("*").order("name"),
    supabase.from("products").select("category_id, image_url").eq("status", "active").not("image_url", "is", null).not("category_id", "is", null),
  ]);

  // Representative image per category (first active product with an image).
  const categoryImages: Record<string, string> = {};
  for (const row of (catImgRes.data || []) as Array<{ category_id: string; image_url: string }>) {
    if (row.category_id && row.image_url && !categoryImages[row.category_id]) categoryImages[row.category_id] = row.image_url;
  }

  return (
    <StorefrontLayout>
      <HomeClient
        settings={settingsRes.data}
        featured={[...(featuredRes.data || [])].sort(() => Math.random() - 0.5).slice(0, 8)}
        newArrivals={newArrivalsRes.data || []}
        trending={trendingRes.data || []}
        categories={categoriesRes.data || []}
        categoryImages={categoryImages}
      />
    </StorefrontLayout>
  );
}
