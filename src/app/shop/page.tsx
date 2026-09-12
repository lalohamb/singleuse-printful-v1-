import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import ShopClient from "./ShopClient";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse Gender Apparel made-to-order clothing — T-shirts, hoodies, hats, and more.",
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// ISR: regenerate this page at most once per 60s so product/category edits
// and Printify re-syncs show up on the storefront without a manual rebuild.
export const revalidate = 60;

export default async function ShopPage() {
  const [productsRes, categoriesRes] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active").order("featured", { ascending: false }),
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
