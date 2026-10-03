import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/require-admin";

const sb = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

// POST /api/batches/[id]/bulk-update
// Bulk operations on generated products in this batch.
// Operations: set_category | set_price | set_price_adjustment
// Never modifies: provider identity, design identity, fulfillment_snapshot.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id: batchId } = await params;

  let body: {
    product_ids: string[];
    operation: "set_category" | "set_price" | "set_price_adjustment";
    category_id?: string;
    price?: number;
    adjustment_type?: "fixed" | "increase" | "decrease" | "percent";
    adjustment_value?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.product_ids) || body.product_ids.length === 0) {
    return NextResponse.json({ error: "product_ids array is required" }, { status: 400 });
  }
  if (!body.operation) {
    return NextResponse.json({ error: "operation is required" }, { status: 400 });
  }

  const supabase = sb();

  // Verify products belong to this batch
  const { data: products } = await supabase
    .from("products")
    .select("id, price, category_id, batch_id")
    .in("id", body.product_ids)
    .eq("batch_id", batchId);

  if (!products?.length) {
    return NextResponse.json({ error: "No matching products found in this batch" }, { status: 404 });
  }

  const now = new Date().toISOString();
  let updated = 0;
  const errors: string[] = [];

  if (body.operation === "set_category") {
    if (!body.category_id) {
      return NextResponse.json({ error: "category_id is required for set_category" }, { status: 400 });
    }
    // Server-side category validation
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("id", body.category_id)
      .maybeSingle();
    if (!cat) {
      return NextResponse.json({ error: `Category ${body.category_id} not found` }, { status: 400 });
    }

    for (const product of products) {
      const { error } = await supabase
        .from("products")
        .update({ category_id: body.category_id, updated_at: now })
        .eq("id", product.id);
      if (error) errors.push(`${product.id}: ${error.message}`);
      else updated++;
    }
  } else if (body.operation === "set_price") {
    if (typeof body.price !== "number" || body.price <= 0) {
      return NextResponse.json({ error: "price must be > 0 for set_price" }, { status: 400 });
    }
    for (const product of products) {
      const { error } = await supabase
        .from("products")
        .update({ price: body.price, updated_at: now })
        .eq("id", product.id);
      if (error) errors.push(`${product.id}: ${error.message}`);
      else updated++;
    }
  } else if (body.operation === "set_price_adjustment") {
    if (!body.adjustment_type || typeof body.adjustment_value !== "number") {
      return NextResponse.json({ error: "adjustment_type and adjustment_value required" }, { status: 400 });
    }
    for (const product of products) {
      let newPrice = product.price;
      if (body.adjustment_type === "fixed") {
        newPrice = body.adjustment_value;
      } else if (body.adjustment_type === "increase") {
        newPrice = product.price + body.adjustment_value;
      } else if (body.adjustment_type === "decrease") {
        newPrice = product.price - body.adjustment_value;
      } else if (body.adjustment_type === "percent") {
        newPrice = product.price * (1 + body.adjustment_value / 100);
      }
      newPrice = Math.round(newPrice * 100) / 100;
      if (newPrice <= 0) {
        errors.push(`${product.id}: adjustment would produce price <= 0`);
        continue;
      }
      const { error } = await supabase
        .from("products")
        .update({ price: newPrice, updated_at: now })
        .eq("id", product.id);
      if (error) errors.push(`${product.id}: ${error.message}`);
      else updated++;
    }
  } else {
    return NextResponse.json({ error: `Unknown operation: ${body.operation}` }, { status: 400 });
  }

  return NextResponse.json({ updated, errors: errors.length > 0 ? errors : undefined });
}
