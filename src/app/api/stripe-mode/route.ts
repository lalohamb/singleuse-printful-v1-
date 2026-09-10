import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split("\n").reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {} as Record<string, string>);
}

function writeEnvFile(filePath: string, env: Record<string, string>) {
  fs.writeFileSync(filePath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");
}

// POST — body: { action: "save-keys", mode: "live"|"test", secret_key, webhook_secret }
export async function POST(req: NextRequest) {
  const { action, mode, secret_key, webhook_secret } = await req.json();
  if (action !== "save-keys") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (mode !== "live" && mode !== "test") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (!secret_key || !webhook_secret) return NextResponse.json({ error: "Both keys are required" }, { status: 400 });

  const appDir = process.cwd();
  const filePath = path.resolve(appDir, mode === "live" ? ".env.live" : ".env.test");
  writeEnvFile(filePath, { ...parseEnvFile(filePath), STRIPE_SECRET_KEY: secret_key, STRIPE_WEBHOOK_SECRET: webhook_secret });
  return NextResponse.json({ ok: true, message: `${mode} keys saved` });
}

// GET — return saved key hints
export async function GET() {
  const appDir = process.cwd();
  const liveEnv = parseEnvFile(path.resolve(appDir, ".env.live"));
  const testEnv = parseEnvFile(path.resolve(appDir, ".env.test"));
  const activeEnv = parseEnvFile(path.resolve(appDir, ".env.local"));
  const mask = (k: string) => k ? `${k.slice(0, 12)}...${k.slice(-4)}` : "";
  return NextResponse.json({
    live: { hasKeys: !!(liveEnv.STRIPE_SECRET_KEY && liveEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(liveEnv.STRIPE_SECRET_KEY), webhook_hint: mask(liveEnv.STRIPE_WEBHOOK_SECRET) },
    test: { hasKeys: !!(testEnv.STRIPE_SECRET_KEY && testEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(testEnv.STRIPE_SECRET_KEY), webhook_hint: mask(testEnv.STRIPE_WEBHOOK_SECRET) },
    active_mode: activeEnv.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test",
  });
}
