import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import StorefrontLayout from "@/components/StorefrontLayout";
import HomeClient from "./HomeClient";
import type { Category, Product, StoreSettings } from "@/types";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const TEMPLATE_SETTINGS: StoreSettings = {
  id: "template",
  store_name: "Your Store",
  tagline: "Made for Every Body.",
  hero_title: "Wear What Feels Like You.",
  hero_subtitle: "Thoughtful apparel designed for every body, every style, and every day. Made to order and shipped to your door.",
  hero_image_url: "https://images.pexels.com/photos/5693889/pexels-photo-5693889.jpeg?auto=compress&cs=tinysrgb&w=1920",
  hero_object_position: "center",
  hero_height_vh: 80,
  hero_image_flip: false,
  hero_image_scale: 100,
  hero_gradient_opacity: 70,
  hero_gradient_dir: "left",
  hero_image_fit: "cover",
  story_image_url: null,
  story_object_position: "center",
  story_image_scale: 100,
  story_image_flip: false,
  story_image_fit: "cover",
  story_gradient_opacity: 40,
  story_gradient_dir: "full",
  logo_url: null,
  logo_size: 40,
  footer_text: "Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.",
  footer_bottom_message: "Made to order. Made with love.",
  footer_logo_url: null,
  footer_logo_size: 40,
  about_settings: null,
  affirmations_settings: null,
  new_arrivals_settings: null,
  brand_values_settings: null,
  favicon_url: null,
  promo_banner_active: false,
  promo_banner_title: null,
  promo_banner_body: null,
  promo_banner_cta_label: null,
  promo_banner_cta_url: null,
  promo_banner_bg_color: "#1a1a1a",
  testimonials: [
    { quote: "I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.", name: "Jasmine T.", location: "Atlanta, GA", product: "Culture First Tee" },
    { quote: "The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.", name: "Marcus W.", location: "Houston, TX", product: "Faith Over Fear Hoodie" },
    { quote: "Finally a brand that celebrates who we are. Every piece feels intentional and powerful.", name: "Aaliyah R.", location: "Chicago, IL", product: "Heritage Collection" },
  ],
  our_why_image_url: null,
  our_why_object_position: "center",
  our_why_height_vh: 60,
  our_why_label: "Our Why",
  our_why_quote: "We do not just sell clothes. We help you show up as yourself.",
  our_why_body: "Your store was created for people who want clothing that feels personal, expressive, and easy to live in. Every design is made with intention and every piece is printed to order.",
  our_why_image_scale: 100,
  our_why_image_flip: false,
  our_why_image_fit: "cover",
  our_why_gradient_opacity: 60,
  our_why_gradient_dir: "left",
  announcement: "Made to order. Made with intention. — Free shipping on orders over $75",
  announcement_active: true,
  orders_paused: false,
  shipping_free_threshold: 75,
  default_shipping_cost: 6.99,
  printful_connected: false,
  printful_store_id: null,
  stripe_connected: false,
  music_url: null,
  music_enabled: false,
  music_tracks: [],
  music_shuffle: false,
  video_enabled: false,
  video_tracks: [],
  social_links: {
    instagram: { url: "https://instagram.com/yourstore", enabled: true },
    tiktok: { url: "https://tiktok.com/@yourstore", enabled: true },
    facebook: { url: "https://facebook.com/yourstore", enabled: true },
    youtube: { url: "https://youtube.com/@yourstore", enabled: true },
    pinterest: { url: "https://pinterest.com/yourstore", enabled: true },
    snapchat: { url: "https://snapchat.com/add/yourstore", enabled: true },
    threads: { url: "https://threads.net/@yourstore", enabled: true },
    email: { url: "mailto:hello@your-store.example", enabled: true },
  },
  site_menu_settings: null,
  feature_strip_settings: null,
};

