"use client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: {
      getItem: (key) => {
        if (typeof document === "undefined") return null;
        // Reassemble chunked cookies (sb-xxx-auth-token.0, .1, ...)
        const all = document.cookie.split("; ");
        const base = all.find((c) => c.startsWith(`${key}=`));
        if (base) return decodeURIComponent(base.split("=").slice(1).join("="));
        let chunks = "";
        for (let i = 0; ; i++) {
          const chunk = all.find((c) => c.startsWith(`${key}.${i}=`));
          if (!chunk) break;
          chunks += decodeURIComponent(chunk.split("=").slice(1).join("="));
        }
        return chunks || null;
      },
      setItem: (key, value) => {
        if (typeof document === "undefined") return;
        const secure = location.protocol === "https:" ? ";Secure" : "";
        document.cookie = `${key}=${encodeURIComponent(value)};path=/;max-age=604800;SameSite=Lax${secure}`;
      },
      removeItem: (key) => {
        if (typeof document === "undefined") return;
        document.cookie = `${key}=;path=/;max-age=0`;
      },
    },
  },
});

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

type ShippingProfile = {
  countries?: string[];
  first_item?: { cost?: number | string };
  additional_items?: { cost?: number | string };
};

type ShippingInfo = {
  profiles?: ShippingProfile[];
};

export async function getShippingQuote({
  country,
  items,
}: {
  country: string;
  items: Array<{ product_id: string; quantity: number }>;
}): Promise<number> {
  if (!items.length) return 6.99;

  // Fetch shipping_info for all products in the cart in one query
  const productIds = Array.from(new Set(items.map((i) => i.product_id)));
  const { data: products } = await supabase
    .from("products")
    .select("id, shipping_info")
    .in("id", productIds);

  if (!products?.length) return 6.99;

  const shippingMap = new Map<string, ShippingInfo>();
  for (const p of products) shippingMap.set(p.id, p.shipping_info as ShippingInfo);

  let total = 0;
  let covered = 0;

  for (const item of items) {
    const info = shippingMap.get(item.product_id);
    const profiles = info?.profiles;
    if (!profiles?.length) continue;

    // Find the profile that covers this country, fall back to "REST_OF_THE_WORLD"
    const profile =
      profiles.find((p) =>
        Array.isArray(p.countries) &&
        (p.countries.includes(country) || p.countries.includes("*"))
      ) ??
      profiles.find((p) =>
        Array.isArray(p.countries) && p.countries.includes("REST_OF_THE_WORLD")
      ) ??
      profiles[0];

    if (!profile) continue;

    const first = (Number(profile.first_item?.cost) || 0) / 100;
    const additional = (Number(profile.additional_items?.cost) || 0) / 100;
    total += first + (item.quantity - 1) * additional;
    covered++;
  }

  // If no products had shipping_info, fall back
  if (covered === 0) return 6.99;

  return Math.round(total * 100) / 100;
}
export async function createStripeCheckout(payload: {
  items: Array<{
    product_id: string;
    quantity: number;
    variant_id: string;
    personalization_text?: string;
  }>;
  shipping_address: { line1: string; line2?: string; city: string; state: string; zip: string; country: string };
  shipping_name: string;
  email: string;
}): Promise<{ url: string; session_id: string }> {
  const apiUrl = `${supabaseUrl}/functions/v1/stripe-checkout`;
  const affiliate_code = (window as any).__affiliateCode ?? null;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, origin: window.location.origin, ...(affiliate_code ? { affiliate_code } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Checkout failed" }));
    throw new Error(err.error || `Checkout failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.url) throw new Error("No checkout URL returned");
  return data;
}
