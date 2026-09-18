"use client";
import { useState, useEffect } from "react";
import { Check, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSettings } from "./useSettings";
import { DEFAULT_ABOUT_SETTINGS, DEFAULT_MISSION_CARDS, type AboutSettings, type AboutValueCard } from "@/lib/about-settings";

type MissionKeys = Pick<AboutSettings, "missionEyebrow"|"missionTitle"|"missionBody"|"missionBackground"|"missionTextColor"|"missionCards">;

const DEFAULTS: MissionKeys = {
  missionEyebrow: DEFAULT_ABOUT_SETTINGS.missionEyebrow,
  missionTitle: DEFAULT_ABOUT_SETTINGS.missionTitle,
  missionBody: DEFAULT_ABOUT_SETTINGS.missionBody,
  missionBackground: DEFAULT_ABOUT_SETTINGS.missionBackground,
  missionTextColor: DEFAULT_ABOUT_SETTINGS.missionTextColor,
  missionCards: DEFAULT_MISSION_CARDS,
};

export default function AboutMission() {
  const { form } = useSettings();
  const [s, setS] = useState<MissionKeys>({ ...DEFAULTS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (form?.about_mission_settings) setS({ ...DEFAULTS, ...(form.about_mission_settings as Partial<MissionKeys>) });
  }, [form?.about_mission_settings]);

  const upd = <K extends keyof MissionKeys>(k: K, v: MissionKeys[K]) => setS((p) => ({ ...p, [k]: v }));
  const cards = s.missionCards?.length ? s.missionCards : DEFAULT_MISSION_CARDS;
  const updCard = (i: number, field: keyof AboutValueCard, v: string) =>
    upd("missionCards", cards.map((c, j) => j === i ? { ...c, [field]: v } : c));

  const handleSave = async () => {
    await supabase.from("settings").update({ about_mission_settings: s, updated_at: new Date().toISOString() }).eq("id", form.id);
    setSaved(true);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/about"] }) });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div><label className="label-text">Eyebrow</label><input value={s.missionEyebrow} onChange={(e) => upd("missionEyebrow", e.target.value)} className="input-field" /></div>
      <div><label className="label-text">Title</label><input value={s.missionTitle} onChange={(e) => upd("missionTitle", e.target.value)} className="input-field" /></div>
      <div><label className="label-text">Body</label><textarea value={s.missionBody} onChange={(e) => upd("missionBody", e.target.value)} className="input-field min-h-[100px]" /></div>
      <div className="grid grid-cols-2 gap-4">
        <label className="label-text">Background<input type="color" value={s.missionBackground} onChange={(e) => upd("missionBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        <label className="label-text">Text Color<input type="color" value={s.missionTextColor} onChange={(e) => upd("missionTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
      </div>
      <div className="border-t border-secondary-100 pt-4 space-y-3">
        <p className="text-sm font-semibold text-secondary-800">Value Cards</p>
        {cards.map((card, i) => (
          <div key={i} className="border border-secondary-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary-500">Card {i + 1}</span>
              <button type="button" onClick={() => upd("missionCards", cards.filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label-text">Icon</label><select value={card.icon} onChange={(e) => updCard(i, "icon", e.target.value)} className="input-field">{["Heart","Sparkles","Users","Globe"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label className="label-text">Title</label><input value={card.title} onChange={(e) => updCard(i, "title", e.target.value)} className="input-field" /></div>
            </div>
            <div><label className="label-text">Description</label><input value={card.desc} onChange={(e) => updCard(i, "desc", e.target.value)} className="input-field" /></div>
          </div>
        ))}
        <button type="button" onClick={() => upd("missionCards", [...cards, { icon: "Sparkles", title: "New Value", desc: "" }])} className="btn-outline py-1.5 text-sm w-full">+ Add Card</button>
      </div>
      <div className="flex justify-end pt-2 border-t border-secondary-100">
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Mission</>}
        </button>
      </div>
    </div>
  );
}
