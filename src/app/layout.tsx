import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: "no-store" }) } }
);

export async function generateMetadata(): Promise<Metadata> {
  const [{ data: seo }, { data: settings }] = await Promise.all([
    supabase.from("seo_settings").select("google_site_verification, twitter_handle").limit(1).maybeSingle(),
    supabase.from("settings").select("favicon_url").limit(1).maybeSingle(),
  ]);
  return {
    title: { default: "Gender Apparel", template: "%s | Gender Apparel" },
    description: "Made-to-order apparel designed for every body, every style, and every day.",
    openGraph: { siteName: "Gender Apparel", type: "website" },
    ...(seo?.twitter_handle && { twitter: { card: "summary_large_image", site: seo.twitter_handle } }),
    ...(seo?.google_site_verification && { verification: { google: seo.google_site_verification } }),
    ...(settings?.favicon_url && { icons: { icon: "/api/favicon", shortcut: "/api/favicon" } }),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
