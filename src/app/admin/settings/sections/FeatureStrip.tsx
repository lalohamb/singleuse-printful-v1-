"use client";
import { useState, useEffect } from "react";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { DEFAULT_FEATURE_STRIP_SETTINGS, type FeatureStripItem, type FeatureStripSettings } from "@/lib/feature-strip-settings";

export default function FeatureStrip() {
  const { form, save, saved, error } = useSettings();
  const [s, setS] = useState<FeatureStripSettings>(DEFAULT_FEATURE_STRIP_SETTINGS);

  useEffect(() => {
    if (form?.feature_strip_settings)
      setS({ ...DEFAULT_FEATURE_STRIP_SETTINGS, ...(form.feature_strip_settings as Partial<FeatureStripSettings>) });
  }, [form?.feature_strip_settings]);

  const upd = <K extends keyof FeatureStripSettings>(k: K, v: FeatureStripSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const updItem = <K extends keyof FeatureStripItem>(i: number, k: K, v: FeatureStripItem[K]) =>
    setS((prev) => ({ ...prev, items: prev.items.map((item, idx) => idx === i ? { ...item, [k]: v } : item) }));

  const addItem = () =>
    setS((prev) => ({ ...prev, items: [...prev.items, { icon: "✨", title: "New Feature", desc: "Describe it here", enabled: true }] }));

  const removeItem = (i: number) =>
    setS((prev) => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));

  const moveItem = (i: number, dir: -1 | 1) =>
    setS((prev) => { const items = [...prev.items]; [items[i], items[i + dir]] = [items[i + dir], items[i]]; return { ...prev, items }; });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-5">
      <p className="text-xs text-secondary-500">The icon strip shown between the hero and the affirmations marquee.</p>

      {/* Live preview */}
      <div className="rounded-lg p-4 grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ backgroundColor: s.backgroundColor, color: s.textColor }}>
        {s.items.filter((i) => i.enabled).map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">{item.icon}</span>
            <div>
              <p className="font-semibold text-sm">{item.title}</p>
              <p className="text-xs opacity-60">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={s.active} onChange={(e) => upd("active", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
        <span className="text-sm font-medium text-secondary-700">Show feature strip</span>
      </label>

      <div className="grid grid-cols-3 gap-4">
        {(["backgroundColor", "textColor", "accentColor"] as const).map((k) => (
          <label key={k} className="label-text capitalize">
            {k === "backgroundColor" ? "Background" : k === "textColor" ? "Text color" : "Accent color"}
            <input type="color" value={s[k]} onChange={(e) => upd(k, e.target.value)} className="mt-1 h-10 w-full cursor-pointer" />
          </label>
        ))}
      </div>

      <div className="space-y-3 border-t border-secondary-100 pt-4">
        {s.items.map((item, i) => (
          <div key={i} className="border border-secondary-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={item.enabled} onChange={(e) => updItem(i, "enabled", e.target.checked)} className="w-4 h-4 rounded text-primary-500" />
                <span className="text-sm font-semibold text-secondary-800">Item {i + 1}</span>
              </div>
              <div className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">↑</button>
                <button type="button" disabled={i === s.items.length - 1} onClick={() => moveItem(i, 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeItem(i)} className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded">Remove</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label-text">Icon / Emoji</label>
                <input value={item.icon} onChange={(e) => updItem(i, "icon", e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label-text">Title</label>
                <input value={item.title} onChange={(e) => updItem(i, "title", e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label-text">Description</label>
                <input value={item.desc} onChange={(e) => updItem(i, "desc", e.target.value)} className="input-field" />
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addItem} className="btn-outline py-2 text-sm w-full">+ Add Item</button>
      </div>

      <SaveBar onSave={() => save({ feature_strip_settings: s })} saved={saved} error={error} />
    </div>
  );
}
