"use client";

import type { PrintfulVariant } from "@/lib/printful/types";

interface Props {
  variants: PrintfulVariant[];
  selectedId: number | null;
  onSelect: (variant: PrintfulVariant) => void;
}

export default function VariantSelector({ variants, selectedId, onSelect }: Props) {
  if (variants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {variants.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v)}
          className={`rounded border px-3 py-1 text-xs transition-colors ${
            selectedId === v.id
              ? "border-black bg-black text-white"
              : "border-gray-300 hover:border-black"
          }`}
        >
          {v.name}
        </button>
      ))}
    </div>
  );
}
