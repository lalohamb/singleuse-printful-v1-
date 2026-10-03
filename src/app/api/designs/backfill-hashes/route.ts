import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { createHash } from "crypto";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/designs/backfill-hashes
// Computes SHA-256 file_hash for all active designs where file_hash IS NULL.
// Fetches artwork bytes from Supabase Storage (public URL).
// Idempotent — skips designs that already have a hash.
// Body: { design_ids?: string[] }  — optional filter; omit to process all eligible
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { design_ids?: string[] } = {};
  try { body = await req.json(); } catch { /* optional body */ }

  const supabase = sb();

  // Fetch eligible designs
  let query = supabase
    .from("designs")
    .select("id, artwork_url, name")
    .eq("status", "active")
    .is("file_hash", null);

  if (body.design_ids?.length) {
    query = query.in("id", body.design_ids);
  }

  const { data: designs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!designs?.length) {
    return NextResponse.json({ message: "No eligible designs found", processed: 0, results: [] });
  }

  const results: Array<{
    id: string;
    name: string;
    status: "ok" | "error";
    file_hash?: string;
    error?: string;
  }> = [];

  const now = new Date().toISOString();

  for (const design of designs) {
    try {
      // Fetch artwork bytes
      const res = await fetch(design.artwork_url);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching artwork`);
      const buffer = await res.arrayBuffer();
      const hash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");

      await supabase
        .from("designs")
        .update({ file_hash: hash, updated_at: now })
        .eq("id", design.id);

      results.push({ id: design.id, name: design.name, status: "ok", file_hash: hash });
    } catch (err) {
      results.push({
        id: design.id,
        name: design.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ processed: designs.length, ok, failed, results });
}
