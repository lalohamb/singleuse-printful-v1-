import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// GET /api/batches — list batches
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let query = sb()
    .from("catalog_batches")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach item counts per batch
  const ids = (data ?? []).map((b) => b.id);
  const counts: Record<string, Record<string, number>> = {};
  if (ids.length) {
    const { data: items } = await sb()
      .from("catalog_batch_items")
      .select("batch_id, status, validation_class")
      .in("batch_id", ids);

    for (const item of items ?? []) {
      if (!counts[item.batch_id]) counts[item.batch_id] = {};
      counts[item.batch_id].total = (counts[item.batch_id].total ?? 0) + 1;
      if (item.validation_class) {
        const k = item.validation_class.toLowerCase();
        counts[item.batch_id][k] = (counts[item.batch_id][k] ?? 0) + 1;
      }
      if (item.status === "generated" || item.status === "mockup_complete" || item.status === "review" || item.status === "published") {
        counts[item.batch_id].generated = (counts[item.batch_id].generated ?? 0) + 1;
      }
      if (item.status === "published") {
        counts[item.batch_id].published = (counts[item.batch_id].published ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    batches: (data ?? []).map((b) => ({ ...b, counts: counts[b.id] ?? {} })),
  });
}

// POST /api/batches — create a new batch
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { name: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await sb()
    .from("catalog_batches")
    .insert({
      name: body.name.trim(),
      status: "draft",
      metadata: body.metadata ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batch: data }, { status: 201 });
}
