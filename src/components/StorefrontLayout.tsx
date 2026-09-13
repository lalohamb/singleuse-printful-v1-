"use client";
import type { ReactNode } from "react";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import NewsletterPopup from "@/components/NewsletterPopup";
import { supabase } from "@/lib/supabase";

const AFFILIATE_KEY = "affiliate_ref";
const AFFILIATE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function AffiliateTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("ref");
    if (!code) return;

    // Store with expiry
    localStorage.setItem(AFFILIATE_KEY, JSON.stringify({ code, expires: Date.now() + AFFILIATE_TTL }));

    // Log click (fire and forget)
    supabase.from("affiliate_clicks").insert({
      code,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    }).then();
  }, [searchParams]);

  return null;
}

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
      <NewsletterPopup />
      <Suspense fallback={null}><AffiliateTracker /></Suspense>
    </div>
  );
}
