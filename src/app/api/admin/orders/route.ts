import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@supabase/supabase-js";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/admin/orders
// Body: { action: "confirm_printful" | "cancel_printful", order_id: string }
//
// confirm_printful:
//   Confirms a Printful DRAFT order, transitioning it to production.
//   Preconditions (all enforced server-side):
//     - order must exist
//     - order.status must be "paid"
//     - order.printful_order_id must be set
//     - Printful order must currently be in "draft" status
//     - fulfillment_snapshot must exist for catalog_builder orders
//   On success: updates printful_fulfillment_status to Printful's returned status.
//
// cancel_printful:
//   Cancels a Printful DRAFT order.
//   Preconditions:
//     - order must exist
//     - order.printful_order_id must be set
//     - Printful order must currently be in "draft" status
//   On success: updates fulfillment_status and printful_fulfillment_status to "cancelled".
//   Note: Printful only permits cancellation of draft orders. In-production orders
//   cannot be canceled via API — must be handled through Printful support.

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { action, order_id } = await req.json();

  if (!order_id || typeof order_id !== "string") {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }
  if (action !== "confirm_printful" && action !== "cancel_printful") {
    return NextResponse.json({ error: "action must be confirm_printful or cancel_printful" }, { status: 400 });
  }

  const supabase = sb();

  // Load order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, status, printful_order_id, fulfillment_snapshot, items, printful_fulfillment_status")
    .eq("id", order_id)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const printfulToken = process.env.PRINTFUL_API_TOKEN;
  if (!printfulToken) {
    return NextResponse.json({ error: "PRINTFUL_API_TOKEN not configured" }, { status: 500 });
  }

  if (!order.printful_order_id) {
    return NextResponse.json({ error: "No Printful order ID on this order — cannot confirm or cancel" }, { status: 400 });
  }

  // Fetch current Printful order status
  const pfRes = await fetch(`https://api.printful.com/orders/${order.printful_order_id}`, {
    headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
  });

  if (!pfRes.ok) {
    const errBody = await pfRes.text();
    return NextResponse.json(
      { error: `Printful returned ${pfRes.status}: ${errBody.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const pfData = await pfRes.json();
  const pfOrder = pfData.result;
  const pfStatus: string = pfOrder?.status ?? "";

  if (action === "confirm_printful") {
    // Precondition: local order must be paid
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: `Order status is "${order.status}" — only paid orders can be confirmed` },
        { status: 400 }
      );
    }

    // Precondition: Printful order must be draft
    if (pfStatus !== "draft") {
      return NextResponse.json(
        { error: `Printful order is "${pfStatus}" — only draft orders can be confirmed` },
        { status: 400 }
      );
    }

    // Precondition: fulfillment_snapshot must exist for catalog_builder items
    const items: any[] = order.items ?? [];
    const snapshots: Record<string, any> = order.fulfillment_snapshot ?? {};
    for (const item of items) {
      const variantId: string = item.store_variant_id ?? item.variant_id;
      const snap = snapshots[variantId];
      if (snap?.strategy === "DIRECT_CATALOG_ORDER" && !snap.artwork_url) {
        return NextResponse.json(
          { error: `Missing or invalid fulfillment snapshot for variant ${variantId} — cannot confirm` },
          { status: 400 }
        );
      }
    }

    // Confirm the Printful order
    const confirmRes = await fetch(`https://api.printful.com/orders/${order.printful_order_id}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
    });

    if (!confirmRes.ok) {
      const errBody = await confirmRes.text();
      return NextResponse.json(
        { error: `Printful confirm failed ${confirmRes.status}: ${errBody.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const confirmData = await confirmRes.json();
    const newStatus: string = confirmData.result?.status ?? "pending";

    await supabase
      .from("orders")
      .update({
        printful_fulfillment_status: newStatus,
        fulfillment_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return NextResponse.json({ ok: true, printful_status: newStatus });
  }

  if (action === "cancel_printful") {
    // Precondition: Printful order must be draft
    if (pfStatus !== "draft") {
      return NextResponse.json(
        {
          error: `Printful order is "${pfStatus}" — only draft orders can be canceled via API. ` +
            `For in-production orders, contact Printful support.`,
        },
        { status: 400 }
      );
    }

    const cancelRes = await fetch(`https://api.printful.com/orders/${order.printful_order_id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${printfulToken}`, "Content-Type": "application/json" },
    });

    if (!cancelRes.ok) {
      const errBody = await cancelRes.text();
      return NextResponse.json(
        { error: `Printful cancel failed ${cancelRes.status}: ${errBody.slice(0, 200)}` },
        { status: 502 }
      );
    }

    await supabase
      .from("orders")
      .update({
        printful_fulfillment_status: "cancelled",
        fulfillment_status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    return NextResponse.json({ ok: true, printful_status: "cancelled" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
