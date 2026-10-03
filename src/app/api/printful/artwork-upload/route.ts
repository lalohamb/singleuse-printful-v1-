import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { createHash } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "store-images";
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg"]);

export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Only PNG and JPEG are supported" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 50 MB" }, { status: 400 });
  }

  const designId = (formData.get("designId") as string | null)?.trim() || null;
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = designId
    ? `artwork/${designId}/original.${ext}`
    : `artwork/tmp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  // Compute SHA-256 for duplicate detection
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  // Check for existing active design with same hash
  const { data: existing } = await supabaseAdmin
    .from("designs")
    .select("id, name, artwork_url, width, height, file_size")
    .eq("file_hash", fileHash)
    .eq("status", "active")
    .neq("id", designId ?? "00000000-0000-0000-0000-000000000000")
    .limit(1)
    .maybeSingle();

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (error) {
    console.error("[artwork-upload]", error.message);
    return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({
    url: data.publicUrl,
    storage_path: path,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    file_hash: fileHash,
    // If a duplicate exists, surface it so the UI can warn the operator
    duplicate_design: existing ?? null,
  });
}
