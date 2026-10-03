import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const BUCKET = "store-images";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/designs/promote
// Promotes a design's artwork from artwork/tmp/ to artwork/{design_id}/original.{ext}
// Uses copy-before-update: copies first, verifies, then updates the record.
// The old tmp/ object is NOT deleted — it remains as a safety backup.
// Historical order fulfillment_snapshots are NOT modified — they keep their frozen URLs.
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { design_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { design_id } = body;
  if (!design_id)
    return NextResponse.json({ error: "design_id is required" }, { status: 400 });

  const supabase = sb();

  // Load design
  const { data: design } = await supabase
    .from("designs")
    .select("id, artwork_url, storage_path, file_type, status")
    .eq("id", design_id)
    .maybeSingle();

  if (!design)
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  if (design.status !== "active")
    return NextResponse.json({ error: "Design is not active" }, { status: 400 });

  const currentPath: string = design.storage_path;

  // Already at permanent path — nothing to do
  if (!currentPath.startsWith("artwork/tmp/")) {
    return NextResponse.json({
      ok: true,
      already_permanent: true,
      storage_path: currentPath,
      artwork_url: design.artwork_url,
    });
  }

  const ext = design.file_type === "image/png" ? "png" : "jpg";
  const permanentPath = `artwork/${design_id}/original.${ext}`;

  // Step 1: Copy to permanent path
  const { error: copyError } = await supabase.storage
    .from(BUCKET)
    .copy(currentPath, permanentPath);

  if (copyError) {
    return NextResponse.json(
      { error: `Copy failed: ${copyError.message}` },
      { status: 500 }
    );
  }

  // Step 2: Verify destination exists
  const { data: verifyData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(permanentPath);

  if (!verifyData?.publicUrl) {
    return NextResponse.json(
      { error: "Copy succeeded but destination URL could not be verified" },
      { status: 500 }
    );
  }

  const permanentUrl = verifyData.publicUrl;

  // Step 3: Update design record to point to permanent path
  const { error: updateError } = await supabase
    .from("designs")
    .update({
      artwork_url: permanentUrl,
      storage_path: permanentPath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", design_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Record update failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Step 4: Update product_design configuration.artworkUrl for this design
  // (does NOT affect historical order fulfillment_snapshots — those are immutable)
  const { data: pds } = await supabase
    .from("product_designs")
    .select("id, configuration")
    .eq("design_id", design_id);

  for (const pd of pds ?? []) {
    const config = (pd.configuration as Record<string, unknown>) ?? {};
    if (config.artworkUrl === design.artwork_url) {
      await supabase.from("product_designs").update({
        configuration: { ...config, artworkUrl: permanentUrl },
        updated_at: new Date().toISOString(),
      }).eq("id", pd.id);
    }
  }

  // Old tmp/ object intentionally NOT deleted — safety backup
  return NextResponse.json({
    ok: true,
    already_permanent: false,
    original_path: currentPath,
    permanent_path: permanentPath,
    artwork_url: permanentUrl,
    note: "Original tmp/ object preserved as safety backup. Historical order snapshots unchanged.",
  });
}
