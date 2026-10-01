"use client";
import { ExternalLink } from "lucide-react";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

const SOCIALS = [
  ["instagram", "Instagram", "https://instagram.com/yourhandle"],
  ["tiktok",    "TikTok",    "https://tiktok.com/@yourhandle"],
  ["facebook",  "Facebook",  "https://facebook.com/yourpage"],
  ["youtube",   "YouTube",   "https://youtube.com/@yourchannel"],
  ["pinterest", "Pinterest", "https://pinterest.com/yourprofile"],
  ["snapchat",  "Snapchat",  "https://snapchat.com/add/yourhandle"],
  ["threads",   "Threads",   "https://threads.net/@yourhandle"],
  ["email",     "Email",     "mailto:hello@yourdomain.com"],
] as const;

export default function Social() {
  const { form, set, save, saved, error } = useSettings();

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <p className="text-sm text-secondary-500">Toggle and update the social links shown in the footer. Disabled icons are hidden from visitors.</p>
      <div className="space-y-3">
        {SOCIALS.map(([key, label, placeholder]) => {
          const val = form.social_links?.[key] || { url: "", enabled: false };
          return (
            <div key={key}>
              <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                <button type="button" onClick={() => set("social_links", { ...form.social_links, [key]: { ...val, enabled: !val.enabled } })} className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${val.enabled ? "bg-primary-500" : "bg-secondary-200"}`} aria-label={`Toggle ${label}`}>
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className={`text-sm font-medium w-20 flex-shrink-0 ${val.enabled ? "text-secondary-900" : "text-secondary-400"}`}>{label}</span>
                <input value={val.url || ""} onChange={(e) => set("social_links", { ...form.social_links, [key]: { ...val, url: e.target.value } })} placeholder={placeholder} disabled={!val.enabled} className="input-field flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed" />
                {val.url && val.enabled && (
                  <a href={val.url} target="_blank" rel="noreferrer" className="text-secondary-400 hover:text-primary-500 flex-shrink-0" title="Preview link"><ExternalLink size={16} /></a>
                )}
              </div>
              {key === "email" && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-secondary-700 space-y-1.5">
                  <p className="font-semibold text-secondary-900">📧 Domain email required</p>
                  <p>This address must come from a <strong>verified custom domain</strong> — e.g. <code className="bg-white px-1 rounded text-xs">orders@yourdomain.com</code>. Free addresses are rejected by MailerLite, Resend, and Printful.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <SaveBar onSave={() => save({ social_links: form.social_links })} saved={saved} error={error} label="Save Social Links" />
    </div>
  );
}
