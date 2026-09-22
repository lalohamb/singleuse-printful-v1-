import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeSettings } from "@/lib/stripe-config";
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

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { mode } = await req.json();
  if (mode !== "live" && mode !== "test")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  try {
    const settings = await getStripeSettings();
    if (!settings) return NextResponse.json({ error: "Settings not found" }, { status: 404 });

    const clear = mode === "live"
      ? { stripe_live_secret_key: null, stripe_live_webhook_secret: null }
      : { stripe_test_secret_key: null, stripe_test_webhook_secret: null };

    const { error } = await sb().from("settings").update(clear).eq("id", settings.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, mode });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
