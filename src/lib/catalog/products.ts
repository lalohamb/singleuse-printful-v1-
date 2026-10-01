import { createClient } from "@supabase/supabase-js";
import type { CatalogProduct } from "./types";

// Server-side catalog queries use the anon key (RLS enforces visibility).
// Admin queries must use a client with a valid admin session.
function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
  );
}

const PRODUCT_FIELDS = [
  "id", "slug", "title", "short_description", "description",
  "category_id", "brand", "product_type",
  "price", "compare_at_price", "image_url", "images",
  "status", "published_at",
  "meta_title", "meta_description",
  "featured", "is_new_arrival", "is_trending", "is_bestseller",
  "is_on_sale", "is_personalizable", "personalization_label",
  "content_locked", "display_order", "printful_id", "printful_catalog_id", "catalog_source",
  "created_at", "updated_at",
].join(", ");

// Returns all active (published) products for the public storefront.
// RLS also enforces status = 'active' at the DB level.
export async function getPublishedProducts(): Promise<CatalogProduct[]> {
  const sb = getClient();
  const { data } = await sb
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("status", "active")
    .order("display_order", { ascending: true })
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as CatalogProduct[];
}

// Returns a single active product by slug.
export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const sb = getClient();
  const { data } = await sb
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return (data as CatalogProduct | null);
}

// Returns a single product by UUID — used for legacy /product/[id] redirect.
// Does NOT filter by status so the redirect can work for any product.
export async function getProductById(id: string): Promise<CatalogProduct | null> {
  const sb = getClient();
  const { data } = await sb
    .from("products")
    .select(PRODUCT_FIELDS)
    .eq("id", id)
    .maybeSingle();
  return (data as CatalogProduct | null);
}
