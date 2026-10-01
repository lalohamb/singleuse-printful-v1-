"use client";

import { useEffect, useRef, useState } from "react";
import type { PrintfulMockupTask } from "@/lib/printful/types";

interface Props {
  taskKey: string;
  onComplete: (task: PrintfulMockupTask) => void;
  onFailed: (error: string) => void;
}

const INITIAL_DELAY_MS = 3000;
const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 30; // ~2 min timeout

export default function MockupStatus({ taskKey, onComplete, onFailed }: Props) {
  const [dots, setDots] = useState(".");
  const pollCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Animate dots
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
          // Back off on rate limit
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS * 3);
          return;
        }
        const data = await res.json();
        const task: PrintfulMockupTask = data.result;

        if (task.status === "completed") {
          onComplete(task);
          return;
        }
        if (task.status === "failed") {
          onFailed(task.error ?? "Mockup generation failed.");
          return;
        }
        // still pending
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
