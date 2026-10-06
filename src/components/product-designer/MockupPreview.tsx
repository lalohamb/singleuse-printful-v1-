"use client";

import { useState } from "react";
import type { MockupPollResult } from "@/lib/printful/types";

interface Props {
  result: MockupPollResult;
  onReset: () => void;
}

export default function MockupPreview({ result, onReset }: Props) {
  // Normalize mockup list from either V1 or V2 result shape.
  // V1: result.v1Task.mockups[] — each has placement, mockup_url, extra[], option, option_group
  // V2: result.v2Task.catalog_variant_mockups[].mockups[] — each has placement, mockup_url
  const mockups: Array<{
    placement: string;
    mockup_url: string;
    option: string | null;
    option_group: string | null;
    extra: Array<{ title: string; url: string }>;
  }> = result.source === "v1" && result.v1Task
    ? (result.v1Task.mockups ?? []).map((m) => ({
        placement: m.placement,
        mockup_url: m.mockup_url,
        option: m.option,
        option_group: m.option_group,
        extra: m.extra,
      }))
    : result.source === "v2" && result.v2Task
    ? result.v2Task.catalog_variant_mockups.flatMap((cvm) =>
        cvm.mockups.map((m) => ({
          placement: m.placement,
          mockup_url: m.mockup_url,
          option: null,
          option_group: null,
          extra: [],
        }))
      )
    : [];

  // taskKey for persist: V1 uses task_key string; V2 uses numeric id as string.
  const persistKey = result.source === "v1" && result.v1Task
    ? result.v1Task.task_key
    : result.source === "v2" && result.v2Task
    ? String(result.v2Task.id)
    : null;

  const [persisting, setPersisting] = useState(false);
  const [persistedUrls, setPersistedUrls] = useState<string[] | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);

  const groups = Array.from(
    new Set(mockups.map((m) => m.option_group ?? "Default"))
  );
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] ?? "Default");

  const visible = mockups.filter(
    (m) => (m.option_group ?? "Default") === activeGroup
  );

  async function handlePersist() {
    if (!persistKey) return;
    setPersisting(true);
    setPersistError(null);
    try {
      const res = await fetch("/api/printful/mockups/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskKey: persistKey }),
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

      <div className="border-t border-gray-100 pt-4 space-y-2">
        {persistedUrls ? (
          <p className="text-xs text-green-600">
            ✓ {persistedUrls.length} mockup{persistedUrls.length !== 1 ? "s" : ""} saved to storage.
          </p>
        ) : persistKey ? (
          <button
            onClick={handlePersist}
            disabled={persisting}
            className="rounded border border-gray-300 px-4 py-2 text-xs hover:border-black disabled:opacity-50"
          >
            {persisting ? "Saving…" : "Save mockups to storage"}
          </button>
        ) : null}
        {persistError && (
          <p className="text-xs text-red-500">{persistError}</p>
        )}
      </div>
    </div>
  );
}
