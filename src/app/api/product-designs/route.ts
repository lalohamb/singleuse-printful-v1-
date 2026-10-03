import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/product-designs?product_id=<uuid>
export async function GET(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const url = new URL(req.url);
  const productId = url.searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id required" }, { status: 400 });

  const { data, error } = await sb()
    .from("product_designs")
    .select("*, designs(id, name, slug, artwork_url, status)")
    .eq("product_id", productId)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product_designs: data });
}

// PATCH /api/product-designs — update design configuration or replace artwork
export async function PATCH(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    id: string;
    design_id?: string;
    placement?: string;
    technique?: string;
    configuration?: Record<string, unknown>;
    needs_regeneration?: boolean;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = sb();

  // If replacing design, verify new design is active
  if (body.design_id) {
    const { data: design } = await supabase
      .from("designs")
      .select("id, status")
      .eq("id", body.design_id)
      .maybeSingle();
    if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
    if (design.status === "archived")
      return NextResponse.json({ error: "Cannot attach archived design" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.design_id !== undefined) patch.design_id = body.design_id;
  if (body.placement !== undefined) patch.placement = body.placement;
  if (body.technique !== undefined) patch.technique = body.technique;
  if (body.configuration !== undefined) patch.configuration = body.configuration;
  if (body.needs_regeneration !== undefined) patch.needs_regeneration = body.needs_regeneration;

  const { data, error } = await supabase
    .from("product_designs")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product_design: data });
}
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: {
    product_id: string;
    design_id: string;
    placement: string;
    technique?: string;
    printfile_id?: string;
    is_primary?: boolean;
    configuration?: Record<string, unknown>;
  };

  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.product_id) return NextResponse.json({ error: "product_id required" }, { status: 400 });
  if (!body.design_id) return NextResponse.json({ error: "design_id required" }, { status: 400 });
  if (!body.placement) return NextResponse.json({ error: "placement required" }, { status: 400 });

  // Verify product exists
  const { data: product } = await sb().from("products").select("id, printful_id").eq("id", body.product_id).maybeSingle();
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Verify design exists and is active
  const { data: design } = await sb().from("designs").select("id, status").eq("id", body.design_id).maybeSingle();
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  if (design.status === "archived") return NextResponse.json({ error: "Cannot attach archived design" }, { status: 400 });

  const { data, error } = await sb().from("product_designs").insert({
    product_id: body.product_id,
    design_id: body.design_id,
    placement: body.placement,
    technique: body.technique || null,
    printfile_id: body.printfile_id || null,
    is_primary: body.is_primary ?? false,
    configuration: body.configuration ?? {},
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product_design: data }, { status: 201 });
}
