"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProductImagePicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [products, setProducts] = useState<{ title: string; image_url: string | null }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("products").select("title, image_url").eq("status", "active").then(({ data }) => {
      if (data) setProducts(data as { title: string; image_url: string | null }[]);
    });
  }, []);

  const filtered = products.filter((product) => product.image_url && product.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-secondary-100">
          <h3 className="font-semibold text-secondary-900">Pick a Product Image</h3>
          <button type="button" onClick={onClose} className="text-secondary-400 hover:text-secondary-700 text-xl leading-none" aria-label="Close image picker">&times;</button>
        </div>
        <div className="p-4 border-b border-secondary-100"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="input-field" /></div>
        <div className="overflow-y-auto p-4 grid grid-cols-5 gap-2">
          {filtered.map((product, index) => <button key={`${product.title}-${index}`} type="button" title={product.title} onClick={() => onSelect(product.image_url!)} className="aspect-square rounded-lg border-2 border-transparent hover:border-gold-500 transition-colors p-1"><img src={product.image_url!} alt={product.title} className="w-full h-full object-cover rounded" /></button>)}
        </div>
      </div>
    </div>
  );
}
