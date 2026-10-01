import { NextResponse } from "next/server";
import { getMockupTask } from "@/lib/printful/mockups";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

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

  try {
    const task = await getMockupTask(taskKey);
    return NextResponse.json({ result: task });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      const status = err.isRateLimit ? 429 : err.status;
      return NextResponse.json({ error: err.clientMessage }, { status });
    }
    console.error("[printful/mockups/[taskKey]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
