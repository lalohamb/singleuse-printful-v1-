import { NextResponse } from "next/server";
import { getMockupTaskV2 } from "@/lib/printful/mockups";
import { getMockupTask } from "@/lib/printful/mockups";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

// GET /api/printful/mockups/[taskKey]
//
// V2 path (Catalog Builder): taskKey is a numeric string (e.g. "979231004")
//   Uses GET /v2/mockup-tasks?id={taskId}
//   Returns V2MockupTask with catalog_variant_mockups[].
//
// V1 legacy path (ProductDesigner): taskKey is a non-numeric string
//   Uses GET /mockup-generator/task?task_key={key}
//   Returns V1 PrintfulMockupTask with mockups[].
//
// Detection: if taskKey parses as a positive integer → V2; otherwise → V1.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskKey: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;
  const { taskKey } = await params;
  if (!taskKey || typeof taskKey !== "string" || taskKey.trim() === "") {
    return NextResponse.json({ error: "Invalid task key" }, { status: 400 });
  }

  const numericId = parseInt(taskKey, 10);
  const isV2 = Number.isFinite(numericId) && numericId > 0 && String(numericId) === taskKey.trim();

  if (isV2) {
    // V2 path: numeric task ID from POST /v2/mockup-tasks
    try {
      const task = await getMockupTaskV2(numericId);
      return NextResponse.json({ result: task });
    } catch (err) {
      if (err instanceof PrintfulApiError) {
        const status = err.isRateLimit ? 429 : err.status;
        return NextResponse.json({ error: err.clientMessage }, { status });
      }
      console.error("[printful/mockups/[taskKey] V2]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  // V1 legacy path: string task_key from POST /mockup-generator/create-task/{id}
  try {
    const task = await getMockupTask(taskKey);
    return NextResponse.json({ result: task });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      const status = err.isRateLimit ? 429 : err.status;
      return NextResponse.json({ error: err.clientMessage }, { status });
    }
    console.error("[printful/mockups/[taskKey] V1]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
