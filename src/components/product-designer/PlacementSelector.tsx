"use client";

interface Props {
  placements: Record<string, string>; // placement key → display label
  selected: string | null;
  conflicting: string[];
  onSelect: (placement: string) => void;
}

export default function PlacementSelector({
  placements,
  selected,
  conflicting,
  onSelect,
}: Props) {
  const entries = Object.entries(placements);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, label]) => {
        const isConflict = conflicting.includes(key);
        return (
          <button
            key={key}
            onClick={() => !isConflict && onSelect(key)}
            disabled={isConflict}
            title={isConflict ? "Conflicts with current selection" : undefined}
            className={`rounded border px-3 py-1 text-xs transition-colors ${
              selected === key
                ? "border-black bg-black text-white"
                : isConflict
                ? "cursor-not-allowed border-gray-200 text-gray-300"
                : "border-gray-300 hover:border-black"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
