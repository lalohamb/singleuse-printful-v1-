import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { data } = await supabase
    .from("seo_settings")
    .select("site_url")
    .limit(1)
    .maybeSingle();

  const base = (data?.site_url || "https://your-store.example").replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/checkout/", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
