"use client";

import { useEffect, useRef, useState } from "react";
import type { PrintfulMockupTask, V2MockupTask, MockupPollResult } from "@/lib/printful/types";

interface Props {
  taskKey: string;
  onComplete: (result: MockupPollResult) => void;
  onFailed: (error: string) => void;
}

const INITIAL_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30; // ~2 min timeout

// Adapt a raw V1 PrintfulMockupTask into MockupPollResult.
function adaptV1(raw: PrintfulMockupTask): MockupPollResult {
  return {
    source: "v1",
    status: raw.status,
    failureReason: raw.status === "failed" ? (raw.error ?? "Mockup generation failed.") : null,
    v1Task: raw.status === "completed" ? raw : null,
    v2Task: null,
  };
}

// Adapt a raw V2MockupTask into MockupPollResult.
function adaptV2(raw: V2MockupTask): MockupPollResult {
  return {
    source: "v2",
    status: raw.status,
    failureReason: raw.status === "failed" ? (raw.failure_reasons?.[0] ?? "Mockup generation failed.") : null,
    v1Task: null,
    v2Task: raw.status === "completed" ? raw : null,
  };
}

// Detect whether a taskKey is a V2 numeric ID (positive integer string).
function isV2TaskKey(key: string): boolean {
  const n = parseInt(key, 10);
  return Number.isFinite(n) && n > 0 && String(n) === key.trim();
}

export default function MockupStatus({ taskKey, onComplete, onFailed }: Props) {
  const [dots, setDots] = useState(".");
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dotTimer = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      500
    );

    async function poll() {
      if (pollCount.current >= MAX_POLLS) {
        onFailed("Mockup generation timed out. Please try again.");
        return;
      }
      pollCount.current += 1;

      try {
        const res = await fetch(`/api/printful/mockups/${encodeURIComponent(taskKey)}`);
        if (res.status === 429) {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS * 3);
          return;
        }
        const data = await res.json();
        const raw = data.result;

        // Adapt to normalized MockupPollResult based on task key type.
        // V2: numeric string → V2MockupTask (has failure_reasons[], catalog_variant_mockups[]).
        // V1: non-numeric string → PrintfulMockupTask (has error?, mockups[]).
        const result: MockupPollResult = isV2TaskKey(taskKey)
          ? adaptV2(raw as V2MockupTask)
          : adaptV1(raw as PrintfulMockupTask);

        if (result.status === "completed") {
          onComplete(result);
          return;
        }
        if (result.status === "failed") {
          onFailed(result.failureReason ?? "Mockup generation failed.");
          return;
        }
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    timerRef.current = setTimeout(poll, INITIAL_DELAY_MS);

    return () => {
      clearInterval(dotTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [taskKey, onComplete, onFailed]);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
      Generating mockup{dots}
    </div>
  );
}
