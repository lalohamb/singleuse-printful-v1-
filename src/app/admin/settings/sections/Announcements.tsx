"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Save } from "lucide-react";
import { useSettings } from "./useSettings";
import { supabase } from "@/lib/supabase";

const PROMO_EMOJIS = [
  { label: "Business", icons: ["✨","💎","⭐","🏆","✅","💯","🛍️","🛒","🎁","🏷️","💸","🔥","⚡","📦","🚚","🧵","♻️","🛡️","💬","📩"] },
  { label: "Hype",  icons: ["🔥","⚡","💥","🚨","🎯","💎","👑","🏆","✨","💫"] },
  { label: "Sale",  icons: ["🛍️","🎁","💸","💰","🤑","📦","🏷️","🎉","🎊","🥳"] },
  { label: "Style", icons: ["👕","👗","🧥","👟","🧢","💍","🕶️","👜","🧣","🧤"] },
  { label: "Vibes", icons: ["😍","🥰","😎","🤩","💯","🙌","👏","🫶","❤️","🖤"] },
];

export default function Announcements() {
  const { form, set, error } = useSettings();
  const [saved, setSaved] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const promoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/mailerlite?action=groups").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data)) setGroups(data);
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    const { error: err } = await supabase.from("settings").update({
      announcement: form.announcement,
      announcement_active: form.announcement_active,
      promo_banner_active: form.promo_banner_active,
      promo_banner_title: form.promo_banner_title,
      promo_banner_body: form.promo_banner_body,
      promo_banner_cta_label: form.promo_banner_cta_label,
      promo_banner_cta_url: form.promo_banner_cta_url,
      promo_banner_bg_color: form.promo_banner_bg_color,
      promo_banner_max_shows: form.promo_banner_max_shows,
      newsletter_group_id: form.newsletter_group_id,
      updated_at: new Date().toISOString(),
    }).eq("id", form.id);
    if (!err) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  };

  const insertEmoji = (emoji: string) => {
    const el = promoRef.current;
    const current = form.promo_banner_title || "";
    if (!el) { set("promo_banner_title", current + emoji); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    set("promo_banner_title", current.slice(0, start) + emoji + current.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="label-text">Announcement Text</label>
        <input value={form.announcement || ""} onChange={(e) => set("announcement", e.target.value)} placeholder="Free shipping on orders over $75!" className="input-field" />
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={form.announcement_active || false} onChange={(e) => set("announcement_active", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
        <span className="text-sm font-medium text-secondary-700">Show announcement bar</span>
      </label>
      <div>
        <label className="label-text">Newsletter Signup Group</label>
        <p className="text-xs text-secondary-400 mb-1">Used by the homepage &amp; footer signup forms.</p>
        {groups.length > 0 ? (
          <select value={form.newsletter_group_id || ""} onChange={(e) => set("newsletter_group_id", e.target.value)} className="input-field">
            <option value="">All subscribers (no group)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        ) : (
          <input value={form.newsletter_group_id || ""} onChange={(e) => set("newsletter_group_id", e.target.value)} placeholder="182701481182365511" className="input-field" />
        )}
      </div>

      <div className="border-t border-secondary-100 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-secondary-800">Promotional Drop Banner</p>
            <p className="text-xs text-secondary-400 mt-0.5">Drops from the top on homepage load. User can dismiss.</p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="label-text">Max shows per session</label>
              <input type="number" min={1} max={10} value={form.promo_banner_max_shows ?? 2} onChange={(e) => set("promo_banner_max_shows", Number(e.target.value))} className="input-field w-20" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-5">
              <input type="checkbox" checked={form.promo_banner_active || false} onChange={(e) => set("promo_banner_active", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
              <span className="text-sm font-medium text-secondary-700">Active</span>
            </label>
          </div>
        </div>
        <div>
          <label className="label-text">Headline</label>
          <input ref={promoRef} value={form.promo_banner_title || ""} onChange={(e) => set("promo_banner_title", e.target.value)} placeholder="🔥 Limited Drop — 20% Off This Weekend Only" className="input-field" />
          <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary-500 hover:text-secondary-800">
            <span>😊</span><span>Add emoji</span><span className="text-secondary-400">{emojiOpen ? "▲" : "▼"}</span>
          </button>
          {emojiOpen && (
            <div className="mt-2 border border-secondary-200 rounded-xl p-3 bg-secondary-50 space-y-2">
              {PROMO_EMOJIS.map((g) => (
                <div key={g.label}>
                  <p className="text-[10px] font-semibold text-secondary-400 uppercase tracking-wide mb-1">{g.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.icons.map((e) => <button key={e} type="button" onClick={() => insertEmoji(e)} className="text-lg hover:scale-125 transition-transform leading-none p-0.5 rounded hover:bg-secondary-200">{e}</button>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="label-text">Body Text</label>
          <input value={form.promo_banner_body || ""} onChange={(e) => set("promo_banner_body", e.target.value)} placeholder="Use code CULTURE20 at checkout. Ends Sunday." className="input-field" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-text">CTA Button Label</label><input value={form.promo_banner_cta_label || ""} onChange={(e) => set("promo_banner_cta_label", e.target.value)} placeholder="Shop the Drop" className="input-field" /></div>
          <div><label className="label-text">CTA URL</label><input value={form.promo_banner_cta_url || ""} onChange={(e) => set("promo_banner_cta_url", e.target.value)} placeholder="/shop" className="input-field" /></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="label-text">Banner Background Color</label>
            <input type="color" value={form.promo_banner_bg_color || "#1a1a1a"} onChange={(e) => set("promo_banner_bg_color", e.target.value)} className="mt-1 h-10 w-full rounded border border-secondary-200 cursor-pointer" />
          </div>
          <div className="flex-shrink-0 rounded-lg overflow-hidden border border-secondary-100" style={{ backgroundColor: form.promo_banner_bg_color || "#1a1a1a", minWidth: 160, padding: "10px 16px" }}>
            <p className="text-white font-bold text-xs truncate">{form.promo_banner_title || "Headline preview"}</p>
            {form.promo_banner_body && <p className="text-white/70 text-[10px] mt-0.5 truncate">{form.promo_banner_body}</p>}
            {form.promo_banner_cta_label && <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full bg-white text-secondary-900 text-[10px] font-semibold">{form.promo_banner_cta_label}</span>}
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-3 pt-2 border-t border-secondary-100">
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Banners</>}
        </button>
      </div>
    </div>
  );
}