const TEMPLATE_CATEGORIES: Category[] = [
  { id: "template-tshirts", name: "T-Shirts", slug: "t-shirts", description: "Premium tees with culturally inspired designs", gradient_opacity: 60, gradient_dir: "bottom", category_image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80", created_at: new Date().toISOString() },
  { id: "template-hoodies", name: "Hoodies", slug: "hoodies", description: "Comfortable hoodies for every season", gradient_opacity: 60, gradient_dir: "bottom", category_image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80", created_at: new Date().toISOString() },
  { id: "template-hats", name: "Hats", slug: "hats", description: "Caps and headwear to complete your look", gradient_opacity: 60, gradient_dir: "bottom", category_image_url: "https://images.pexels.com/photos/1124465/pexels-photo-1124465.jpeg?auto=compress&cs=tinysrgb&w=900", created_at: new Date().toISOString() },
  { id: "template-sweatpants", name: "Sweatpants", slug: "sweatpants", description: "Matching bottoms for your streetwear sets", gradient_opacity: 60, gradient_dir: "bottom", category_image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80", created_at: new Date().toISOString() },
  { id: "template-accessories", name: "Accessories", slug: "accessories", description: "Tote bags, stickers, and more", gradient_opacity: 60, gradient_dir: "bottom", category_image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80", created_at: new Date().toISOString() },
];

const TEMPLATE_PRODUCTS: Product[] = [
  { id: "template-1", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Culture First Tee", description: "A bold everyday essential with a statement design rooted in heritage and confidence.", category_id: "template-tshirts", price: 4200, cost: 1800, image_url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80"], status: "active", featured: true, is_new_arrival: true, is_trending: true, is_bestseller: true, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-2", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Faith Over Fear Hoodie", description: "Soft heavyweight fleece with a message of resilience and intention.", category_id: "template-hoodies", price: 6800, cost: 2900, image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"], status: "active", featured: true, is_new_arrival: true, is_trending: true, is_bestseller: false, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-3", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Heritage Cap", description: "A clean, elevated cap with a confident silhouette and premium finish.", category_id: "template-hats", price: 3100, cost: 1200, image_url: "https://images.pexels.com/photos/1124465/pexels-photo-1124465.jpeg?auto=compress&cs=tinysrgb&w=900", images: ["https://images.pexels.com/photos/1124465/pexels-photo-1124465.jpeg?auto=compress&cs=tinysrgb&w=900"], status: "active", featured: true, is_new_arrival: false, is_trending: true, is_bestseller: false, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-4", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Streetwear Set", description: "A coordinated look designed for comfort, movement, and everyday impact.", category_id: "template-sweatpants", price: 7900, cost: 3400, image_url: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80"], status: "active", featured: true, is_new_arrival: true, is_trending: false, is_bestseller: true, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-5", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Culture Tote", description: "Carry your essentials in a statement piece made for daily movement.", category_id: "template-accessories", price: 2600, cost: 1000, image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80"], status: "active", featured: false, is_new_arrival: true, is_trending: false, is_bestseller: false, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-6", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Legacy Sweatshirt", description: "Warm, elevated, and built for layered everyday fits.", category_id: "template-hoodies", price: 6200, cost: 2600, image_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80"], status: "active", featured: false, is_new_arrival: true, is_trending: true, is_bestseller: false, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-7", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Purpose Tee", description: "A premium graphic tee that balances comfort with confidence.", category_id: "template-tshirts", price: 4000, cost: 1700, image_url: "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80"], status: "active", featured: false, is_new_arrival: false, is_trending: true, is_bestseller: false, is_on_sale: true, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: "template-8", printful_id: null, printful_catalog_id: null, slug: null, short_description: null, meta_title: null, meta_description: null, compare_at_price: null, brand: null, product_type: null, published_at: null, display_order: 0, title: "Heritage Crewneck", description: "Everyday warmth with a premium silhouette built to stand out.", category_id: "template-hoodies", price: 7100, cost: 3000, image_url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80", images: ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80"], status: "active", featured: false, is_new_arrival: false, is_trending: true, is_bestseller: false, is_on_sale: false, content_locked: false, is_personalizable: false, personalization_label: null, variants: [], shipping_info: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

// FIX-08: ISR — regenerate at most once per minute instead of on every request.
// Use /api/revalidate after admin saves to push changes immediately.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const [{ data: seo }, { data: settings }] = await Promise.all([
    supabase.from("seo_settings").select("default_og_image, site_url").limit(1).maybeSingle(),
    supabase.from("settings").select("store_name, tagline").limit(1).maybeSingle(),
  ]);
  const storeName = settings?.store_name || "Your Store";
  const tagline = settings?.tagline || "Made for Every Body";
  return {
    title: `${storeName} — ${tagline}`,
    description: "Wear what feels like you. Shop made-to-order apparel designed for every body, every style, and every day.",
    ...(seo?.default_og_image && { openGraph: { images: [{ url: seo.default_og_image }] } }),
  };
}

export default async function HomePage() {
  const [settingsRes, featuredRes, newArrivalsRes, trendingRes, categoriesRes, catImgRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1).maybeSingle(),
    supabase.from("products").select("*").eq("status", "active").eq("featured", true).limit(8),
    supabase.from("products").select("*").eq("status", "active").eq("is_new_arrival", true).order("created_at", { ascending: false }).limit(12),
    supabase.from("products").select("*").eq("status", "active").eq("is_trending", true).limit(12),
    supabase.from("categories").select("*").order("name"),
    supabase.from("products").select("category_id, image_url").eq("status", "active").not("image_url", "is", null).not("category_id", "is", null).limit(500),
  ]);

  const settings = settingsRes.data ?? TEMPLATE_SETTINGS;
  const categories = categoriesRes.data?.length ? categoriesRes.data : TEMPLATE_CATEGORIES;
  const featured = featuredRes.data?.length ? featuredRes.data : TEMPLATE_PRODUCTS.filter((p) => p.featured).slice(0, 4);
  const newArrivals = newArrivalsRes.data?.length ? newArrivalsRes.data : TEMPLATE_PRODUCTS.filter((p) => p.is_new_arrival).slice(0, 4);
  const trending = trendingRes.data?.length ? trendingRes.data : TEMPLATE_PRODUCTS.filter((p) => p.is_trending).slice(0, 4);

  // Representative image per category (first active product with an image).
  const categoryImages: Record<string, string> = {};
  for (const row of (catImgRes.data || []) as Array<{ category_id: string; image_url: string }>) {
    if (row.category_id && row.image_url && !categoryImages[row.category_id]) categoryImages[row.category_id] = row.image_url;
  }
  for (const category of categories) {
    if (category.category_image_url && !categoryImages[category.id]) categoryImages[category.id] = category.category_image_url;
  }

  return (
    <StorefrontLayout>
      <HomeClient
        settings={settings}
        featured={featured}
        newArrivals={newArrivals}
        trending={trending}
        categories={categories}
        categoryImages={categoryImages}
      />
    </StorefrontLayout>
  );
}
