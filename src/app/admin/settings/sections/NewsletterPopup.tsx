"use client";
import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import ProductImagePicker from "../ProductImagePicker";
import { useSettings } from "./useSettings";
import { supabase } from "@/lib/supabase";
import AppImage from "@/components/AppImage";

type PopupSettings = {
  active?: boolean;
  title?: string;
  delay?: number;
  dismissDays?: number;
  body?: string;
  ctaLabel?: string;
  groupId?: string;
  position?: string;
  bgColor?: string;
  imageUrl?: string;
  imgX?: number;
  imgY?: number;
  popupPreviewH?: number;
  popupImageFit?: string;
  popupImageScale?: number;
  popupImageFlip?: boolean;
};

export default function NewsletterPopup() {
  const { form, set, error } = useSettings();
  const [saved, setSaved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/mailerlite?action=groups").then(async (r) => {
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data)) setGroups(data);
    }).catch(() => {});
  }, []);

  const ps = (form.popup_settings || {}) as PopupSettings;
  const setPop = (updates: Partial<PopupSettings>) => set("popup_settings", { ...ps, ...updates });

  const handleSave = async () => {
    const { error: err } = await supabase.from("settings").update({ popup_settings: form.popup_settings, updated_at: new Date().toISOString() }).eq("id", form.id);
    if (!err) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/"] }) });
    }
  };

  const x = ps.imgX ?? 0;
  const y = ps.imgY ?? 0;
  const setPos = (nx: number, ny: number) => setPop({ imgX: nx, imgY: ny });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-secondary-400">Appears on page load after a delay. User can dismiss.</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ps.active || false} onChange={(e) => setPop({ active: e.target.checked })} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
          <span className="text-sm font-medium text-secondary-700">Active</span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label-text">Headline</label><input value={ps.title || ""} onChange={(e) => setPop({ title: e.target.value })} placeholder="Join the Culture" className="input-field" /></div>
        <div><label className="label-text">Delay (seconds)</label><input type="number" min={0} max={60} value={ps.delay ?? 3} onChange={(e) => setPop({ delay: Number(e.target.value) })} className="input-field" /></div>
        <div><label className="label-text">Dismiss for (days)</label><input type="number" min={1} max={365} value={ps.dismissDays ?? 7} onChange={(e) => setPop({ dismissDays: Number(e.target.value) })} className="input-field" /></div>
      </div>
      <div><label className="label-text">Body Text</label><input value={ps.body || ""} onChange={(e) => setPop({ body: e.target.value })} placeholder="New drops, exclusive offers, and culture — straight to your inbox." className="input-field" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label-text">Button Label</label><input value={ps.ctaLabel || ""} onChange={(e) => setPop({ ctaLabel: e.target.value })} placeholder="Subscribe" className="input-field" /></div>
        <div>
          <label className="label-text">MailerLite Group</label>
          <select value={ps.groupId || ""} onChange={(e) => setPop({ groupId: e.target.value })} className="input-field">
            <option value="">{groups.length === 0 ? "No groups found" : "All subscribers"}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-text">Position</label>
          <select value={ps.position || "right"} onChange={(e) => setPop({ position: e.target.value })} className="input-field">
            {["center","bottom-left","bottom-center","bottom-right","top-left","top-center","top-right","left","right"].map((v) => (
              <option key={v} value={v}>{v.replace(/-/g," ").replace(/\b\w/g,(c) => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <label className="label-text">Background Color<input type="color" value={ps.bgColor || "#111111"} onChange={(e) => setPop({ bgColor: e.target.value })} className="mt-1 h-10 w-full cursor-pointer" /></label>
        <div className="rounded-lg p-3 text-center" style={{ backgroundColor: ps.bgColor || "#111111" }}>
          <p className="text-white font-bold text-xs truncate">{ps.title || "Headline"}</p>
          <p className="text-white/60 text-[10px] mt-0.5 truncate">{ps.body || "Body text"}</p>
        </div>
      </div>
      <ImageUpload label="Popup Image" value={ps.imageUrl ?? "/hero-placeholder.svg"} onChange={(url) => setPop({ imageUrl: url })} folder="settings/popup" preview={false} />
      <button type="button" onClick={() => setShowPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
      {showPicker && <ProductImagePicker onSelect={(url) => { setPop({ imageUrl: url }); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}

      {/* Image controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-16">X: {x}px</span>
          <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" />
        </div>
        {(ps.imageUrl ?? "/hero-placeholder.svg") && (
          <div className="flex gap-2 items-stretch">
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
              <span className="text-[10px] text-secondary-400">▲</span>
              <input type="range" min={30} max={100} value={ps.popupPreviewH ?? 60} onChange={(e) => setPop({ popupPreviewH: Number(e.target.value) })} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
              <span className="text-[10px] text-secondary-400">▼</span>
              <span className="text-[10px] text-secondary-500 mt-1">{ps.popupPreviewH ?? 60}vh</span>
            </div>
            <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: Math.max(200, (ps.popupPreviewH ?? 60) * 3) }}>
              <AppImage fill src={ps.imageUrl || "/hero-placeholder.svg"} alt="Popup preview" className={`absolute inset-0 w-full h-full ${ps.popupImageFit === "contain" ? "object-contain" : (ps.popupImageScale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: `${x}px ${y}px`, transform: ps.popupImageFlip ? "scaleX(-1)" : undefined, scale: `${ps.popupImageScale ?? 100}%` }} />
              <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
            </div>
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
              <span className="text-[10px] text-secondary-400">▲</span>
              <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
              <span className="text-[10px] text-secondary-400">▼</span>
              <span className="text-[10px] text-secondary-500 mt-1">{y}px</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-24">Zoom: {ps.popupImageScale ?? 100}%</span>
          <input type="range" min={10} max={100} value={ps.popupImageScale ?? 100} onChange={(e) => setPop({ popupImageScale: Number(e.target.value) })} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex items-center gap-2">
          {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => setPop({ popupImageFit: v })} className={`text-xs px-3 py-1 rounded border capitalize ${(ps.popupImageFit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
          <button type="button" onClick={() => setPop({ popupImageFlip: !ps.popupImageFlip })} className={`text-xs px-3 py-1 rounded border ${ps.popupImageFlip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>Flip</button>
          <button type="button" onClick={() => setPop({ imgX: 0, imgY: 0, popupImageScale: 100, popupImageFlip: false, popupImageFit: "cover", popupPreviewH: 60 })} className="btn-outline py-1 text-xs">Reset</button>
        </div>
      </div>

      <div className="flex justify-end items-center gap-3 pt-2 border-t border-secondary-100">
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Popup</>}
        </button>
      </div>
    </div>
  );
}
