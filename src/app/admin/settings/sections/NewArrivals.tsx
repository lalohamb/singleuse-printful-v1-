"use client";
import { useState } from "react";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { DEFAULT_NEW_ARRIVALS_SETTINGS, type NewArrivalsSettings } from "@/lib/new-arrivals-settings";

export default function NewArrivals() {
  const { form, save, saved, error } = useSettings();
  const [s, setS] = useState<NewArrivalsSettings>(DEFAULT_NEW_ARRIVALS_SETTINGS);
  const upd = <K extends keyof NewArrivalsSettings>(k: K, v: NewArrivalsSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <p className="text-xs text-secondary-500">Products appear here when marked as New Arrival in Products.</p>
      <div>
        <label className="label-text">Section Label</label>
        <input value={s.eyebrow} onChange={(e) => upd("eyebrow", e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="label-text">Drop Label</label>
        <input value={s.dropLabel} onChange={(e) => upd("dropLabel", e.target.value)} className="input-field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-text">Shop Button Label</label>
          <input value={s.shopButtonLabel} onChange={(e) => upd("shopButtonLabel", e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label-text">View All Label</label>
          <input value={s.viewAllLabel} onChange={(e) => upd("viewAllLabel", e.target.value)} className="input-field" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(["backgroundColor","textColor","accentColor"] as const).map((k) => (
          <label key={k} className="label-text capitalize">
            {k.replace("Color"," color").replace("background","Background")}
            <input type="color" value={s[k]} onChange={(e) => upd(k, e.target.value)} className="mt-1 h-10 w-full cursor-pointer" />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={s.showAccent} onChange={(e) => upd("showAccent", e.target.checked)} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
        <span className="text-sm font-medium text-secondary-700">Show accent bar beside drop indicator</span>
      </label>
      <SaveBar onSave={() => save({ new_arrivals_settings: s })} saved={saved} error={error} />
    </div>
  );
}
