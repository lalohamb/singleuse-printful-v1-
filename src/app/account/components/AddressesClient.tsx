"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import { formatAddress, getCustomerProfile } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { upsertCustomerProfile } from "@/lib/customer-profile-sync";
import { supabase } from "@/lib/supabase";

export function AddressesClient() {
  const { user, loading, refresh } = useCustomerAuth();
  const profile = getCustomerProfile(user);
  const { name, line1, line2, city, state, zip, country } = profile.address;
  const [form, setForm] = useState(profile.address);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setForm({ name, line1, line2, city, state, zip, country });
  }, [city, country, line1, line2, name, state, zip]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading address...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired title="Sign in to manage saved addresses" /></AccountShell>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    const { data, error } = await supabase.auth.updateUser({ data: { ...user.user_metadata, address: form } });
    if (error) { setStatus("error"); return; }
    await upsertCustomerProfile(data.user);
    await refresh();
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1800);
  };

  return (
    <AccountShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={save} className="lg:col-span-2 bg-white border border-secondary-100 rounded-lg shadow-sm p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Default Address</h1>
            <p className="text-secondary-500 mt-1">Use this to prefill checkout and keep delivery details close.</p>
          </div>
          <div>
            <label className="label-text">Recipient name</label>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-text">Address line 1</label>
            <input value={form.line1} onChange={(event) => setForm((prev) => ({ ...prev, line1: event.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-text">Address line 2</label>
            <input value={form.line2 || ""} onChange={(event) => setForm((prev) => ({ ...prev, line2: event.target.value }))} className="input-field" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">City</label>
              <input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-text">State</label>
              <input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-text">ZIP</label>
              <input value={form.zip} onChange={(event) => setForm((prev) => ({ ...prev, zip: event.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-text">Country</label>
            <select value={form.country} onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))} className="input-field">
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </div>
          <button disabled={status === "saving"} className="btn-primary">
            {status === "saving" ? <><Loader2 size={18} className="mr-2 animate-spin" />Saving...</> : status === "saved" ? <><Check size={18} className="mr-2" />Saved</> : "Save address"}
          </button>
          {status === "error" && <p className="text-sm text-error-600">Could not save address. Please try again.</p>}
        </form>

        <aside className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6 self-start">
          <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4">
            <MapPin size={22} />
          </div>
          <h2 className="font-bold text-secondary-900">Saved Address Preview</h2>
          <p className="text-sm text-secondary-500 mt-2">{formatAddress(form)}</p>
          <p className="text-xs text-secondary-400 mt-4">Multiple saved addresses can be added later with a dedicated `customer_addresses` table.</p>
        </aside>
      </div>
    </AccountShell>
  );
}
