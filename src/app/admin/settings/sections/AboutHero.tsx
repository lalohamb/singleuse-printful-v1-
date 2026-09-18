"use client";
import { useState, useEffect } from "react";
import { Check, Save } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { supabase } from "@/lib/supabase";
import { useSettings } from "./useSettings";
import AppImage from "@/components/AppImage";
import { DEFAULT_ABOUT_SETTINGS, type AboutSettings } from "@/lib/about-settings";

const GRAD_DIRS = ["left","right","center","top","bottom","full","none"] as const;

type HeroKeys = Pick<AboutSettings,
  "heroEyebrow"|"heroTitle"|"heroSubtitle"|"heroQuote"|"heroCredit"|
  "heroImageUrl"|"heroObjectPosition"|"heroImageScale"|"heroImageFlip"|
  "heroImageFit"|"heroGradientOpacity"|"heroGradientDir"|"heroBackground"|"heroTextColor"
>;

const DEFAULTS: HeroKeys = {
  heroEyebrow: DEFAULT_ABOUT_SETTINGS.heroEyebrow,
  heroTitle: DEFAULT_ABOUT_SETTINGS.heroTitle,
  heroSubtitle: DEFAULT_ABOUT_SETTINGS.heroSubtitle,
  heroQuote: DEFAULT_ABOUT_SETTINGS.heroQuote,
  heroCredit: DEFAULT_ABOUT_SETTINGS.heroCredit,
  heroImageUrl: DEFAULT_ABOUT_SETTINGS.heroImageUrl,
  heroObjectPosition: DEFAULT_ABOUT_SETTINGS.heroObjectPosition,
  heroImageScale: DEFAULT_ABOUT_SETTINGS.heroImageScale,
  heroImageFlip: DEFAULT_ABOUT_SETTINGS.heroImageFlip,
  heroImageFit: DEFAULT_ABOUT_SETTINGS.heroImageFit,
  heroGradientOpacity: DEFAULT_ABOUT_SETTINGS.heroGradientOpacity,
  heroGradientDir: DEFAULT_ABOUT_SETTINGS.heroGradientDir,
  heroBackground: DEFAULT_ABOUT_SETTINGS.heroBackground,
  heroTextColor: DEFAULT_ABOUT_SETTINGS.heroTextColor,
};

export default function AboutHero() {
  const { form } = useSettings();
  const [s, setS] = useState<HeroKeys>({ ...DEFAULTS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (form?.about_hero_settings) setS({ ...DEFAULTS, ...(form.about_hero_settings as Partial<HeroKeys>) });
  }, [form?.about_hero_settings]);

  const upd = <K extends keyof HeroKeys>(k: K, v: HeroKeys[K]) => setS((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    await supabase.from("settings").update({ about_hero_settings: s, updated_at: new Date().toISOString() }).eq("id", form.id);
    setSaved(true);
    fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: ["/about"] }) });
    setTimeout(() => setSaved(false), 2000);
  };

  const pos = (s.heroObjectPosition || "50% 20%").replace(/%/g, "").split(" ");
  const x = parseInt(pos[0]) || 50;
  const y = parseInt(pos[1]) || 20;
  const setPos = (nx: number, ny: number) => upd("heroObjectPosition", `${nx}% ${ny}%`);
  const op = (s.heroGradientOpacity ?? 40) / 100;
  const dir = s.heroGradientDir || "right";
  const gradMap: Record<string, string> = {
    left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    center: `linear-gradient(to bottom, rgba(17,17,17,${op*0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op*0.6}) 100%)`,
    top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    full:   `rgba(17,17,17,${op})`,
    none:   "transparent",
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      {(["heroEyebrow","heroTitle","heroSubtitle","heroQuote","heroCredit"] as const).map((k) => (
        <div key={k}>
          <label className="label-text capitalize">{k.replace("hero","").replace(/([A-Z])/g," $1").trim()}</label>
          <input value={s[k]} onChange={(e) => upd(k, e.target.value)} className="input-field" />
        </div>
      ))}
      <ImageUpload label="Hero Image" value={s.heroImageUrl} onChange={(url) => upd("heroImageUrl", url)} folder="settings/about" preview={false} />
      {s.heroImageUrl && (
        <div className="space-y-3">
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">X: {x}%</span><input type="range" min={0} max={100} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" /></div>
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-16">Y: {y}%</span><input type="range" min={0} max={100} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
          <div className="relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: 200 }}>
            <AppImage src={s.heroImageUrl} alt="preview" fill className={`${s.heroImageFit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: s.heroObjectPosition || "50% 20%", transform: s.heroImageFlip ? "scaleX(-1)" : undefined, scale: `${s.heroImageScale ?? 100}%` }} />
            <div className="absolute inset-0" style={{ background: gradMap[dir] }} />
            <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Zoom: {s.heroImageScale ?? 100}%</span><input type="range" min={10} max={200} value={s.heroImageScale ?? 100} onChange={(e) => upd("heroImageScale", Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
          <div className="flex items-center gap-3"><span className="text-xs text-secondary-500 w-24">Overlay: {s.heroGradientOpacity ?? 40}%</span><input type="range" min={0} max={100} value={s.heroGradientOpacity ?? 40} onChange={(e) => upd("heroGradientOpacity", Number(e.target.value))} className="flex-1 accent-gold-500" /></div>
          <div className="flex flex-wrap gap-2"><span className="text-xs w-24">Gradient</span>{GRAD_DIRS.map((d) => <button key={d} type="button" onClick={() => upd("heroGradientDir", d)} className={`text-xs px-3 py-1 rounded border capitalize ${dir === d ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{d}</button>)}</div>
          <div className="flex items-center gap-2">
            {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => upd("heroImageFit", v)} className={`text-xs px-3 py-1 rounded border capitalize ${(s.heroImageFit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
            <button type="button" onClick={() => upd("heroImageFlip", !s.heroImageFlip)} className={`text-xs px-3 py-1 rounded border ${s.heroImageFlip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>Flip</button>
            <button type="button" onClick={() => { upd("heroObjectPosition","50% 20%"); upd("heroImageScale",100); upd("heroImageFlip",false); upd("heroGradientOpacity",40); upd("heroGradientDir","right"); upd("heroImageFit","cover"); }} className="btn-outline py-1 text-xs">Reset</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <label className="label-text">Background<input type="color" value={s.heroBackground} onChange={(e) => upd("heroBackground", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
        <label className="label-text">Text Color<input type="color" value={s.heroTextColor} onChange={(e) => upd("heroTextColor", e.target.value)} className="mt-1 h-10 w-full cursor-pointer" /></label>
      </div>
      <div className="flex justify-end pt-2 border-t border-secondary-100">
        <button onClick={handleSave} className={`btn-primary ${saved ? "!bg-green-600 hover:!bg-green-600" : ""}`}>
          {saved ? <><Check size={18} className="mr-2" />Saved</> : <><Save size={18} className="mr-2" />Save Hero</>}
        </button>
      </div>
    </div>
  );
}
