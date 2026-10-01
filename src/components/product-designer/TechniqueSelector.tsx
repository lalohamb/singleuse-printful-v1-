"use client";

import type { PrintfulTechnique } from "@/lib/printful/types";

interface Props {
  techniques: PrintfulTechnique[];
  selected: string | null;
  onSelect: (key: string) => void;
}

export default function TechniqueSelector({ techniques, selected, onSelect }: Props) {
  if (techniques.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {techniques.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`rounded border px-3 py-1 text-xs transition-colors ${
            selected === t.key
              ? "border-black bg-black text-white"
              : "border-gray-300 hover:border-black"
          }`}
        >
          {t.display_name}
        </button>
      ))}
    </div>
  );
}
