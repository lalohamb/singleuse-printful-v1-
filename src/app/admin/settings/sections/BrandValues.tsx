"use client";
import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { DEFAULT_BRAND_VALUES_SETTINGS, type BrandValuesSettings } from "@/lib/brand-values-settings";

export default function BrandValues() {
  const { save, saved, error } = useSettings();
  const [s, setS] = useState<BrandValuesSettings>(DEFAULT_BRAND_VALUES_SETTINGS);
  const upd = (k: keyof BrandValuesSettings, v: any) => setS((prev) => ({ ...prev, [k]: v }));
  const updValue = (i: number, field: string, v: any) =>
    setS((prev) => ({ ...prev, values: prev.values.map((item, idx) => idx === i ? { ...item, [field]: v } : item) }));
  const moveValue = (i: number, dir: -1 | 1) =>
    setS((prev) => { const vals = [...prev.values]; [vals[i], vals[i+dir]] = [vals[i+dir], vals[i]]; return { ...prev, values: vals }; });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <p className="text-xs text-secondary-500">Customize the three value blocks shown after New Arrivals.</p>
      {s.values.map((v, i) => (
        <div key={i} className="border border-secondary-100 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-secondary-800">Value {i + 1}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-text">Stat</label><input value={v.stat} onChange={(e) => updValue(i, "stat", e.target.value)} className="input-field" /></div>
            <div><label className="label-text">Label</label><input value={v.label} onChange={(e) => updValue(i, "label", e.target.value)} className="input-field" /></div>
          </div>
          <div><label className="label-text">Supporting text</label><input value={v.sub} onChange={(e) => updValue(i, "sub", e.target.value)} className="input-field" /></div>
        </div>
      ))}
      <div className="grid grid-cols-3 gap-4">
        {(["backgroundColor","textColor","accentColor"] as const).map((k) => (
          <label key={k} className="label-text capitalize">
            {k.replace("Color"," color").replace("background","Background")}
            <input type="color" value={(s as any)[k]} onChange={(e) => upd(k, e.target.value)} className="mt-1 h-10 w-full cursor-pointer" />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-3 cursor-pointer border-t border-secondary-100 pt-4">
        <input type="checkbox" checked={s.advanced} onChange={(e) => upd("advanced", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
        <span className="text-sm font-medium text-secondary-700">Use advanced Brand Values controls</span>
      </label>
      {s.advanced && (
        <div className="border-t border-secondary-100 pt-4 space-y-4">
          <ImageUpload label="Background Image" value={s.backgroundImage} onChange={(url) => upd("backgroundImage", url)} folder="settings/brand-values" preview={false} />
          <div className="grid grid-cols-2 gap-3">
            <label className="label-text">Columns<select value={s.columns} onChange={(e) => upd("columns", Number(e.target.value))} className="input-field mt-1">{[1,2,3,4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="label-text">Alignment<select value={s.alignment} onChange={(e) => upd("alignment", e.target.value)} className="input-field mt-1"><option value="center">Center</option><option value="left">Left</option></select></label>
            <label className="label-text">Divider<select value={s.divider} onChange={(e) => upd("divider", e.target.value)} className="input-field mt-1"><option value="none">None</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
            <label className="label-text">Padding<select value={s.padding} onChange={(e) => upd("padding", e.target.value)} className="input-field mt-1"><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={s.animate} onChange={(e) => upd("animate", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
            <span className="text-sm font-medium text-secondary-700">Animate value cards on reveal</span>
          </label>
          {s.values.map((v, i) => (
            <div key={`adv-${i}`} className="border border-secondary-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-secondary-800">Value {i + 1}</p>
                <div className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => moveValue(i, -1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">Up</button>
                  <button type="button" disabled={i === s.values.length - 1} onClick={() => moveValue(i, 1)} className="px-2 py-1 text-xs border rounded disabled:opacity-30">Down</button>
                  <button type="button" onClick={() => setS((prev) => ({ ...prev, values: prev.values.filter((_, idx) => idx !== i) }))} className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded">Remove</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="label-text">Icon/emoji<input value={v.icon || ""} onChange={(e) => updValue(i, "icon", e.target.value)} className="input-field mt-1" /></label>
                <label className="label-text">Stat<input value={v.stat} onChange={(e) => updValue(i, "stat", e.target.value)} className="input-field mt-1" /></label>
                <label className="label-text">Enabled<input type="checkbox" checked={v.enabled !== false} onChange={(e) => updValue(i, "enabled", e.target.checked)} className="mt-3 ml-2 w-5 h-5" /></label>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setS((prev) => ({ ...prev, values: [...prev.values, { stat: "New", label: "New Value", sub: "Describe this value", icon: "✨", enabled: true }] }))} className="btn-outline py-2 text-sm">Add Value</button>
        </div>
      )}
      <SaveBar onSave={() => save({ brand_values_settings: s })} saved={saved} error={error} />
    </div>
  );
}
