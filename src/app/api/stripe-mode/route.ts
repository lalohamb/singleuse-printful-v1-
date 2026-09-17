import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeSettings } from "@/lib/stripe-config";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const data = await getStripeSettings();
  return NextResponse.json({
    active_mode: data?.stripe_mode === "live" ? "live" : "test",
  });
}
