"use client";
import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import ProductImagePicker from "../ProductImagePicker";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import {
  DEFAULT_AFFIRMATIONS_SETTINGS,
  type AffirmationsSettings,
} from "@/lib/affirmations-settings";
import { useRef } from "react";

const AFFIRMATION_EMOJIS = [
  { label: "Business", icons: ["✨","💎","⭐","🏆","✅","💯","🛍️","🛒","🎁","🏷️","💸","🔥","⚡","📦","🚚","🧵","♻️","🛡️","💬","📩"] },
  { label: "Energy",   icons: ["✨","⚡","💫","🔥","💥","🌟","🎯","💎"] },
  { label: "Style",    icons: ["👕","👗","🧥","👟","🧢","💍","🕶️","👜"] },
  { label: "Confidence", icons: ["💪","🙌","👏","💯","👑","🏆","😎","🤩"] },
  { label: "Good Vibes", icons: ["❤️","🖤","🫶","🌈","🌍","🌱","☀️","🎉"] },
  { label: "Holiday",  icons: ["🎄","🎅","🤶","🎁","❄️","☃️","🕎","🕯️","🎃","🦃","💝","🎆"] },
];

const GRAD_DIRS = ["left","right","center","top","bottom","full","none"] as const;

export default function HomepageHero() {
  const { form, set, save, saved, error } = useSettings();
  const [heroPreviewH, setHeroPreviewH] = useState(70);
  const [showPicker, setShowPicker] = useState(false);
  const [affirmations, setAffirmations] = useState<AffirmationsSettings>(DEFAULT_AFFIRMATIONS_SETTINGS);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const affirmationRef = useRef<HTMLTextAreaElement>(null);

  const pos = (form.hero_object_position || "0px 0px").replace(/px/g, "").split(" ");
  const x = parseInt(pos[0]) || 0;
  const y = parseInt(pos[1]) || 0;
  const setPos = (nx: number, ny: number) => set("hero_object_position", `${nx}px ${ny}px`);
  const op = (form.hero_gradient_opacity ?? 70) / 100;
  const dir = form.hero_gradient_dir || "left";
  const gradMap: Record<string, string> = {
    left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    center: `linear-gradient(to bottom, rgba(17,17,17,${op*0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op*0.6}) 100%)`,
    top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    full:   `rgba(17,17,17,${op})`,
    none:   "transparent",
  };

  const insertEmoji = (emoji: string) => {
    const el = affirmationRef.current;
    const current = affirmations.phrases.join("\n");
    if (!el) { setAffirmations((a) => ({ ...a, phrases: [...a.phrases, emoji] })); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    setAffirmations((a) => ({ ...a, phrases: next.split("\n").map((p) => p.trim()).filter(Boolean) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  const handleSave = () => save({
    hero_title: form.hero_title,
    hero_subtitle: form.hero_subtitle,
    hero_image_url: form.hero_image_url,
    hero_object_position: form.hero_object_position,
    hero_height_vh: heroPreviewH,
    hero_image_flip: form.hero_image_flip,
    hero_image_scale: form.hero_image_scale,
    hero_gradient_opacity: form.hero_gradient_opacity,
    hero_gradient_dir: form.hero_gradient_dir,
    hero_image_fit: form.hero_image_fit,
    affirmations_settings: affirmations,
  });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="label-text">Hero Title</label>
        <input value={form.hero_title || ""} onChange={(e) => set("hero_title", e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="label-text">Hero Subtitle</label>
        <textarea value={form.hero_subtitle || ""} onChange={(e) => set("hero_subtitle", e.target.value)} className="input-field min-h-[80px]" />
      </div>
      <ImageUpload label="Hero Image" value={form.hero_image_url || ""} onChange={(url) => set("hero_image_url", url)} folder="settings/hero" preview={false} />
      <button type="button" onClick={() => setShowPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
      {showPicker && <ProductImagePicker onSelect={(url) => { set("hero_image_url", url); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}

      {/* Image controls */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-16">X: {x}px</span>
          <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" />
        </div>
        {form.hero_image_url && (
          <div className="flex gap-2 items-stretch">
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
              <span className="text-[10px] text-secondary-400">▲</span>
              <input type="range" min={30} max={100} value={heroPreviewH} onChange={(e) => setHeroPreviewH(Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
              <span className="text-[10px] text-secondary-400">▼</span>
              <span className="text-[10px] text-secondary-500 mt-1">{heroPreviewH}vh</span>
            </div>
            <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: Math.max(240, heroPreviewH * 4) }}>
              <img src={form.hero_image_url} alt="Hero preview" className={`absolute inset-0 w-full h-full ${form.hero_image_fit === "contain" ? "object-contain" : (form.hero_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: form.hero_object_position || "center", transform: form.hero_image_flip ? "scaleX(-1)" : undefined, scale: `${form.hero_image_scale ?? 100}%` }} />
              <div className="absolute inset-0" style={{ background: gradMap[dir] }} />
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
          <span className="text-xs text-secondary-500 w-24">Zoom: {form.hero_image_scale ?? 100}%</span>
          <input type="range" min={10} max={100} value={form.hero_image_scale ?? 100} onChange={(e) => set("hero_image_scale", Number(e.target.value))} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-24">Overlay: {form.hero_gradient_opacity ?? 70}%</span>
          <input type="range" min={0} max={100} value={form.hero_gradient_opacity ?? 70} onChange={(e) => set("hero_gradient_opacity", Number(e.target.value))} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-secondary-500 w-24">Gradient</span>
          {GRAD_DIRS.map((d) => (
            <button key={d} type="button" onClick={() => set("hero_gradient_dir", d)} className={`text-xs px-2 py-1 rounded border capitalize ${dir === d ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{d}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {["cover","contain"].map((v) => (
            <button key={v} type="button" onClick={() => set("hero_image_fit", v)} className={`text-xs px-2 py-1 rounded border capitalize ${(form.hero_image_fit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>
          ))}
          <button type="button" onClick={() => set("hero_image_flip", !form.hero_image_flip)} className={`text-xs px-2 py-1 rounded border ${form.hero_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>Flip</button>
          <button type="button" onClick={() => { set("hero_object_position", "center"); set("hero_image_scale", 100); set("hero_image_flip", false); set("hero_gradient_opacity", 70); set("hero_gradient_dir", "left"); set("hero_image_fit", "cover"); setHeroPreviewH(70); }} className="btn-outline py-1 text-xs">Reset</button>
        </div>
      </div>

      {/* Affirmations */}
      <div className="border-t border-secondary-100 pt-5 space-y-4">
        <div>
          <h2 className="font-semibold text-secondary-800">Affirmations Marquee</h2>
          <p className="text-xs text-secondary-500 mt-1">The scrolling phrase strip below the hero.</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={affirmations.active} onChange={(e) => setAffirmations((a) => ({ ...a, active: e.target.checked }))} className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500" />
          <span className="text-sm font-medium text-secondary-700">Show affirmations marquee</span>
        </label>
        <div>
          <label className="label-text">Phrases <span className="text-secondary-400 font-normal">(one per line)</span></label>
          <textarea ref={affirmationRef} value={affirmations.phrases.join("\n")} onChange={(e) => setAffirmations((a) => ({ ...a, phrases: e.target.value.split("\n").map((p) => p.trim()).filter(Boolean) }))} className="input-field min-h-[140px]" />
          <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary-500 hover:text-secondary-800">
            <span>😊</span><span>Add emoji</span><span className="text-secondary-400">{emojiOpen ? "▲" : "▼"}</span>
          </button>
          {emojiOpen && (
            <div className="mt-2 border border-secondary-200 rounded-xl p-3 bg-secondary-50 space-y-2">
              {AFFIRMATION_EMOJIS.map((g) => (
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
        <div className="grid grid-cols-3 gap-4">
          {(["backgroundColor","textColor","accentColor"] as const).map((k) => (
            <label key={k} className="label-text capitalize">
              {k.replace("Color"," color").replace("background","Background")}
              <input type="color" value={(affirmations as any)[k]} onChange={(e) => setAffirmations((a) => ({ ...a, [k]: e.target.value }))} className="mt-1 h-10 w-full cursor-pointer" />
            </label>
          ))}
        </div>
      </div>

      <SaveBar onSave={handleSave} saved={saved} error={error} />
    </div>
  );
}
