import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeSettings, setStripeMode } from "@/lib/stripe-config";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { mode } = await req.json();
  if (mode !== "live" && mode !== "test")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  // Ensure keys exist for the target mode before switching
  const settings = await getStripeSettings();
  const hasKeys = mode === "live"
    ? !!(settings?.stripe_live_secret_key && settings?.stripe_live_webhook_secret)
    : !!(settings?.stripe_test_secret_key && settings?.stripe_test_webhook_secret);

  if (!hasKeys)
    return NextResponse.json({ error: `No ${mode} keys saved. Save keys first.` }, { status: 400 });

  try {
    await setStripeMode(mode);
    return NextResponse.json({ ok: true, mode });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
