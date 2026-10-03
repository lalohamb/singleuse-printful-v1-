import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/cancel
// Cancels remaining (non-generated) items. Does NOT delete generated products.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;
  const supabase = sb();

  const { data: batch } = await supabase
    .from("catalog_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();

  if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  if (batch.status === "cancelled") return NextResponse.json({ message: "Already cancelled" });

  const now = new Date().toISOString();

  // Cancel only items that haven't been generated yet
  await supabase
    .from("catalog_batch_items")
    .update({ status: "cancelled", updated_at: now })
    .eq("batch_id", batchId)
    .in("status", ["pending", "resolving", "resolved", "validated", "approved"]);

  await supabase
    .from("catalog_batches")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", batchId);

  return NextResponse.json({ cancelled: true });
}
