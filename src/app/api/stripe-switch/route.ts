import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeSettings, setStripeMode } from "@/lib/stripe-config";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

async function pushSecretsToSupabase(secretKey: string, webhookSecret: string) {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !accessToken) throw new Error("SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN not set");
  if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error("Invalid SUPABASE_PROJECT_REF format");

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { name: "STRIPE_SECRET_KEY", value: secretKey },
        { name: "STRIPE_WEBHOOK_SECRET", value: webhookSecret },
      ]),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase secrets update failed: ${res.status} ${text}`);
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { mode } = await req.json();
  if (mode !== "live" && mode !== "test")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  // Ensure keys exist for the target mode before switching
  const settings = await getStripeSettings();
  const secretKey = mode === "live" ? settings?.stripe_live_secret_key : settings?.stripe_test_secret_key;
  const webhookSecret = mode === "live" ? settings?.stripe_live_webhook_secret : settings?.stripe_test_webhook_secret;

  if (!secretKey)
    return NextResponse.json({ error: `No ${mode} keys saved. Save keys first.` }, { status: 400 });

  try {
    await pushSecretsToSupabase(secretKey, webhookSecret ?? "");
    await setStripeMode(mode);
    return NextResponse.json({ ok: true, mode });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
  }
}
