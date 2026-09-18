"use client";
import { useState, useEffect } from "react";
import { Check, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "./useSettings";
import { DEFAULT_ABOUT_SETTINGS, DEFAULT_CULTURE_CARDS, type AboutSettings, type AboutCultureCard } from "@/lib/about-settings";

type CultureKeys = Pick<AboutSettings, "cultureEyebrow"|"cultureTitle"|"cultureBody"|"cultureCreed"|"cultureBackground"|"cultureTextColor"|"cultureCards">;

const DEFAULTS: CultureKeys = {
  cultureEyebrow: DEFAULT_ABOUT_SETTINGS.cultureEyebrow,
  cultureTitle: DEFAULT_ABOUT_SETTINGS.cultureTitle,
  cultureBody: DEFAULT_ABOUT_SETTINGS.cultureBody,
  cultureCreed: DEFAULT_ABOUT_SETTINGS.cultureCreed,
  cultureBackground: DEFAULT_ABOUT_SETTINGS.cultureBackground,
  cultureTextColor: DEFAULT_ABOUT_SETTINGS.cultureTextColor,
  cultureCards: DEFAULT_CULTURE_CARDS,
};

export default function AboutCulture() {
  const { form } = useSettings();
  const [s, setS] = useState<CultureKeys>({ ...DEFAULTS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (form?.about_culture_settings) setS({ ...DEFAULTS, ...(form.about_culture_settings as Partial<CultureKeys>) });
  }, [form?.about_culture_settings]);

  const upd = <K extends keyof CultureKeys>(k: K, v: CultureKeys[K]) => setS((p) => ({ ...p, [k]: v }));
  const cards = s.cultureCards?.length ? s.cultureCards : DEFAULT_CULTURE_CARDS;
  const updCard = (i: number, field: keyof AboutCultureCard, v: string) =>
    upd("cultureCards", cards.map((c, j) => j === i ? { ...c, [field]: v } : c));

  const handleSave = async () => {
    await supabase.from("settings").update({ about_culture_settings: s, updated_at: new Date().toISOString() }).eq("id", form.id);
    setSaved(true);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/about"] }) });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div><label className="label-text">Eyebrow</label><input value={s.cultureEyebrow} onChange={(e) => upd("cultureEyebrow", e.target.value)} className="input-field" /></div>
      <div><label className="label-text">Title</label><input value={s.cultureTitle} onChange={(e) => upd("cultureTitle", e.target.value)} className="input-field" /></div>
      <div><label className="label-text">Body</label><textarea value={s.cultureBody} onChange={(e) => upd("cultureBody", e.target.value)} className="input-field min-h-[100px]" /></div>
      <div><label className="label-text">Closing Statement</label><input value={s.cultureCreed} onChange={(e) => upd("cultureCreed", e.target.value)} className="input-field" /></div>
      <div className="grid grid-cols-2 gap-4">
        <label className="label-text">Background<input type="color" value={s.cultureBackground} onChange={(e) => upd("cultureBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        <label className="label-text">Text Color<input type="color" value={s.cultureTextColor} onChange={(e) => upd("cultureTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
      </div>
      <div className="border-t border-secondary-100 pt-4 space-y-3">
        <p className="text-sm font-semibold text-secondary-800">Culture Cards</p>
        {cards.map((card, i) => (
          <div key={i} className="border border-secondary-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary-500">Card {i + 1}</span>
              <button type="button" onClick={() => upd("cultureCards", cards.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label-text">Emoji</label><input value={card.emoji} onChange={(e) => updCard(i, "emoji", e.target.value)} className="input-field" /></div>
              <div><label className="label-text">Title</label><input value={card.title} onChange={(e) => updCard(i, "title", e.target.value)} className="input-field" /></div>
            </div>
            <div><label className="label-text">Description</label><input value={card.desc} onChange={(e) => updCard(i, "desc", e.target.value)} className="input-field" /></div>
          </div>
        ))}
        <button type="button" onClick={() => upd("cultureCards", [...cards, { emoji: "✨", title: "New Card", desc: "" }])} className="btn-outline py-1.5 text-sm w-full">+ Add Card</button>
      </div>
      <div className="flex justify-end pt-2 border-t border-secondary-100">
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Culture</>}
        </button>
      </div>
    </div>
  );
}
