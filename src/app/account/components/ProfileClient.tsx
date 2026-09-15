"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import { getCustomerProfile } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { upsertCustomerProfile } from "@/lib/customer-profile-sync";
import { supabase } from "@/lib/supabase";

export function ProfileClient() {
  const { user, loading, refresh } = useCustomerAuth();
  const profile = getCustomerProfile(user);
  const [form, setForm] = useState({ username: profile.username, fullName: profile.fullName, phone: profile.phone, newsletterOptIn: profile.newsletterOptIn });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setForm({ username: profile.username, fullName: profile.fullName, phone: profile.phone, newsletterOptIn: profile.newsletterOptIn });
  }, [profile.fullName, profile.newsletterOptIn, profile.phone, profile.username]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading profile...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired title="Sign in to edit your profile" /></AccountShell>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        username: form.username,
        full_name: form.fullName,
        phone: form.phone,
        newsletter_opt_in: form.newsletterOptIn,
      },
    });
    if (error) { setStatus("error"); return; }
    await upsertCustomerProfile(data.user);
    await refresh();
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <AccountShell>
      <form onSubmit={save} className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Profile</h1>
          <p className="text-secondary-500 mt-1">Manage your display name, phone, and email preferences.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Username</label>
            <input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-text">Phone</label>
            <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} className="input-field" />
          </div>
        </div>
        <div>
          <label className="label-text">Full name</label>
          <input value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="label-text">Email</label>
          <input value={profile.email} disabled className="input-field bg-secondary-50 text-secondary-500" />
          <p className="text-xs text-secondary-400 mt-1">Email changes should go through the secure auth flow.</p>
        </div>
        <label className="flex items-center gap-3 text-sm text-secondary-600">
          <input type="checkbox" checked={form.newsletterOptIn} onChange={(event) => setForm((prev) => ({ ...prev, newsletterOptIn: event.target.checked }))} className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500" />
          Send me new drops, order updates, and exclusive offers.
        </label>
        <button disabled={status === "saving"} className="btn-primary">
          {status === "saving" ? <><Loader2 size={18} className="mr-2 animate-spin" />Saving...</> : status === "saved" ? <><Check size={18} className="mr-2" />Saved</> : "Save profile"}
        </button>
        {status === "error" && <p className="text-sm text-error-600">Could not save profile. Please try again.</p>}
      </form>
    </AccountShell>
  );
}
