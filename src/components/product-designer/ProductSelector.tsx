"use client";

import { useEffect, useState } from "react";
import type { PrintfulProduct, V2CatalogProduct } from "@/lib/printful/types";

interface Props {
  onSelect: (product: V2CatalogProduct) => void;
}

// ProductSelector is used by the legacy ProductDesigner.
// It calls /api/printful/products which now returns V2CatalogProduct[].
// V2CatalogProduct has all fields ProductDesigner needs from the list:
// id, title, image, techniques. It does NOT have currency, files, options.
// ProductDesigner only reads id, title, image, techniques from the list — safe.
export default function ProductSelector({ onSelect }: Props) {
  const [products, setProducts] = useState<V2CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/printful/products")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setProducts(d.result ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading catalog…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(p)}
          className="rounded border border-gray-200 p-2 text-left hover:border-black transition-colors"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.image} alt={p.title} className="mb-1 h-24 w-full object-contain" />
          <p className="text-xs font-medium leading-tight">{p.title}</p>
        </button>
      ))}
    </div>
  );
}
