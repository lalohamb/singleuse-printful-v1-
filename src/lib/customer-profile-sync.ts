"use client";

import type { User } from "@supabase/supabase-js";
import { getCustomerProfile } from "@/lib/account-data";
import { supabase } from "@/lib/supabase";

export async function upsertCustomerProfile(user: User | null) {
  if (!user?.id || !user.email) return;

  const profile = getCustomerProfile(user);
  const now = new Date().toISOString();
  const { error } = await supabase.from("customer_profiles").upsert({
    id: user.id,
    email: profile.email,
    username: profile.username,
    full_name: profile.fullName,
    phone: profile.phone,
    newsletter_opt_in: profile.newsletterOptIn,
    address: profile.address,
    preferences: profile.preferences,
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: "id" });

  if (error) {
    console.warn("Customer profile sync skipped:", error.message);
  }
}
