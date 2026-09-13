"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const BUCKET = "store-images";
const FOLDERS = ["settings/about", "settings/story", "settings/hero", "settings/our-why", "uploads", "settings/logo", "settings/popup"];

type ImageItem = { title: string; url: string };

export default function ProductImagePicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"products" | "library">("products");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data: products } = await supabase
      .from("products")
      .select("title, image_url, images");

    const result: ImageItem[] = [];
    for (const p of products || []) {
      if (p.image_url) result.push({ title: p.title, url: p.image_url });
      for (const img of p.images || []) {
        const url = typeof img === "string" ? img : img?.src || img?.url;
        if (url && url !== p.image_url) result.push({ title: p.title, url });
      }
    }
    setItems(result);
    setSource("products");
    setLoading(false);
  }

  async function loadLibrary() {
    setLoading(true);
    const result: ImageItem[] = [];
    for (const folder of FOLDERS) {
      const { data: files } = await supabase.storage.from(BUCKET).list(folder, { sortBy: { column: "created_at", order: "desc" } });
      for (const file of files || []) {
        if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${file.name}`);
        result.push({ title: file.name, url: urlData.publicUrl });
      }
    }
    setItems(result);
    setSource("library");
    setLoading(false);
  }

  const filtered = items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
          <h3 className="font-semibold text-secondary-900">Pick an Image</h3>
          <button type="button" onClick={onClose} className="text-secondary-400 hover:text-secondary-700 text-xl leading-none">&times;</button>
        </div>
        <div className="p-4 border-b border-secondary-100 flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="input-field flex-1" />
          <button
            type="button"
            onClick={() => source === "products" ? loadLibrary() : loadProducts()}
            className="btn-outline py-2 px-3 text-sm flex-shrink-0"
          >
            {source === "products" ? "📁 Media Library" : "🛍️ Products"}
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-secondary-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-secondary-400 text-sm space-y-2">
              <p>No images found.</p>
              <button type="button" onClick={() => source === "products" ? loadLibrary() : loadProducts()} className="btn-outline py-1.5 text-xs">
                Try {source === "products" ? "Media Library" : "Products"} instead
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {filtered.map((item, i) => (
                <button key={`${item.url}-${i}`} type="button" title={item.title}
                  onClick={() => onSelect(item.url)}
                  className="aspect-square rounded-lg border-2 border-transparent hover:border-gold-500 transition-colors p-1"
                >
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover rounded" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
