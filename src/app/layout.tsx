import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await supabase.from("seo_settings").select("google_site_verification, twitter_handle").limit(1).maybeSingle();
  return {
    title: { default: "Body & Sleeves", template: "%s | Body & Sleeves" },
    description: "A Black-owned, made-to-order apparel brand celebrating the richness of Black culture, faith, and family. Empower yourself. Empower the Culture.",
    openGraph: { siteName: "Body & Sleeves", type: "website" },
    ...(data?.twitter_handle && { twitter: { card: "summary_large_image", site: data.twitter_handle } }),
    ...(data?.google_site_verification && { verification: { google: data.google_site_verification } }),
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
