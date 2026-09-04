import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Body & Sleeves — Black-Owned Apparel",
  description: "Empower yourself. Empower the Culture. Shop made-to-order apparel celebrating Black culture, faith, and family.",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ISR: regenerate this page at most once per 60s so product/settings edits
// and Printify re-syncs show up on the storefront without a manual rebuild.
export const revalidate = 60;

export default async function HomePage() {
  const [settingsRes, featuredRes, newArrivalsRes, trendingRes, categoriesRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").eq("featured", true).limit(4),
    supabase.from("products").select("*").eq("status", "active").eq("is_new_arrival", true).order("created_at", { ascending: false }).limit(12),
    supabase.from("products").select("*").eq("status", "active").eq("is_trending", true).limit(4),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <StorefrontLayout>
      <HomeClient
        settings={settingsRes.data}
        featured={featuredRes.data || []}
        newArrivals={newArrivalsRes.data || []}
        trending={trendingRes.data || []}
        categories={categoriesRes.data || []}
      />
    </StorefrontLayout>
  );
}
