import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { requireAdmin } from "@/lib/require-admin";
import { appRoot, parseEnvFile, writeEnvFile } from "@/lib/env-utils";

export const runtime = "nodejs";

// POST — body: { action: "save-keys", mode: "live"|"test", secret_key, webhook_secret }
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { action, mode, secret_key, webhook_secret } = await req.json();
  if (action !== "save-keys") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (mode !== "live" && mode !== "test") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (!secret_key || !webhook_secret) return NextResponse.json({ error: "Both keys are required" }, { status: 400 });

  const root = appRoot();
  const filePath = path.resolve(root, mode === "live" ? ".env.live" : ".env.test");
  writeEnvFile(filePath, { ...parseEnvFile(filePath), STRIPE_SECRET_KEY: secret_key, STRIPE_WEBHOOK_SECRET: webhook_secret });
  return NextResponse.json({ ok: true, message: `${mode} keys saved` });
}

// GET — return saved key hints and active mode
// All three files resolved via the same appRoot() so hasKeys and active_mode always agree.
export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const root = appRoot();
  const liveEnv   = parseEnvFile(path.resolve(root, ".env.live"));
  const testEnv   = parseEnvFile(path.resolve(root, ".env.test"));
  const activeEnv = parseEnvFile(path.resolve(root, ".env.local"));

  const mask = (k: string) => k ? `${k.slice(0, 12)}...${k.slice(-4)}` : "";
  return NextResponse.json({
    live: { hasKeys: !!(liveEnv.STRIPE_SECRET_KEY && liveEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(liveEnv.STRIPE_SECRET_KEY), webhook_hint: mask(liveEnv.STRIPE_WEBHOOK_SECRET) },
    test: { hasKeys: !!(testEnv.STRIPE_SECRET_KEY && testEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(testEnv.STRIPE_SECRET_KEY), webhook_hint: mask(testEnv.STRIPE_WEBHOOK_SECRET) },
    active_mode: activeEnv.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test",
  });
}
