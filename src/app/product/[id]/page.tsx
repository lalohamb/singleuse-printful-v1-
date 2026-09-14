import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Script from "next/script";
import StorefrontLayout from "@/components/StorefrontLayout";
import ProductDetailClient from "./ProductDetailClient";
import type { Product } from "@/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) },
});

async function getSeoSettings() {
  const { data } = await supabase.from("seo_settings").select("site_url, default_og_image, jsonld_enabled, canonical_enabled, meta_title_suffix").limit(1).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [productRes, seo] = await Promise.all([
    supabase.from("products").select("title, description, image_url").eq("id", id).maybeSingle(),
    getSeoSettings(),
  ]);
  if (!productRes.data) return { title: "Product Not Found" };
  const { title, description, image_url } = productRes.data;
  const base = (seo?.site_url || "https://genderapparel.example").replace(/\/$/, "");
  const ogImage = image_url || seo?.default_og_image || null;
  return {
    title,
    description: description || undefined,
    ...(seo?.canonical_enabled && { alternates: { canonical: `${base}/product/${id}` } }),
    openGraph: {
      title,
      description: description || undefined,
      url: `${base}/product/${id}`,
      type: "website",
      ...(ogImage && { images: [{ url: ogImage, width: 800, height: 800, alt: title }] }),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [productRes, relatedRes, seo] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").neq("id", id).limit(4),
    getSeoSettings(),
  ]);

  if (!productRes.data) notFound();
  const product = productRes.data as Product;
  const base = (seo?.site_url || "https://genderapparel.example").replace(/\/$/, "");

  const jsonLd = seo?.jsonld_enabled ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: product.image_url || undefined,
    url: `${base}/product/${product.id}`,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${base}/product/${product.id}`,
    },
    brand: { "@type": "Brand", name: "Gender Apparel" },
  } : null;

  return (
    <StorefrontLayout>
      {jsonLd && (
        <Script id="product-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(jsonLd)}
        </Script>
      )}
      <ProductDetailClient product={product} related={(relatedRes.data || []) as Product[]} />
    </StorefrontLayout>
  );
}
