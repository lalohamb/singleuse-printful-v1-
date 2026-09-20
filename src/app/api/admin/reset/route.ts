import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const serviceSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

async function deleteAll(sb: ReturnType<typeof serviceSupabase>, table: string) {
  // Use gt id filter — works for both uuid and text PKs to satisfy the "must have a filter" requirement
  const { error } = await sb.from(table).delete().gte("created_at", "1970-01-01");
  if (error) throw new Error(`Delete ${table}: ${error.message}`);
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  let type: string;
  try {
    ({ type } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (type !== "soft" && type !== "full") {
    return NextResponse.json({ error: "Invalid reset type" }, { status: 400 });
  }

  const sb = serviceSupabase();

  try {
    if (type === "soft") {
      await deleteAll(sb, "orders");
      await deleteAll(sb, "products");
      await deleteAll(sb, "email_events");
      const { error } = await sb.from("settings").update({
        printify_connected: false,
        printify_shop_id: null,
        stripe_connected: false,
        updated_at: new Date().toISOString(),
      }).gte("updated_at", "1970-01-01");
      if (error) throw new Error(`Update settings: ${error.message}`);
    }

    if (type === "full") {
      await deleteAll(sb, "orders");
      await deleteAll(sb, "email_events");
      await deleteAll(sb, "products");
      await deleteAll(sb, "categories");

      // Blank policy content (policies use text PK, no created_at — update all)
      const { error: polErr } = await sb.from("policies").update({ content: "", updated_at: new Date().toISOString() }).in("id", ["terms", "privacy", "refund"]);
      if (polErr) throw new Error(`Update policies: ${polErr.message}`);

      // Re-seed categories
      const { error: catErr } = await sb.from("categories").upsert([
        { name: "T-Shirts",    slug: "t-shirts",    description: "Premium tees with culturally inspired designs" },
        { name: "Hoodies",     slug: "hoodies",     description: "Comfortable hoodies for every season" },
        { name: "Hats",        slug: "hats",        description: "Caps and headwear to complete your look" },
        { name: "Sweatpants",  slug: "sweatpants",  description: "Matching bottoms for your streetwear sets" },
        { name: "Accessories", slug: "accessories", description: "Tote bags, stickers, and more" },
      ], { onConflict: "slug" });
      if (catErr) throw new Error(`Upsert categories: ${catErr.message}`);

      // Reset settings — delete all rows and re-insert one clean row
      await sb.from("settings").delete().gte("updated_at", "1970-01-01");
      const { error: setErr } = await sb.from("settings").insert({
        store_name: "Your Store",
        tagline: "Made for Every Body.",
        hero_title: "Wear What You Love.",
        hero_subtitle: "Inclusive, made-to-order apparel. Every design printed fresh and shipped to your door.",
        hero_image_url: "https://images.pexels.com/photos/5693889/pexels-photo-5693889.jpeg?auto=compress&cs=tinysrgb&w=1920",
        hero_object_position: "0px 0px",
        hero_height_vh: 80,
        hero_image_flip: false,
        hero_image_scale: 1,
        hero_gradient_opacity: 0.4,
        hero_gradient_dir: "to right",
        hero_image_fit: "cover",
        story_image_url: null,
        story_object_position: "0px -437px",
        story_image_scale: 100,
        story_image_flip: false,
        story_image_fit: "cover",
        story_gradient_opacity: 40,
        story_gradient_dir: "full",
        logo_url: "/store-logo-placeholder.svg",
        logo_size: 40,
        footer_text: "Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.",
        footer_bottom_message: "Made to order. Made with love.",
        footer_logo_url: null,
        footer_logo_size: 40,
        about_settings: null,
        affirmations_settings: null,
        new_arrivals_settings: null,
        brand_values_settings: null,
        feature_strip_settings: null,
        favicon_url: null,
        our_why_image_url: null,
        our_why_object_position: "0px 0px",
        our_why_height_vh: 60,
        our_why_label: "Our Why",
        our_why_quote: "Fashion should feel like freedom.",
        our_why_body: "We started Your Store because we believe clothing should celebrate who you are — not define it. Every piece is made to order, printed with intention, and shipped with love.",
        our_why_image_scale: 1,
        our_why_image_flip: false,
        our_why_image_fit: "cover",
        our_why_gradient_opacity: 0.4,
        our_why_gradient_dir: "to right",
        announcement: "Made to order. Made with love. — Free shipping on orders over $75",
        announcement_active: true,
        orders_paused: false,
        shipping_free_threshold: 75,
        default_shipping_cost: 6.99,
        printify_connected: false,
        printify_shop_id: null,
        stripe_connected: false,
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
        social_links: {
          instagram: { url: "https://instagram.com/yourstore", enabled: true },
          tiktok:    { url: "https://tiktok.com/@yourstore",    enabled: true },
          facebook:  { url: "https://facebook.com/yourstore",   enabled: true },
          youtube:   { url: "https://youtube.com/@yourstore",   enabled: true },
          pinterest: { url: "https://pinterest.com/yourstore",  enabled: true },
          snapchat:  { url: "https://snapchat.com/add/yourstore", enabled: true },
          threads:   { url: "https://threads.net/@yourstore",   enabled: true },
          email:     { url: "mailto:hello@your-store.example",   enabled: true },
        },
        updated_at: new Date().toISOString(),
      });
      if (setErr) throw new Error(`Insert settings: ${setErr.message}`);

      // Reset SEO settings
      const { error: seoErr } = await sb.from("seo_settings").update({
        site_url: "https://your-store.example",
        default_og_image: null,
        sitemap_enabled: true,
        robots_noindex_admin: true,
        jsonld_enabled: true,
        canonical_enabled: true,
        meta_title_suffix: "| Your Store",
        twitter_handle: "@yourstore",
        google_site_verification: null,
        updated_at: new Date().toISOString(),
      }).eq("id", "00000000-0000-0000-0000-000000000001");
      if (seoErr) throw new Error(`Update seo_settings: ${seoErr.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
