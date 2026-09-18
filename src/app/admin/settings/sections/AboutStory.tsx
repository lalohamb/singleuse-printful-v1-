"use client";
import { useState, useEffect } from "react";
import { Check, Save } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { supabase } from "@/lib/supabase";
import { useSettings } from "./useSettings";
import { DEFAULT_ABOUT_SETTINGS, type AboutSettings } from "@/lib/about-settings";

type StoryKeys = Pick<AboutSettings,
  "storyParagraph1"|"storyParagraph2"|"storyParagraph3"|
  "storyQuote"|"storyQuoteCredit"|"storyImageUrl"|"storyImageAlt"|
  "storyImageCaption"|"storyImageSubcaption"|"storyObjectPosition"|
  "storyImageScale"|"storyImageFlip"|"storyImageFit"
>;

const DEFAULTS: StoryKeys = {
  storyParagraph1: DEFAULT_ABOUT_SETTINGS.storyParagraph1,
  storyParagraph2: DEFAULT_ABOUT_SETTINGS.storyParagraph2,
  storyParagraph3: DEFAULT_ABOUT_SETTINGS.storyParagraph3,
  storyQuote: DEFAULT_ABOUT_SETTINGS.storyQuote,
  storyQuoteCredit: DEFAULT_ABOUT_SETTINGS.storyQuoteCredit,
  storyImageUrl: DEFAULT_ABOUT_SETTINGS.storyImageUrl,
  storyImageAlt: DEFAULT_ABOUT_SETTINGS.storyImageAlt,
  storyImageCaption: DEFAULT_ABOUT_SETTINGS.storyImageCaption,
  storyImageSubcaption: DEFAULT_ABOUT_SETTINGS.storyImageSubcaption,
  storyObjectPosition: DEFAULT_ABOUT_SETTINGS.storyObjectPosition,
  storyImageScale: DEFAULT_ABOUT_SETTINGS.storyImageScale,
  storyImageFlip: DEFAULT_ABOUT_SETTINGS.storyImageFlip,
  storyImageFit: DEFAULT_ABOUT_SETTINGS.storyImageFit,
};

export default function AboutStory() {
  const { form } = useSettings();
  const [s, setS] = useState<StoryKeys>({ ...DEFAULTS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (form?.about_story_settings) setS({ ...DEFAULTS, ...(form.about_story_settings as Partial<StoryKeys>) });
  }, [form?.about_story_settings]);

  const upd = <K extends keyof StoryKeys>(k: K, v: StoryKeys[K]) => setS((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await supabase.from("settings").update({ about_story_settings: s, updated_at: new Date().toISOString() }).eq("id", form.id);
    setSaved(true);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/about"] }) });
    setTimeout(() => setSaved(false), 2000);
  };

  const pos = (s.storyObjectPosition || "50% 20%").replace(/%/g, "").split(" ");
  const x = parseInt(pos[0]) || 50;
  const y = parseInt(pos[1]) || 20;
  const setPos = (nx: number, ny: number) => upd("storyObjectPosition", `${nx}% ${ny}%`);

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      {(["storyParagraph1","storyParagraph2","storyParagraph3"] as const).map((k, i) => (
        <div key={k}><label className="label-text">Paragraph {i + 1}</label><textarea value={s[k]} onChange={(e) => upd(k, e.target.value)} className="input-field min-h-[80px]" /></div>
      ))}
      <div><label className="label-text">Closing Quote</label><input value={s.storyQuote} onChange={(e) => upd("storyQuote", e.target.value)} className="input-field" /></div>
      <div><label className="label-text">Quote Credit</label><input value={s.storyQuoteCredit} onChange={(e) => upd("storyQuoteCredit", e.target.value)} className="input-field" /></div>
      <ImageUpload label="Story Image" value={s.storyImageUrl} onChange={(url) => upd("storyImageUrl", url)} folder="settings/about" preview={false} />
      {s.storyImageUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">X: {x}%</span><input type="range" min={0} max={100} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" /></div>
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">Y: {y}%</span><input type="range" min={0} max={100} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Zoom: {s.storyImageScale ?? 100}%</span><input type="range" min={10} max={200} value={s.storyImageScale ?? 100} onChange={(e) => upd("storyImageScale", Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
          <div className="flex items-center gap-2">
            {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => upd("storyImageFit", v)} className={`text-xs px-3 py-1 rounded border capitalize ${(s.storyImageFit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
            <button type="button" onClick={() => upd("storyImageFlip", !s.storyImageFlip)} className={`text-xs px-3 py-1 rounded border ${s.storyImageFlip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>Flip</button>
            <button type="button" onClick={() => { upd("storyObjectPosition","50% 20%"); upd("storyImageScale",100); upd("storyImageFlip",false); upd("storyImageFit","cover"); }} className="btn-outline py-1 text-xs">Reset</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label-text">Caption</label><input value={s.storyImageCaption} onChange={(e) => upd("storyImageCaption", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Subcaption</label><input value={s.storyImageSubcaption} onChange={(e) => upd("storyImageSubcaption", e.target.value)} className="input-field" /></div>
      </div>
      <div><label className="label-text">Image Alt Text</label><input value={s.storyImageAlt} onChange={(e) => upd("storyImageAlt", e.target.value)} className="input-field" /></div>
      <div className="flex justify-end pt-2 border-t border-secondary-100">
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Story</>}
        </button>
      </div>
    </div>
  );
}
