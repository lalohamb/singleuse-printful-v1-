"use client";
import { useState } from "react";
import { Check, Save } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { supabase } from "@/lib/supabase";
import { useSettings } from "./useSettings";
import AppImage from "@/components/AppImage";
import {
  DEFAULT_ABOUT_SETTINGS, DEFAULT_MISSION_CARDS, DEFAULT_CULTURE_CARDS,
  type AboutSettings, type AboutValueCard, type AboutCultureCard,
} from "@/lib/about-settings";

const GRAD_DIRS = ["left","right","center","top","bottom","full","none"] as const;

function SectionSaveBtn({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex justify-end pt-2 border-t border-secondary-100">
      <button onClick={onSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
        {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save</>}
      </button>
    </div>
  );
}

export default function About() {
  const { form } = useSettings();
  const [about, setAboutState] = useState<AboutSettings>({ ...DEFAULT_ABOUT_SETTINGS });
  const [savedSection, setSavedSection] = useState<string | null>(null);

  const setAbout = <K extends keyof AboutSettings>(key: K, value: AboutSettings[K]) =>
    setAboutState((prev) => ({ ...prev, [key]: value }));

  const saveSection = async (sectionKey: string, keys: (keyof AboutSettings)[]) => {
    const partial = keys.reduce((acc, k) => ({ ...acc, [k]: about[k] }), {} as Partial<AboutSettings>);
    const merged = { ...about, ...partial };
    await supabase.from("settings").update({ about_settings: merged, updated_at: new Date().toISOString() }).eq("id", form.id);
    setSavedSection(sectionKey);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/about"] }) });
    setTimeout(() => setSavedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="border border-secondary-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-secondary-800">About Hero</h2>
        {(["heroEyebrow","heroTitle","heroSubtitle","heroQuote","heroCredit"] as const).map((k) => (
          <div key={k}><label className="label-text capitalize">{k.replace("hero","").replace(/([A-Z])/g," $1").trim()}</label><input value={about[k] as string} onChange={(e) => setAbout(k, e.target.value)} className="input-field" /></div>
        ))}
        <ImageUpload label="Hero Image" value={about.heroImageUrl} onChange={(url) => setAbout("heroImageUrl", url)} folder="settings/about" preview={false} />
        {about.heroImageUrl && (() => {
          const pos = (about.heroObjectPosition || "50% 20%").replace(/%/g,"").split(" ");
          const x = parseInt(pos[0]) || 50;
          const y = parseInt(pos[1]) || 20;
          const setPos = (nx: number, ny: number) => setAbout("heroObjectPosition", `${nx}% ${ny}%`);
          const op = (about.heroGradientOpacity ?? 40) / 100;
          const dir = about.heroGradientDir || "right";
          const gradMap: Record<string, string> = {
            left: `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
            right: `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
            center: `linear-gradient(to bottom, rgba(17,17,17,${op*0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op*0.6}) 100%)`,
            top: `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
            bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
            full: `rgba(17,17,17,${op})`, none: "transparent",
          };
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">X: {x}%</span><input type="range" min={0} max={100} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" /></div>
              <div className="flex gap-2 items-stretch">
                <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                  <span className="text-[10px] text-secondary-400">▲</span>
                  <input type="range" min={0} max={100} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
                  <span className="text-[10px] text-secondary-400">▼</span>
                  <span className="text-[10px] text-secondary-500 mt-1">{y}%</span>
                </div>
                <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: 200 }}>
                  <AppImage src={about.heroImageUrl} alt="preview" fill className={`${about.heroImageFit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: about.heroObjectPosition || "50% 20%", transform: about.heroImageFlip ? "scaleX(-1)" : undefined, scale: `${about.heroImageScale ?? 100}%` }} />
                  <div className="absolute inset-0" style={{ background: gradMap[dir] }} />
                  <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
                </div>
              </div>
              <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Zoom: {about.heroImageScale ?? 100}%</span><input type="range" min={10} max={200} value={about.heroImageScale ?? 100} onChange={(e) => setAbout("heroImageScale", Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
              <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Overlay: {about.heroGradientOpacity ?? 40}%</span><input type="range" min={0} max={100} value={about.heroGradientOpacity ?? 40} onChange={(e) => setAbout("heroGradientOpacity", Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
              <div className="flex flex-wrap gap-2"><span className="text-xs w-24">Gradient</span>{GRAD_DIRS.map((d) => <button key={d} type="button" onClick={() => setAbout("heroGradientDir", d)} className={`text-xs px-3 py-1 rounded border capitalize ${dir === d ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{d}</button>)}</div>
              <div className="flex items-center gap-2">
                {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => setAbout("heroImageFit", v)} className={`text-xs px-3 py-1 rounded border capitalize ${(about.heroImageFit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
                <button type="button" onClick={() => setAbout("heroImageFlip", !about.heroImageFlip)} className={`text-xs px-3 py-1 rounded border ${about.heroImageFlip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>Flip</button>
                <button type="button" onClick={() => { setAbout("heroObjectPosition","50% 20%"); setAbout("heroImageScale",100); setAbout("heroImageFlip",false); setAbout("heroGradientOpacity",40); setAbout("heroGradientDir","right"); setAbout("heroImageFit","cover"); }} className="btn-outline py-1 text-xs">Reset</button>
              </div>
            </div>
          );
        })()}
        <div className="grid grid-cols-2 gap-4">
          <label className="label-text">Hero Background<input type="color" value={about.heroBackground} onChange={(e) => setAbout("heroBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
          <label className="label-text">Hero Text<input type="color" value={about.heroTextColor} onChange={(e) => setAbout("heroTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        </div>
        <SectionSaveBtn onSave={() => saveSection("hero", ["heroEyebrow","heroTitle","heroSubtitle","heroQuote","heroCredit","heroImageUrl","heroObjectPosition","heroImageScale","heroImageFlip","heroImageFit","heroGradientOpacity","heroGradientDir","heroBackground","heroTextColor"])} saved={savedSection === "hero"} />
      </div>

      {/* Story */}
      <div className="border border-secondary-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-secondary-800">Story</h2>
        {(["storyParagraph1","storyParagraph2","storyParagraph3"] as const).map((k, i) => (
          <div key={k}><label className="label-text">Paragraph {i+1}</label><textarea value={about[k] as string} onChange={(e) => setAbout(k, e.target.value)} className="input-field min-h-[80px]" /></div>
        ))}
        <div><label className="label-text">Closing Quote</label><input value={about.storyQuote} onChange={(e) => setAbout("storyQuote", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Quote Credit</label><input value={about.storyQuoteCredit} onChange={(e) => setAbout("storyQuoteCredit", e.target.value)} className="input-field" /></div>
        <ImageUpload label="Story Image" value={about.storyImageUrl} onChange={(url) => setAbout("storyImageUrl", url)} folder="settings/about" preview={false} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-text">Caption</label><input value={about.storyImageCaption} onChange={(e) => setAbout("storyImageCaption", e.target.value)} className="input-field" /></div>
          <div><label className="label-text">Subcaption</label><input value={about.storyImageSubcaption} onChange={(e) => setAbout("storyImageSubcaption", e.target.value)} className="input-field" /></div>
        </div>
        <div><label className="label-text">Image Alt Text</label><input value={about.storyImageAlt} onChange={(e) => setAbout("storyImageAlt", e.target.value)} className="input-field" /></div>
        <SectionSaveBtn onSave={() => saveSection("story", ["storyParagraph1","storyParagraph2","storyParagraph3","storyQuote","storyQuoteCredit","storyImageUrl","storyImageAlt","storyImageCaption","storyImageSubcaption","storyObjectPosition","storyImageScale","storyImageFlip","storyImageFit"])} saved={savedSection === "story"} />
      </div>

      {/* Mission */}
      <div className="border border-secondary-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-secondary-800">Mission</h2>
        <div><label className="label-text">Eyebrow</label><input value={about.missionEyebrow} onChange={(e) => setAbout("missionEyebrow", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Title</label><input value={about.missionTitle} onChange={(e) => setAbout("missionTitle", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Body</label><textarea value={about.missionBody} onChange={(e) => setAbout("missionBody", e.target.value)} className="input-field min-h-[100px]" /></div>
        <div className="grid grid-cols-2 gap-4">
          <label className="label-text">Background<input type="color" value={about.missionBackground} onChange={(e) => setAbout("missionBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
          <label className="label-text">Text<input type="color" value={about.missionTextColor} onChange={(e) => setAbout("missionTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        </div>
        <div className="border-t border-secondary-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-secondary-800">Value Cards</p>
          {(about.missionCards?.length ? about.missionCards : DEFAULT_MISSION_CARDS).map((card: AboutValueCard, i: number) => (
            <div key={i} className="border border-secondary-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-secondary-500">Card {i+1}</span>
                <button type="button" onClick={() => setAbout("missionCards", (about.missionCards ?? DEFAULT_MISSION_CARDS).filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Icon</label><select value={card.icon} onChange={(e) => setAbout("missionCards", (about.missionCards ?? DEFAULT_MISSION_CARDS).map((c, j) => j === i ? { ...c, icon: e.target.value } : c))} className="input-field">{["Heart","Sparkles","Users","Globe"].map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
                <div><label className="label-text">Title</label><input value={card.title} onChange={(e) => setAbout("missionCards", (about.missionCards ?? DEFAULT_MISSION_CARDS).map((c, j) => j === i ? { ...c, title: e.target.value } : c))} className="input-field" /></div>
              </div>
              <div><label className="label-text">Description</label><input value={card.desc} onChange={(e) => setAbout("missionCards", (about.missionCards ?? DEFAULT_MISSION_CARDS).map((c, j) => j === i ? { ...c, desc: e.target.value } : c))} className="input-field" /></div>
            </div>
          ))}
          <button type="button" onClick={() => setAbout("missionCards", [...(about.missionCards ?? DEFAULT_MISSION_CARDS), { icon: "Sparkles", title: "New Value", desc: "" }])} className="btn-outline py-1.5 text-sm w-full">+ Add Card</button>
        </div>
        <SectionSaveBtn onSave={() => saveSection("mission", ["missionEyebrow","missionTitle","missionBody","missionBackground","missionTextColor","missionCards"])} saved={savedSection === "mission"} />
      </div>

      {/* Culture */}
      <div className="border border-secondary-100 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-secondary-800">Culture</h2>
        <div><label className="label-text">Eyebrow</label><input value={about.cultureEyebrow} onChange={(e) => setAbout("cultureEyebrow", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Title</label><input value={about.cultureTitle} onChange={(e) => setAbout("cultureTitle", e.target.value)} className="input-field" /></div>
        <div><label className="label-text">Body</label><textarea value={about.cultureBody} onChange={(e) => setAbout("cultureBody", e.target.value)} className="input-field min-h-[100px]" /></div>
        <div><label className="label-text">Closing statement</label><input value={about.cultureCreed} onChange={(e) => setAbout("cultureCreed", e.target.value)} className="input-field" /></div>
        <div className="grid grid-cols-2 gap-4">
          <label className="label-text">Background<input type="color" value={about.cultureBackground} onChange={(e) => setAbout("cultureBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
          <label className="label-text">Text<input type="color" value={about.cultureTextColor} onChange={(e) => setAbout("cultureTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        </div>
        <div className="border-t border-secondary-100 pt-4 space-y-3">
          <p className="text-sm font-semibold text-secondary-800">Culture Cards</p>
          {(about.cultureCards?.length ? about.cultureCards : DEFAULT_CULTURE_CARDS).map((card: AboutCultureCard, i: number) => (
            <div key={i} className="border border-secondary-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-secondary-500">Card {i+1}</span>
                <button type="button" onClick={() => setAbout("cultureCards", (about.cultureCards ?? DEFAULT_CULTURE_CARDS).filter((_, j) => j !== i))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label-text">Emoji</label><input value={card.emoji} onChange={(e) => setAbout("cultureCards", (about.cultureCards ?? DEFAULT_CULTURE_CARDS).map((c, j) => j === i ? { ...c, emoji: e.target.value } : c))} className="input-field" /></div>
                <div><label className="label-text">Title</label><input value={card.title} onChange={(e) => setAbout("cultureCards", (about.cultureCards ?? DEFAULT_CULTURE_CARDS).map((c, j) => j === i ? { ...c, title: e.target.value } : c))} className="input-field" /></div>
              </div>
              <div><label className="label-text">Description</label><input value={card.desc} onChange={(e) => setAbout("cultureCards", (about.cultureCards ?? DEFAULT_CULTURE_CARDS).map((c, j) => j === i ? { ...c, desc: e.target.value } : c))} className="input-field" /></div>
            </div>
          ))}
          <button type="button" onClick={() => setAbout("cultureCards", [...(about.cultureCards ?? DEFAULT_CULTURE_CARDS), { emoji: "✨", title: "New Card", desc: "" }])} className="btn-outline py-1.5 text-sm w-full">+ Add Card</button>
        </div>
        <SectionSaveBtn onSave={() => saveSection("culture", ["cultureEyebrow","cultureTitle","cultureBody","cultureCreed","cultureBackground","cultureTextColor","cultureCards"])} saved={savedSection === "culture"} />
      </div>
    </div>
  );
}
