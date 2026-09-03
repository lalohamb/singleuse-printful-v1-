import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import StorefrontLayout from "@/components/StorefrontLayout";
import ProductDetailClient from "./ProductDetailClient";
import type { Product } from "@/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data } = await supabase.from("products").select("title, description").eq("id", params.id).maybeSingle();
  if (!data) return { title: "Product Not Found" };
  return { title: data.title, description: data.description || undefined };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const [productRes, relatedRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").neq("id", params.id).limit(4),
  ]);

  if (!productRes.data) notFound();

  return (
    <StorefrontLayout>
      <ProductDetailClient product={productRes.data as Product} related={(relatedRes.data || []) as Product[]} />
    </StorefrontLayout>
  );
}
