"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Shirt } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import { getCustomerProfile } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { upsertCustomerProfile } from "@/lib/customer-profile-sync";
import { supabase } from "@/lib/supabase";

const sizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const categories = ["T-Shirts", "Hoodies", "Hats", "Sweatpants", "Accessories"];
const fits = ["Classic", "Relaxed", "Oversized", "Fitted"];

export function PreferencesClient() {
  const { user, loading, refresh } = useCustomerAuth();
  const profile = getCustomerProfile(user);
  const { favoriteCategory, fit, hoodieSize, personalizationText, preferredContact, smsTrackingOptIn, teeSize } = profile.preferences;
  const [form, setForm] = useState(profile.preferences);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setForm({ favoriteCategory, fit, hoodieSize, personalizationText, preferredContact, smsTrackingOptIn, teeSize });
  }, [favoriteCategory, fit, hoodieSize, personalizationText, preferredContact, smsTrackingOptIn, teeSize]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading preferences...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired title="Sign in to manage preferences" /></AccountShell>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const { data, error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, preferences: form } });
    if (error) { setStatus("error"); return; }
    await upsertCustomerProfile(data.user);
    await refresh();
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <AccountShell>
      <form onSubmit={save} className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6 space-y-6">
        <div>
          <div className="w-11 h-11 rounded-lg bg-secondary-900 text-gold-400 flex items-center justify-center mb-4">
            <Shirt size={23} />
          </div>
          <h1 className="text-2xl font-bold text-secondary-900">Preferences</h1>
          <p className="text-secondary-500 mt-1">Keep sizing and personalization defaults ready for future account features.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-text">Preferred tee size</label>
            <select value={form.teeSize} onChange={(event) => setForm((prev) => ({ ...prev, teeSize: event.target.value }))} className="input-field">
              {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Preferred hoodie size</label>
            <select value={form.hoodieSize} onChange={(event) => setForm((prev) => ({ ...prev, hoodieSize: event.target.value }))} className="input-field">
              {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Fit preference</label>
            <select value={form.fit} onChange={(event) => setForm((prev) => ({ ...prev, fit: event.target.value }))} className="input-field">
              {fits.map((fit) => <option key={fit} value={fit}>{fit}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Favorite category</label>
            <select value={form.favoriteCategory} onChange={(event) => setForm((prev) => ({ ...prev, favoriteCategory: event.target.value }))} className="input-field">
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div>
            <label className="label-text">Preferred contact</label>
            <select value={form.preferredContact} onChange={(event) => setForm((prev) => ({ ...prev, preferredContact: event.target.value as "email" | "sms" }))} className="input-field">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-text">Default personalization text</label>
          <input value={form.personalizationText} onChange={(event) => setForm((prev) => ({ ...prev, personalizationText: event.target.value }))} className="input-field" />
        </div>

        <label className="flex items-center gap-3 text-sm text-secondary-600">
          <input type="checkbox" checked={form.smsTrackingOptIn} onChange={(event) => setForm((prev) => ({ ...prev, smsTrackingOptIn: event.target.checked }))} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
          Send shipping updates by SMS when available.
        </label>

        <button disabled={status === "saving"} className="btn-primary">
          {status === "saving" ? <><Loader2 size={18} className="mr-2 animate-spin" />Saving...</> : status === "saved" ? <><Check size={18} className="mr-2" />Saved</> : "Save preferences"}
        </button>
        {status === "error" && <p className="text-sm text-error-600">Could not save preferences. Please try again.</p>}
      </form>
    </AccountShell>
  );
}
