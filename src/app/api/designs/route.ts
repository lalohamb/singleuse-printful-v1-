import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { generateSlug } from "@/lib/catalog/types";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/designs — list all designs (admin only)
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "active";

  const query = sb().from("designs").select("*").order("created_at", { ascending: false });
  if (status !== "all") query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ designs: data });
}

// POST /api/designs — create a design record after artwork upload
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    name: string;
    description?: string;
    artwork_url: string;
    storage_path: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    width?: number;
    height?: number;
    tags?: string[];
    file_hash?: string;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!body.artwork_url?.startsWith("http")) return NextResponse.json({ error: "artwork_url must be an absolute URL" }, { status: 400 });
  if (!body.storage_path) return NextResponse.json({ error: "storage_path is required" }, { status: 400 });

  // Generate unique slug
  const baseSlug = generateSlug(body.name);
  let slug = baseSlug;
  let counter = 2;
  while (true) {
    const { data: existing } = await sb().from("designs").select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${counter++}`;
  }

  const { data, error } = await sb().from("designs").insert({
    name: body.name.trim(),
    slug,
    description: body.description?.trim() || null,
    artwork_url: body.artwork_url,
    storage_path: body.storage_path,
    file_name: body.file_name || null,
    file_type: body.file_type || null,
    file_size: body.file_size || null,
    width: body.width || null,
    height: body.height || null,
    tags: body.tags || [],
    file_hash: body.file_hash || null,
    status: "active",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ design: data }, { status: 201 });
}
