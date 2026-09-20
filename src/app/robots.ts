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
    .select("site_url, robots_noindex_admin")
    .limit(1)
    .maybeSingle();

  const base = (data?.site_url || "https://your-store.example").replace(/\/$/, "");
  const disallow = data?.robots_noindex_admin !== false
    ? ["/admin/", "/checkout/", "/api/"]
    : ["/checkout/", "/api/"];

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${base}/sitemap.xml`,
  };
}
