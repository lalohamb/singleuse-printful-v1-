"use client";
import ImageUpload from "@/components/ImageUpload";
import ProductImagePicker from "../ProductImagePicker";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import AppImage from "@/components/AppImage";
import { useState } from "react";

const GRAD_DIRS = ["left","right","center","top","bottom","full","none"] as const;

export default function WearYourStory() {
  const { form, set, save, saved, error } = useSettings();
  const [showPicker, setShowPicker] = useState(false);

  const pos = (form.story_object_position || "0px 0px").replace(/px/g, "").split(" ");
  const x = parseInt(pos[0]) || 0;
  const y = parseInt(pos[1]) || 0;
  const setPos = (nx: number, ny: number) => set("story_object_position", `${nx}px ${ny}px`);
  const op = (form.story_gradient_opacity ?? 40) / 100;
  const dir = form.story_gradient_dir || "full";
  const gradMap: Record<string, string> = {
    left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    center: `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    full:   `rgba(17,17,17,${op})`,
    none:   "transparent",
  };

  const handleSave = () => save({
    story_image_url: form.story_image_url,
    story_object_position: form.story_object_position,
    story_image_scale: form.story_image_scale,
    story_image_flip: form.story_image_flip,
    story_image_fit: form.story_image_fit,
    story_gradient_opacity: form.story_gradient_opacity,
    story_gradient_dir: form.story_gradient_dir,
  });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <ImageUpload label="Background Image" value={form.story_image_url || ""} onChange={(url) => set("story_image_url", url)} folder="settings/story" preview={false} />
      <button type="button" onClick={() => setShowPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
      {showPicker && <ProductImagePicker onSelect={(url) => { set("story_image_url", url); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs w-16">X: {x}px</span>
          <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex gap-2 items-stretch">
          <div className="flex flex-col items-center gap-1 w-10">
            <span>▲</span>
            <input type="range" min={10} max={200} value={form.story_image_scale ?? 100} onChange={(e) => set("story_image_scale", Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28 }} />
            <span>▼</span>
            <span className="text-[10px]">{form.story_image_scale ?? 100}%</span>
          </div>
          <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: 480 }}>
            {form.story_image_url && <AppImage fill src={form.story_image_url} alt="Story preview" className={`absolute inset-0 w-full h-full ${form.story_image_fit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: form.story_object_position || "center", transform: form.story_image_flip ? "scaleX(-1)" : undefined, scale: `${form.story_image_scale ?? 100}%` }} />}
            <div className="absolute inset-0" style={{ background: gradMap[dir] }} />
            <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
          </div>
          <div className="flex flex-col items-center gap-1 w-10">
            <span>▲</span>
            <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28 }} />
            <span>▼</span>
            <span className="text-[10px]">{y}px</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs w-24">Overlay: {form.story_gradient_opacity ?? 40}%</span>
          <input type="range" min={0} max={100} value={form.story_gradient_opacity ?? 40} onChange={(e) => set("story_gradient_opacity", Number(e.target.value))} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs w-24">Gradient</span>
          {GRAD_DIRS.map((d) => <button key={d} type="button" onClick={() => set("story_gradient_dir", d)} className={`text-xs px-2 py-1 rounded border capitalize ${dir === d ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{d}</button>)}
        </div>
        <div className="flex items-center gap-2">
          {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => set("story_image_fit", v)} className={`text-xs px-2 py-1 rounded border capitalize ${(form.story_image_fit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
          <button type="button" onClick={() => set("story_image_flip", !form.story_image_flip)} className={`text-xs px-2 py-1 rounded border ${form.story_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>⇄ Flip</button>
          <button type="button" onClick={() => { set("story_object_position","0px 0px"); set("story_image_scale",100); set("story_image_flip",false); set("story_gradient_opacity",40); set("story_gradient_dir","full"); set("story_image_fit","cover"); }} className="btn-outline py-1 text-xs">Reset</button>
        </div>
      </div>
      <SaveBar onSave={handleSave} saved={saved} error={error} />
    </div>
  );
}
