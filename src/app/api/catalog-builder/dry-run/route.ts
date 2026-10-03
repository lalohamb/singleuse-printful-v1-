import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";
import { dryRunProductSpecification, validateProductSpecification } from "@/lib/catalog/product-engine";
import type { ProductSpecification } from "@/lib/catalog/product-engine";

// POST /api/catalog-builder/dry-run
// Admin-only. Validates a ProductSpecification and returns the resolved plan.
// NO database mutations. NO Printful orders. NO Stripe activity.
export async function POST(req: Request) {
  const authError = await requireAdmin();
  if (authError) return authError;

  let spec: ProductSpecification;
  try {
    spec = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Structural validation
  const structuralResult = validateProductSpecification(spec);

  // If structurally invalid, return immediately — no DB lookups needed
  if (!structuralResult.valid) {
    return NextResponse.json({
      dry_run: true,
      valid: false,
      errors: structuralResult.errors,
      resolved: null,
    });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dbErrors: typeof structuralResult.errors = [];

  // Validate design exists and is active
  const { data: design } = await sb
    .from("designs")
    .select("id, status, artwork_url, width, height, file_size")
    .eq("id", spec.design_id)
    .maybeSingle();

  if (!design)
    dbErrors.push({ field: "design_id", message: "Design not found" });
  else if (design.status !== "active")
    dbErrors.push({ field: "design_id", message: "Design is not active" });
  else if (!design.artwork_url)
    dbErrors.push({ field: "design_id", message: "Design has no artwork URL" });

  // Validate slug uniqueness
  const { data: slugConflict } = await sb
    .from("products")
    .select("id")
    .eq("slug", spec.slug)
    .maybeSingle();

  if (slugConflict)
    dbErrors.push({ field: "slug", message: `Slug "${spec.slug}" is already in use` });

  // Validate category if provided
  if (spec.category_id) {
    const { data: cat } = await sb
      .from("categories")
      .select("id")
      .eq("id", spec.category_id)
      .maybeSingle();
    if (!cat)
      dbErrors.push({ field: "design_id", message: `Category ${spec.category_id} not found` });
  }

  if (dbErrors.length > 0) {
    return NextResponse.json({
      dry_run: true,
      valid: false,
      errors: dbErrors,
      resolved: null,
    });
  }

  // All checks passed — compute dry-run plan
  const result = dryRunProductSpecification(spec);

  return NextResponse.json({
    dry_run: true,
    ...result,
    design_info: design ? {
      name: (design as Record<string,unknown>).name,
      dimensions: design.width && design.height ? `${design.width}×${design.height}` : null,
      file_size_mb: design.file_size ? (design.file_size / 1024 / 1024).toFixed(1) : null,
    } : null,
  });
}
