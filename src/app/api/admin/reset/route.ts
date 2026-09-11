import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const serviceSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(req: NextRequest) {
  const { type } = await req.json();
  if (type !== "soft" && type !== "full") {
    return NextResponse.json({ error: "Invalid reset type" }, { status: 400 });
  }

  const sb = serviceSupabase();

  try {
    if (type === "soft") {
      // Clear orders, products, email_events. Reset connection flags only.
      await sb.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("email_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("settings").update({
        printify_connected: false,
        printify_shop_id: null,
        stripe_connected: false,
        updated_at: new Date().toISOString(),
      }).neq("id", "00000000-0000-0000-0000-000000000000");
    }

    if (type === "full") {
      // Clear all transactional + content data, restore defaults
      await sb.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("email_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("policies").update({ content: "", updated_at: new Date().toISOString() }).neq("id", "");

      // Re-seed categories
      await sb.from("categories").upsert([
        { name: "T-Shirts",    slug: "t-shirts",    description: "Premium tees with culturally inspired designs" },
        { name: "Hoodies",     slug: "hoodies",     description: "Comfortable hoodies for every season" },
        { name: "Hats",        slug: "hats",        description: "Caps and headwear to complete your look" },
        { name: "Sweatpants",  slug: "sweatpants",  description: "Matching bottoms for your streetwear sets" },
        { name: "Accessories", slug: "accessories", description: "Tote bags, stickers, and more" },
      ], { onConflict: "slug" });

      // Reset settings to defaults
      await sb.from("settings").update({
        store_name: "Body & Sleeves",
        tagline: "Black-Owned. Made to Order.",
        hero_title: "Empower Yourself. Empower the Culture.",
        hero_subtitle: "Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door.",
        hero_image_url: "https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
        hero_object_position: "0px 0px",
        hero_height_vh: 80,
        hero_image_flip: false,
        hero_image_scale: 1,
        hero_gradient_opacity: 0.4,
        hero_gradient_dir: "to right",
        hero_image_fit: "cover",
        story_image_url: null,
        story_object_position: "0px 0px",
        story_image_scale: 100,
        story_image_flip: false,
        story_image_fit: "cover",
        story_gradient_opacity: 40,
        story_gradient_dir: "full",
        logo_url: null,
        logo_size: 40,
        favicon_url: null,
        our_why_image_url: null,
        our_why_object_position: "0px 0px",
        our_why_height_vh: 60,
        our_why_label: null,
        our_why_quote: null,
        our_why_body: null,
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
          instagram: { url: "https://instagram.com/body_and_sleeves", enabled: true },
          tiktok:    { url: "https://tiktok.com/@bodyandsleeves",      enabled: true },
          facebook:  { url: "https://facebook.com/bodyandsleeves",     enabled: true },
          youtube:   { url: "https://youtube.com/@bodyandsleeves",     enabled: true },
          pinterest: { url: "https://pinterest.com/bodyandsleeves",    enabled: true },
          snapchat:  { url: "https://snapchat.com/add/bodyandsleeves", enabled: true },
          threads:   { url: "https://threads.net/@bodyandsleeves",     enabled: true },
          email:     { url: "mailto:Hello.BodyandSleeves@gmail.com",   enabled: true },
        },
        updated_at: new Date().toISOString(),
      }).neq("id", "00000000-0000-0000-0000-000000000000");

      // Reset SEO settings
      await sb.from("seo_settings").update({
        site_url: "https://bodyandsleeves.com",
        default_og_image: null,
        sitemap_enabled: true,
        robots_noindex_admin: true,
        jsonld_enabled: true,
        canonical_enabled: true,
        meta_title_suffix: "| Body & Sleeves",
        twitter_handle: "@body_and_sleeves",
        google_site_verification: null,
        updated_at: new Date().toISOString(),
      }).eq("id", "00000000-0000-0000-0000-000000000001");
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
