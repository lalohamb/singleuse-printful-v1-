import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMockupTask } from "@/lib/printful/mockups";
import { persistGeneratedMockups } from "@/lib/printful/persist";
import { PrintfulApiError } from "@/lib/printful/errors";
import { requireAdmin } from "@/lib/require-admin";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { taskKey: string; productId?: string; productDesignId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { taskKey, productId, productDesignId } = body;
  if (!taskKey || typeof taskKey !== "string" || taskKey.trim() === "") {
    return NextResponse.json({ error: "Invalid taskKey" }, { status: 400 });
  }

  try {
    const task = await getMockupTask(taskKey);

    if (task.status !== "completed") {
      return NextResponse.json(
        { error: `Task is not completed (status: ${task.status})` },
        { status: 400 }
      );
    }

    if (!task.mockups || task.mockups.length === 0) {
      return NextResponse.json({ error: "No mockups to persist" }, { status: 400 });
    }

    const persisted = await persistGeneratedMockups(task.mockups, taskKey);

    // If productId provided, create product_images records for each persisted mockup.
    // Deduplication enforced by DB unique index uq_product_images_mockup_storage
    // (product_id, mockup_task_key, storage_path) — ON CONFLICT DO NOTHING.
    if (productId) {
      const supabase = sb();
      for (let i = 0; i < persisted.length; i++) {
        const m = persisted[i];
        const storagePath = m.stored_url.split("/store-images/")[1] ?? null;
        await supabase.from("product_images").upsert({
          product_id: productId,
          source: "printful_mockup",
          storage_path: storagePath,
          image_url: m.stored_url,
          alt_text: null,
          is_primary: i === 0,
          display_order: i,
          mockup_task_key: taskKey,
        }, { onConflict: "uq_product_images_mockup_storage", ignoreDuplicates: true });
      }

      // Update mockup_task status if tracked
      await supabase
        .from("mockup_tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("provider_task_key", taskKey);
    }

    return NextResponse.json({ result: persisted });
  } catch (err) {
    if (err instanceof PrintfulApiError) {
      return NextResponse.json({ error: err.clientMessage }, { status: err.status });
    }
    console.error("[printful/mockups/persist]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
