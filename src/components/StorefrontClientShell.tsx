"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import CartDrawer from "@/components/CartDrawer";
import NewsletterPopup from "@/components/NewsletterPopup";
import { supabase } from "@/lib/supabase";

const AFFILIATE_KEY = "affiliate_ref";
const AFFILIATE_TTL = 30 * 24 * 60 * 60 * 1000;

function AffiliateTracker() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const code = searchParams.get("ref");
    if (!code) return;
    localStorage.setItem(AFFILIATE_KEY, JSON.stringify({ code, expires: Date.now() + AFFILIATE_TTL }));
    supabase.from("affiliate_clicks").insert({
      code,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    }).then();
  }, [searchParams]);
  return null;
}

export default function StorefrontClientShell() {
  return (
    <>
      <CartDrawer />
      <NewsletterPopup />
      <Suspense fallback={null}><AffiliateTracker /></Suspense>
    </>
  );
}
