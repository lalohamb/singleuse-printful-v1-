import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/designs/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const { data, error } = await sb().from("designs").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Design not found" }, { status: 404 });

  // Include usage count
  const { count } = await sb().from("product_designs").select("id", { count: "exact", head: true }).eq("design_id", id);
  return NextResponse.json({ design: { ...data, usage_count: count ?? 0 } });
}

// PATCH /api/designs/[id] — update metadata (not artwork replacement)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  let body: { name?: string; description?: string; tags?: string[]; status?: string; slug?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.tags !== undefined) patch.tags = body.tags;
  if (body.status !== undefined) patch.status = body.status;
  if (body.slug !== undefined) patch.slug = body.slug?.trim() || null;

  const { data, error } = await sb().from("designs").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data });
}
