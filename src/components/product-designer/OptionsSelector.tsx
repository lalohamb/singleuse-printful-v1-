"use client";

interface Props {
  optionGroups: string[];
  options: string[];
  selectedGroups: string[];
  selectedOptions: string[];
  onGroupsChange: (groups: string[]) => void;
  onOptionsChange: (options: string[]) => void;
}

export default function OptionsSelector({
  optionGroups,
  options,
  selectedGroups,
  selectedOptions,
  onGroupsChange,
  onOptionsChange,
}: Props) {
  if (optionGroups.length === 0 && options.length === 0) return null;

  function toggleGroup(g: string) {
    onGroupsChange(
      selectedGroups.includes(g)
        ? selectedGroups.filter((x) => x !== g)
        : [...selectedGroups, g]
    );
  }

  function toggleOption(o: string) {
    onOptionsChange(
      selectedOptions.includes(o)
        ? selectedOptions.filter((x) => x !== o)
        : [...selectedOptions, o]
    );
  }

  return (
    <div className="space-y-3">
      {optionGroups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mockup styles</p>
          <div className="flex flex-wrap gap-2">
            {optionGroups.map((g) => (
              <button
                key={g}
                onClick={() => toggleGroup(g)}
                className={`rounded border px-3 py-1 text-xs transition-colors ${
                  selectedGroups.includes(g)
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-black"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {options.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Options</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => toggleOption(o)}
                className={`rounded border px-3 py-1 text-xs transition-colors ${
                  selectedOptions.includes(o)
                    ? "border-black bg-black text-white"
                    : "border-gray-300 hover:border-black"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
