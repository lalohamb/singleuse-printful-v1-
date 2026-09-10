import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execAsync = promisify(exec);
const SUPABASE_PROJECT_REF = "SUPABASE_PROJECT_REF_REDACTED";

function appRoot(): string {
  if (process.env.APP_ROOT && fs.existsSync(path.join(process.env.APP_ROOT, ".env.local"))) return process.env.APP_ROOT;
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, ".env.local"))) return cwd;
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, ".env.local"))) return dir;
    dir = path.dirname(dir);
  }
  return cwd;
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split("\n").reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {} as Record<string, string>);
}

async function pushSupabaseSecrets(secretKey: string, webhookSecret: string, supabaseToken: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/secrets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        { name: "STRIPE_SECRET_KEY", value: secretKey },
        { name: "STRIPE_WEBHOOK_SECRET", value: webhookSecret },
      ]),
    }
  );
  if (!res.ok) throw new Error(`Supabase secrets update failed: ${await res.text()}`);
}

// POST — body: { mode: "live" | "test" } or { action: "restart" }
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Standalone restart action
  if (body.action === "restart") {
    try {
      await execAsync("pm2 restart bodyandsleeves --update-env");
      return NextResponse.json({ ok: true, message: "PM2 restarted" });
    } catch {
      return NextResponse.json({ error: "PM2 restart failed — not running under PM2" }, { status: 500 });
    }
  }

  const { mode } = body;
  if (mode !== "live" && mode !== "test")
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

  const appDir = appRoot();
  const envFile = path.resolve(appDir, mode === "live" ? ".env.live" : ".env.test");

  if (!fs.existsSync(envFile))
    return NextResponse.json({ error: `${mode === "live" ? ".env.live" : ".env.test"} not found. Save keys first.` }, { status: 400 });

  const env = parseEnvFile(envFile);
  const secretKey = env.STRIPE_SECRET_KEY;
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret)
    return NextResponse.json({ error: `${mode} keys are incomplete. Save both keys first.` }, { status: 400 });

  const steps: string[] = [];

  // 1. Patch .env.local with new Stripe keys (preserve all other vars)
  const localPath = path.resolve(appDir, ".env.local");
  const localEnv = parseEnvFile(localPath);
  localEnv.STRIPE_SECRET_KEY = secretKey;
  localEnv.STRIPE_WEBHOOK_SECRET = webhookSecret;
  fs.writeFileSync(localPath, Object.entries(localEnv).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");
  steps.push(".env.local updated");

  // 2. Push to Supabase via Management API
  const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (supabaseToken) {
    try {
      await pushSupabaseSecrets(secretKey, webhookSecret, supabaseToken);
      steps.push("Supabase secrets updated");
    } catch (e: any) {
      return NextResponse.json({ error: e.message, steps }, { status: 500 });
    }
  } else {
    steps.push("Supabase secrets skipped (SUPABASE_ACCESS_TOKEN not set)");
  }

  // 3. Restart PM2 so the new .env.local is loaded
  try {
    await execAsync("pm2 restart bodyandsleeves --update-env");
    steps.push("PM2 restarted — new keys are live");
  } catch {
    steps.push("PM2 restart skipped (not running under PM2 — restart dev server manually)");
  }

  return NextResponse.json({ ok: true, mode, steps });
}
