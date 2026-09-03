"use client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents);
}

export async function createStripeCheckout(payload: {
  items: Array<{
    product_id: string; title: string; price: number; image_url: string;
    quantity: number; variant_id: string; variant_label: string; printify_id: string | null;
  }>;
  shipping_address: { line1: string; line2?: string; city: string; state: string; zip: string; country: string };
  shipping_name: string; email: string; shipping_cost: number; subtotal: number; total: number;
}): Promise<{ url: string; session_id: string }> {
  const apiUrl = `${supabaseUrl}/functions/v1/stripe-checkout`;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseAnonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, origin: window.location.origin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Checkout failed" }));
    throw new Error(err.error || `Checkout failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.url) throw new Error("No checkout URL returned");
  return data;
}
