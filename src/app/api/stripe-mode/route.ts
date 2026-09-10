import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// Resolves to /var/www/bodyandsleeves regardless of whether we're running
// from the repo root or the standalone bundle (.next/standalone/server.js)
function appRoot(): string {
  // APP_ROOT is set in ecosystem.config.js on the droplet
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

function writeEnvFile(filePath: string, env: Record<string, string>) {
  fs.writeFileSync(filePath, Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", "utf8");
}

// POST — body: { action: "save-keys", mode: "live"|"test", secret_key, webhook_secret }
export async function POST(req: NextRequest) {
  const { action, mode, secret_key, webhook_secret } = await req.json();
  if (action !== "save-keys") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (mode !== "live" && mode !== "test") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (!secret_key || !webhook_secret) return NextResponse.json({ error: "Both keys are required" }, { status: 400 });

  const root = appRoot();
  const filePath = path.resolve(root, mode === "live" ? ".env.live" : ".env.test");
  writeEnvFile(filePath, { ...parseEnvFile(filePath), STRIPE_SECRET_KEY: secret_key, STRIPE_WEBHOOK_SECRET: webhook_secret });
  return NextResponse.json({ ok: true, message: `${mode} keys saved` });
}

// GET — return saved key hints
export async function GET() {
  const root = appRoot();
  const liveEnv = parseEnvFile(path.resolve(root, ".env.live"));
  const testEnv = parseEnvFile(path.resolve(root, ".env.test"));
  // active_mode must read from process.cwd() — the actual file the running process loaded
  const activeEnv = parseEnvFile(path.resolve(process.cwd(), ".env.local"));
  const mask = (k: string) => k ? `${k.slice(0, 12)}...${k.slice(-4)}` : "";
  return NextResponse.json({
    live: { hasKeys: !!(liveEnv.STRIPE_SECRET_KEY && liveEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(liveEnv.STRIPE_SECRET_KEY), webhook_hint: mask(liveEnv.STRIPE_WEBHOOK_SECRET) },
    test: { hasKeys: !!(testEnv.STRIPE_SECRET_KEY && testEnv.STRIPE_WEBHOOK_SECRET), secret_key_hint: mask(testEnv.STRIPE_SECRET_KEY), webhook_hint: mask(testEnv.STRIPE_WEBHOOK_SECRET) },
    active_mode: activeEnv.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test",
  });
}
