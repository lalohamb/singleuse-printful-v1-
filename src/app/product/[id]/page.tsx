import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import Script from "next/script";
import StorefrontLayout from "@/components/StorefrontLayout";
import ProductDetailClient from "./ProductDetailClient";
import type { Product, StoreVariant } from "@/types";
import { getMetaTitle, getMetaDescription, getPrimaryImage } from "@/lib/catalog/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) },
});

async function getSeoSettings() {
  const { data } = await supabase.from("seo_settings").select("site_url, default_og_image, jsonld_enabled, canonical_enabled, meta_title_suffix").limit(1).maybeSingle();
  return data;
}

// Resolves a product by slug or UUID.
// Returns null if not found.
async function resolveProduct(idOrSlug: string) {
  // Try slug first (preferred public identifier)
  const bySlug = await supabase.from("products").select("*").eq("slug", idOrSlug).maybeSingle();
  if (bySlug.data) return { product: bySlug.data as Product, resolvedBy: "slug" as const };
  // Fall back to UUID (legacy links)
  const byId = await supabase.from("products").select("*").eq("id", idOrSlug).maybeSingle();
  if (byId.data) return { product: byId.data as Product, resolvedBy: "id" as const };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [resolved, seo] = await Promise.all([resolveProduct(id), getSeoSettings()]);
  if (!resolved) return { title: "Product Not Found" };
  const { product } = resolved;
  const base = (seo?.site_url || "https://your-store.example").replace(/\/$/, "");
  const canonicalSlug = product.slug || product.id;
  const ogImage = getPrimaryImage(product) !== "/product-placeholder.svg" ? getPrimaryImage(product) : seo?.default_og_image || null;
  const metaTitle = getMetaTitle(product);
  const metaDesc = getMetaDescription(product);
  return {
    title: metaTitle,
    description: metaDesc,
    ...(seo?.canonical_enabled && { alternates: { canonical: `${base}/product/${canonicalSlug}` } }),
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: `${base}/product/${canonicalSlug}`,
      type: "website",
      ...(ogImage && { images: [{ url: ogImage, width: 800, height: 800, alt: metaTitle }] }),
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [resolved, seo, settingsRes] = await Promise.all([
    resolveProduct(id),
    getSeoSettings(),
    supabase.from("settings").select("shipping_free_threshold, product_badge_1_text, product_badge_1_active, product_badge_2_text, product_badge_2_active, product_badge_3_text, product_badge_3_active").limit(1).maybeSingle(),
  ]);

  if (!resolved) notFound();
  const { product, resolvedBy } = resolved;

  // Redirect legacy UUID URLs to canonical slug URL (permanent)
  if (resolvedBy === "id" && product.slug && product.slug !== id) {
    redirect(`/product/${product.slug}`);
  }

  const [relatedRes, variantsRes, productImagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("status", "active").neq("id", product.id).limit(4),
    supabase.from("product_variants").select("*").eq("product_id", product.id).eq("available", true).order("label"),
    supabase.from("product_images").select("image_url, is_primary, display_order").eq("product_id", product.id).order("display_order"),
  ]);

  // Resolve primary image: normalized product_images first, then legacy fallback
  const normalizedImages = (productImagesRes.data ?? []) as { image_url: string; is_primary: boolean; display_order: number }[];
  const primaryNormalized = normalizedImages.find((i) => i.is_primary) ?? normalizedImages[0] ?? null;
  const primaryImageUrl = primaryNormalized?.image_url ?? product.image_url ?? "/product-placeholder.svg";

  // Use product_variants if available, fall back to legacy JSONB variants
  const storeVariants: StoreVariant[] = variantsRes.data && variantsRes.data.length > 0
    ? (variantsRes.data as StoreVariant[])
    : (product.variants ?? []).map((v) => ({
        id: v.id,
        product_id: product.id,
        provider: "printful",
        printful_variant_id: v.id,
        label: v.label,
        color: v.color ?? null,
        size: v.size ?? null,
        retail_price: v.price ?? product.price,
        image_url: v.image_url ?? null,
        available: true,
      }));

  const freeShippingThreshold: number = settingsRes.data?.shipping_free_threshold ?? 75;
  const productBadges = [
    { text: settingsRes.data?.product_badge_1_text ?? "Free shipping on orders over $75", active: settingsRes.data?.product_badge_1_active !== false },
    { text: settingsRes.data?.product_badge_2_text ?? "Print on demand - made fresh for you", active: settingsRes.data?.product_badge_2_active !== false },
    { text: settingsRes.data?.product_badge_3_text ?? "Premium quality guarantee", active: settingsRes.data?.product_badge_3_active !== false },
  ];
  const base = (seo?.site_url || "https://your-store.example").replace(/\/$/, "");
  const canonicalSlug = product.slug || product.id;

  const jsonLd = seo?.jsonld_enabled ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || undefined,
    image: getPrimaryImage(product),
    url: `${base}/product/${canonicalSlug}`,
    offers: {
      "@type": "Offer",
      price: product.price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${base}/product/${canonicalSlug}`,
    },
  } : null;

  return (
    <StorefrontLayout>
      {jsonLd && (
        <Script id="product-jsonld" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(jsonLd)}
        </Script>
      )}
      <ProductDetailClient product={product} variants={storeVariants} related={(relatedRes.data || []) as Product[]} freeShippingThreshold={freeShippingThreshold} productBadges={productBadges} primaryImageUrl={primaryImageUrl} normalizedImages={normalizedImages} />
    </StorefrontLayout>
  );
}
