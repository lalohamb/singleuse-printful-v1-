"use client";

import { useState } from "react";
import type { PrintfulMockupTask } from "@/lib/printful/types";

interface Props {
  task: PrintfulMockupTask;
  onReset: () => void;
}

export default function MockupPreview({ task, onReset }: Props) {
  const mockups = task.mockups ?? [];
  const [persisting, setPersisting] = useState(false);
  const [persistedUrls, setPersistedUrls] = useState<string[] | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  // Collect unique option_groups for filter tabs (null → "Default")
  const groups = Array.from(
    new Set(mockups.map((m) => m.option_group ?? "Default"))
  );
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] ?? "Default");

  const visible = mockups.filter(
    (m) => (m.option_group ?? "Default") === activeGroup
  );

  async function handlePersist() {
    setPersisting(true);
    setPersistError(null);
    try {
      const res = await fetch("/api/printful/mockups/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey: task.task_key }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPersistedUrls((data.result as { stored_url: string }[]).map((r) => r.stored_url));
    } catch (e) {
      setPersistError(e instanceof Error ? e.message : "Persist failed");
    } finally {
      setPersisting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Generated Mockups</h3>
        <button
          onClick={onReset}
          className="text-xs text-gray-500 underline hover:text-black"
        >
          Start over
        </button>
      </div>

      {/* Option group filter tabs — only shown when more than one group */}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`rounded border px-3 py-1 text-xs transition-colors ${
                activeGroup === g
                  ? "border-black bg-black text-white"
                  : "border-gray-300 hover:border-black"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Mockup images */}
      {visible.map((m, i) => (
        <div key={i} className="space-y-2">
          <p className="text-xs font-medium capitalize text-gray-600">
            {m.placement}
            {m.option && (
              <span className="ml-2 text-gray-400">· {m.option}</span>
            )}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.mockup_url}
            alt={`Mockup — ${m.placement}`}
            className="w-full rounded border border-gray-200 object-contain"
          />
          {m.extra.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {m.extra.map((e, j) => (
                <div key={j} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={e.url}
                    alt={e.title}
                    className="h-20 w-20 rounded border border-gray-200 object-contain"
                  />
                  <p className="mt-0.5 text-center text-xs text-gray-500">{e.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Persist boundary */}
      <div className="border-t border-gray-100 pt-4 space-y-2">
        {persistedUrls ? (
          <p className="text-xs text-green-600">
            ✓ {persistedUrls.length} mockup{persistedUrls.length !== 1 ? "s" : ""} saved to storage.
          </p>
        ) : (
          <button
            onClick={handlePersist}
            disabled={persisting}
            className="rounded border border-gray-300 px-4 py-2 text-xs hover:border-black disabled:opacity-50"
          >
            {persisting ? "Saving…" : "Save mockups to storage"}
          </button>
        )}
        {persistError && (
          <p className="text-xs text-red-500">{persistError}</p>
        )}
      </div>
    </div>
  );
}
