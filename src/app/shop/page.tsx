import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import ShopClient from "./ShopClient";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse all Body & Sleeves made-to-order apparel — T-shirts, hoodies, hats, and more.",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default async function ShopPage() {
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }),
    supabase.from("categories").select("*").order("name"),
  ]);

  return (
    <StorefrontLayout>
      <ShopClient products={productsRes.data || []} categories={categoriesRes.data || []} />
    </StorefrontLayout>
  );
}
