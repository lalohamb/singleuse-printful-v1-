"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { setAffiliateCode, getAffiliateCode } from "@/lib/affiliate-utils";

export default function AffiliateTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (!ref) return;
    setAffiliateCode(ref);
    // Log click server-side (fire and forget)
    fetch("/api/affiliates/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref, referrer: document.referrer, user_agent: navigator.userAgent }),
    }).catch(() => {});
  }, [searchParams]);

  // Also pass code into checkout via supabase.ts createStripeCheckout
  useEffect(() => {
    const code = getAffiliateCode();
    if (code) {
      (window as any).__affiliateCode = code;
    }
  }, []);

  return null;
}
