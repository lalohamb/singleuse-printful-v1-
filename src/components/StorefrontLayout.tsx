import type { ReactNode } from "react";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StorefrontClientShell from "@/components/StorefrontClientShell";
import AffiliateTracker from "@/components/AffiliateTracker";
import { CustomerAuthProvider } from "@/lib/customer-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const { data } = await supabase
    .from("settings")
    .select("logo_url, logo_size")
    .limit(1)
    .maybeSingle();

  const initialLogo = {
    url: (data?.logo_url as string | null) ?? null,
    size: (data?.logo_size as number | null) ?? 40,
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <CustomerAuthProvider>
        <Suspense fallback={null}><AffiliateTracker /></Suspense>
        <Header initialLogo={initialLogo} />
        <main className="flex-1">{children}</main>
        <StorefrontClientShell />
      </CustomerAuthProvider>
      <Footer />
    </div>
  );
}
