import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { appRoot, parseEnvFile, writeEnvFile } from "@/lib/env-utils";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const execAsync = promisify(exec);

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "payment_intent.payment_failed",
];

function getWebhookUrl(): string {
  return `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`;
}

async function pushSupabaseSecrets(secretKey: string, webhookSecret: string): Promise<string> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return "skipped — SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF not set";
  if (!/^[a-z0-9-]{1,40}$/.test(ref))
    throw new Error("Invalid SUPABASE_PROJECT_REF format");
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      { name: "STRIPE_SECRET_KEY", value: secretKey },
      { name: "STRIPE_WEBHOOK_SECRET", value: webhookSecret },
    ]),
  });
  if (!r.ok) throw new Error(`Supabase secrets update failed: ${await r.text()}`);
  return "updated";
}

function activateMode(root: string, secretKey: string, webhookSecret: string) {
  const localPath = path.resolve(root, ".env.local");
  const env = parseEnvFile(localPath);
  env.STRIPE_SECRET_KEY = secretKey;
  env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  const content = Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(localPath, content, "utf8");
  const standalonePath = path.resolve(process.cwd(), ".env.local");
  if (standalonePath !== localPath && fs.existsSync(path.dirname(standalonePath))) {
    fs.writeFileSync(standalonePath, content, "utf8");
  }
}

function safePm2AppName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "myapp";
}

function restartPM2(root: string) {
  const ecoPath = path.resolve(root, "ecosystem.config.js");
  const appName = safePm2AppName(process.env.PM2_APP_NAME ?? "myapp");
  setTimeout(async () => {
    try {
      if (fs.existsSync(ecoPath)) await execAsync(`/usr/bin/pm2 startOrReload ${ecoPath} --update-env`);
      else await execAsync(`/usr/bin/pm2 restart ${appName} --update-env`);
    } catch { /* not running under PM2 */ }
  }, 300);
}

/**
 * POST /api/stripe-setup
 * Body: { secret_key: string, activate?: boolean }
 *
 * Atomic chain:
 *   1. Validate key format
 *   2. Register webhook in Stripe (reuse if already exists)
 *   3. Save secret_key + webhook_secret to .env.live or .env.test
 *   4. Push both to Supabase Edge Function secrets
 *   5. If activate=true: write to .env.local + restart PM2
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { secret_key, activate = false } = await req.json();

  if (!secret_key)
    return NextResponse.json({ error: "secret_key is required" }, { status: 400 });
  if (!secret_key.startsWith("sk_live_") && !secret_key.startsWith("sk_test_"))
    return NextResponse.json({ error: "Invalid key — must start with sk_live_ or sk_test_" }, { status: 400 });

  const mode: "live" | "test" = secret_key.startsWith("sk_live_") ? "live" : "test";
  const steps: string[] = [];
  const root = appRoot();

  try {
    // 2. Register or reuse webhook
    const client = new Stripe(secret_key, { apiVersion: "2026-08-26.dahlia" });
    const webhookUrl = getWebhookUrl();
    const existing = await client.webhookEndpoints.list({ limit: 20 });
    const match = existing.data.find((ep) => ep.url === webhookUrl);

    let webhookSecret: string;

    if (match) {
      // Stripe never re-exposes the secret after creation — read from saved env file
      const savedEnv = parseEnvFile(path.resolve(root, mode === "live" ? ".env.live" : ".env.test"));
      if (!savedEnv.STRIPE_WEBHOOK_SECRET)
        return NextResponse.json({
          error: "Webhook already exists in Stripe but no signing secret is saved locally. Delete the webhook at dashboard.stripe.com/webhooks then re-run setup.",
        }, { status: 409 });
      webhookSecret = savedEnv.STRIPE_WEBHOOK_SECRET;
      steps.push("Webhook already registered — reused existing endpoint");
    } else {
      const endpoint = await client.webhookEndpoints.create({ url: webhookUrl, enabled_events: WEBHOOK_EVENTS });
      webhookSecret = endpoint.secret!;
      steps.push("Webhook registered in Stripe");
    }

    // 3. Save to .env.live / .env.test
    const envFile = path.resolve(root, mode === "live" ? ".env.live" : ".env.test");
    writeEnvFile(envFile, { ...parseEnvFile(envFile), STRIPE_SECRET_KEY: secret_key, STRIPE_WEBHOOK_SECRET: webhookSecret });
    steps.push(`Keys saved to .env.${mode}`);

    // 4. Push to Supabase
    const supabaseResult = await pushSupabaseSecrets(secret_key, webhookSecret);
    steps.push(`Supabase secrets ${supabaseResult}`);

    // 5. Optionally activate
    if (activate) {
      activateMode(root, secret_key, webhookSecret);
      steps.push(".env.local updated");
      restartPM2(root);
      steps.push("PM2 restart triggered");
    }

    return NextResponse.json({ ok: true, mode, activated: activate, steps });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e), steps }, { status: 500 });
  }
}

/**
 * GET /api/stripe-setup
 * Returns saved key status for both modes and active mode.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const root = appRoot();
  const liveEnv   = parseEnvFile(path.resolve(root, ".env.live"));
  const testEnv   = parseEnvFile(path.resolve(root, ".env.test"));
  const activeEnv = parseEnvFile(path.resolve(root, ".env.local"));

  const mask = (k: string) => k ? `${k.slice(0, 12)}...${k.slice(-4)}` : "";
  return NextResponse.json({
    live: { configured: !!(liveEnv.STRIPE_SECRET_KEY && liveEnv.STRIPE_WEBHOOK_SECRET), key_hint: mask(liveEnv.STRIPE_SECRET_KEY) },
    test: { configured: !!(testEnv.STRIPE_SECRET_KEY && testEnv.STRIPE_WEBHOOK_SECRET), key_hint: mask(testEnv.STRIPE_SECRET_KEY) },
    active_mode: activeEnv.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test",
  });
}
