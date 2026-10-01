import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

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

  // designId may be provided to scope the path under a known design UUID.
  // If not provided, a temporary path is used (for the designer preview flow).
  const designId = (formData.get("designId") as string | null)?.trim() || null;
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = designId
    ? `artwork/${designId}/original.${ext}`
    : `artwork/tmp/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

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
  });
}
