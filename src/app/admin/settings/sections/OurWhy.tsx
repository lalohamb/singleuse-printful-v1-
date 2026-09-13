"use client";
import ImageUpload from "@/components/ImageUpload";
import ProductImagePicker from "../ProductImagePicker";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { useState } from "react";

const GRAD_DIRS = ["left","right","center","top","bottom","full","none"] as const;

export default function OurWhy() {
  const { form, set, save, saved, error } = useSettings();
  const [ourWhyPreviewH, setOurWhyPreviewH] = useState(400);
  const [showPicker, setShowPicker] = useState(false);

  const pos = (form.our_why_object_position || "0px 0px").replace(/px/g, "").split(" ");
  const x = parseInt(pos[0]) || 0;
  const y = parseInt(pos[1]) || 0;
  const setPos = (nx: number, ny: number) => set("our_why_object_position", `${nx}px ${ny}px`);
  const op = (form.our_why_gradient_opacity ?? 70) / 100;
  const dir = form.our_why_gradient_dir || "left";
  const gradMap: Record<string, string> = {
    left:   `linear-gradient(to right, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    right:  `linear-gradient(to left, rgba(17,17,17,${op}) 0%, rgba(17,17,17,${op*0.6}) 50%, transparent 100%)`,
    center: `linear-gradient(to bottom, rgba(17,17,17,${op*0.6}) 0%, rgba(17,17,17,${op}) 50%, rgba(17,17,17,${op*0.6}) 100%)`,
    top:    `linear-gradient(to bottom, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    bottom: `linear-gradient(to top, rgba(17,17,17,${op}) 0%, transparent 100%)`,
    full:   `rgba(17,17,17,${op})`,
    none:   "transparent",
  };

  const handleSave = () => save({
    our_why_label: form.our_why_label,
    our_why_quote: form.our_why_quote,
    our_why_body: form.our_why_body,
    our_why_image_url: form.our_why_image_url,
    our_why_object_position: form.our_why_object_position,
    our_why_height_vh: ourWhyPreviewH,
    our_why_image_scale: form.our_why_image_scale,
    our_why_image_flip: form.our_why_image_flip,
    our_why_image_fit: form.our_why_image_fit,
    our_why_gradient_opacity: form.our_why_gradient_opacity,
    our_why_gradient_dir: form.our_why_gradient_dir,
  });

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="label-text">Label</label>
        <input value={form.our_why_label || ""} onChange={(e) => set("our_why_label", e.target.value)} placeholder="Our Why" className="input-field" />
      </div>
      <div>
        <label className="label-text">Quote</label>
        <input value={form.our_why_quote || ""} onChange={(e) => set("our_why_quote", e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="label-text">Body Text</label>
        <textarea value={form.our_why_body || ""} onChange={(e) => set("our_why_body", e.target.value)} className="input-field min-h-[120px]" />
      </div>
      <ImageUpload label="Our Why Image" value={form.our_why_image_url || ""} onChange={(url) => set("our_why_image_url", url)} folder="settings/our-why" preview={false} />
      <button type="button" onClick={() => setShowPicker(true)} className="btn-outline py-2 text-sm">📷 Pick from Product Library</button>
      {showPicker && <ProductImagePicker onSelect={(url) => { set("our_why_image_url", url); setShowPicker(false); }} onClose={() => setShowPicker(false)} />}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500 w-16">X: {x}px</span>
          <input type="range" min={-1000} max={1000} value={x} onChange={(e) => setPos(Number(e.target.value), y)} className="flex-1 accent-gold-500" />
        </div>
        {form.our_why_image_url && (
          <div className="flex gap-2 items-stretch">
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
              <span className="text-[10px]">▲</span>
              <input type="range" min={200} max={800} value={ourWhyPreviewH} onChange={(e) => setOurWhyPreviewH(Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
              <span className="text-[10px]">▼</span>
              <span className="text-[10px] text-secondary-500">{ourWhyPreviewH}px</span>
            </div>
            <div className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden" style={{ height: ourWhyPreviewH / 2 }}>
              <img src={form.our_why_image_url} alt="Our Why preview" className={`absolute inset-0 w-full h-full ${form.our_why_image_fit === "contain" ? "object-contain" : (form.our_why_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: form.our_why_object_position || "center", transform: form.our_why_image_flip ? "scaleX(-1)" : undefined, scale: `${form.our_why_image_scale ?? 100}%` }} />
              <div className="absolute inset-0" style={{ background: gradMap[dir] }} />
              <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">Live preview</span>
            </div>
            <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
              <span className="text-[10px]">▲</span>
              <input type="range" min={-1000} max={1000} value={y} onChange={(e) => setPos(x, Number(e.target.value))} className="flex-1 accent-gold-500" style={{ writingMode: "vertical-lr", direction: "rtl", width: 28, cursor: "ns-resize" }} />
              <span className="text-[10px]">▼</span>
              <span className="text-[10px] text-secondary-500">{y}px</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs w-24">Zoom: {form.our_why_image_scale ?? 100}%</span>
          <input type="range" min={10} max={100} value={form.our_why_image_scale ?? 100} onChange={(e) => set("our_why_image_scale", Number(e.target.value))} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs w-24">Overlay: {form.our_why_gradient_opacity ?? 70}%</span>
          <input type="range" min={0} max={100} value={form.our_why_gradient_opacity ?? 70} onChange={(e) => set("our_why_gradient_opacity", Number(e.target.value))} className="flex-1 accent-gold-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs w-24">Gradient</span>
          {GRAD_DIRS.map((d) => <button key={d} type="button" onClick={() => set("our_why_gradient_dir", d)} className={`text-xs px-2 py-1 rounded border capitalize ${dir === d ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{d}</button>)}
        </div>
        <div className="flex items-center gap-2">
          {["cover","contain"].map((v) => <button key={v} type="button" onClick={() => set("our_why_image_fit", v)} className={`text-xs px-2 py-1 rounded border capitalize ${(form.our_why_image_fit || "cover") === v ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>{v}</button>)}
          <button type="button" onClick={() => set("our_why_image_flip", !form.our_why_image_flip)} className={`text-xs px-2 py-1 rounded border ${form.our_why_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}>⇄ Flip</button>
          <button type="button" onClick={() => { set("our_why_object_position","0px 0px"); set("our_why_image_scale",100); set("our_why_image_flip",false); set("our_why_gradient_opacity",70); set("our_why_gradient_dir","left"); set("our_why_image_fit","cover"); setOurWhyPreviewH(400); }} className="btn-outline py-1 text-xs">Reset</button>
        </div>
      </div>
      <SaveBar onSave={handleSave} saved={saved} error={error} />
    </div>
  );
}
