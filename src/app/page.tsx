import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Body & Sleeves — Black-Owned Apparel",
  description: "Empower yourself. Empower the Culture. Shop made-to-order apparel celebrating Black culture, faith, and family.",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default async function HomePage() {
  const [settingsRes, productsRes, categoriesRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }).limit(8),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <StorefrontLayout>
      <HomeClient
        settings={settingsRes.data}
        products={productsRes.data || []}
        categories={categoriesRes.data || []}
      />
    </StorefrontLayout>
  );
}
