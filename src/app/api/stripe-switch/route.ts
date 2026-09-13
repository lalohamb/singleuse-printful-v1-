import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/require-admin";
import { appRoot, parseEnvFile } from "@/lib/env-utils";

export const runtime = "nodejs";

const execAsync = promisify(exec);

async function pushSupabaseSecrets(secretKey: string, webhookSecret: string, supabaseToken: string) {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
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
  const authError = await requireAdmin();
  if (authError) return authError;

  const body = await req.json();

  // Standalone restart action
  if (body.action === "restart") {
    const appName = process.env.PM2_APP_NAME ?? "myapp";
    setTimeout(() => execAsync(`/usr/bin/pm2 restart ${appName} --update-env`).catch(() => {}), 500);
    return NextResponse.json({ ok: true, message: "PM2 restarted" });
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
  const localContent = Object.entries(localEnv).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(localPath, localContent, "utf8");
  // Also write to standalone dir (process.cwd() on prod)
  const standalonePath = path.resolve(process.cwd(), ".env.local");
  if (standalonePath !== localPath && fs.existsSync(path.dirname(standalonePath))) {
    fs.writeFileSync(standalonePath, localContent, "utf8");
  }
  steps.push(".env.local updated");

  // 2. Push to Supabase via Management API
  const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (supabaseToken && projectRef) {
    try {
      await pushSupabaseSecrets(secretKey, webhookSecret, supabaseToken);
      steps.push("Supabase secrets updated");
    } catch (e: any) {
      return NextResponse.json({ error: e.message, steps }, { status: 500 });
    }
  } else {
    steps.push(`Supabase secrets skipped (${!supabaseToken ? "SUPABASE_ACCESS_TOKEN" : "SUPABASE_PROJECT_REF"} not set)`);
  }

  // 3. Update ecosystem.config.js and restart PM2 after response
  const appRoot_ = process.env.APP_ROOT ?? appDir;
  const repoPaths = [
    path.resolve(appRoot_, "ecosystem.config.js"),
    path.resolve(appDir, "ecosystem.config.js"),
    path.resolve(process.cwd(), "ecosystem.config.js"),
  ];
  for (const ecoPath of repoPaths) {
    try {
      if (!fs.existsSync(ecoPath)) continue;
      let ecoContent = fs.readFileSync(ecoPath, "utf8");
      ecoContent = ecoContent.replace(/("STRIPE_SECRET_KEY"\s*:\s*")[^"]*(")/g, `$1${secretKey}$2`);
      ecoContent = ecoContent.replace(/("STRIPE_WEBHOOK_SECRET"\s*:\s*")[^"]*(")/g, `$1${webhookSecret}$2`);
      fs.writeFileSync(ecoPath, ecoContent, "utf8");
      break;
    } catch { /* try next */ }
  }

  // Delayed restart — step only added on success
  setTimeout(async () => {
    try {
      await execAsync(`/usr/bin/pm2 startOrReload ${path.resolve(appRoot_, "ecosystem.config.js")} --update-env`);
      steps.push("PM2 restart triggered");
    } catch {
      try {
        await execAsync(`/usr/bin/pm2 restart ${process.env.PM2_APP_NAME ?? "myapp"} --update-env`);
        steps.push("PM2 restart triggered");
      } catch { /* not running under PM2 */ }
    }
  }, 300);

  return NextResponse.json({ ok: true, mode, steps });
}
