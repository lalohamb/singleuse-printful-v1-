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
let body: { name?: string; description?: string; tags?: string[]; status?: string; slug?: string; artwork_url?: string; storage_path?: string; file_name?: string; width?: number; height?: number; file_size?: number };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.tags !== undefined) patch.tags = body.tags;
  if (body.status !== undefined) patch.status = body.status;
  if (body.slug !== undefined) patch.slug = body.slug?.trim() || null;
  if (body.artwork_url !== undefined) patch.artwork_url = body.artwork_url;
  if (body.storage_path !== undefined) patch.storage_path = body.storage_path;
  if (body.file_name !== undefined) patch.file_name = body.file_name;
  if (body.width !== undefined) patch.width = body.width;
  if (body.height !== undefined) patch.height = body.height;
  if (body.file_size !== undefined) patch.file_size = body.file_size;
  if ((body as Record<string,unknown>).file_hash !== undefined) patch.file_hash = (body as Record<string,unknown>).file_hash;

  const { data, error } = await sb().from("designs").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data });
}
