import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const PM2_PATHS = ["/usr/bin/pm2", "/usr/local/bin/pm2", "/root/.nvm/versions/node/v22/bin/pm2"];

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8").split("\n").reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {} as Record<string, string>);
}

function writeEnvFile(filePath: string, env: Record<string, string>) {
  const content = Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  fs.writeFileSync(filePath, content, "utf8");
}

function rebuildEcosystem(appDir: string) {
  const envPath = path.resolve(appDir, ".env.local");
  const fullEnv = parseEnvFile(envPath);
  const ecosystemPath = path.resolve(appDir, "ecosystem.config.js");
  const config = `module.exports = { apps: [{ name: 'bodyandsleeves', script: '.next/standalone/server.js', interpreter: 'node', cwd: '${appDir}', env: ${JSON.stringify(fullEnv, null, 2)} }] };`;
  fs.writeFileSync(ecosystemPath, config, "utf8");
  return ecosystemPath;
}

function restartPM2(ecosystemPath: string) {
  const pm2 = PM2_PATHS.find(p => fs.existsSync(p));
  if (!pm2) return false;
  spawn("/bin/bash", ["-c", `${pm2} delete bodyandsleeves; ${pm2} start ${ecosystemPath}; ${pm2} save`],
    { detached: true, stdio: "ignore" }).unref();
  return true;
}

// POST /api/stripe-mode
// body: { action: "save-keys", mode: "live"|"test", secret_key, webhook_secret }
//     | { action: "switch", mode: "live"|"test" }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const appDir = process.cwd();

  // ── Save keys to .env.live or .env.test ──
  if (body.action === "save-keys") {
    const { mode, secret_key, webhook_secret } = body as { mode: string; secret_key: string; webhook_secret: string };
    if (mode !== "live" && mode !== "test") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    if (!secret_key || !webhook_secret) return NextResponse.json({ error: "Both keys are required" }, { status: 400 });

    const filePath = path.resolve(appDir, mode === "live" ? ".env.live" : ".env.test");
    const existing = parseEnvFile(filePath);
    writeEnvFile(filePath, { ...existing, STRIPE_SECRET_KEY: secret_key, STRIPE_WEBHOOK_SECRET: webhook_secret });
    return NextResponse.json({ ok: true, message: `${mode} keys saved to .env.${mode}` });
  }

  // ── Switch active mode ──
  if (body.action === "switch") {
    const { mode } = body as { mode: string };
    if (mode !== "live" && mode !== "test") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

    const modeFile = path.resolve(appDir, mode === "live" ? ".env.live" : ".env.test");
    const modeEnv = parseEnvFile(modeFile);
    if (!modeEnv.STRIPE_SECRET_KEY || !modeEnv.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: `No keys found for ${mode} mode. Save them first.` }, { status: 400 });
    }

    // Update .env.local
    const envPath = path.resolve(appDir, ".env.local");
    const currentEnv = parseEnvFile(envPath);
    writeEnvFile(envPath, { ...currentEnv, STRIPE_SECRET_KEY: modeEnv.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: modeEnv.STRIPE_WEBHOOK_SECRET });

    // Rebuild ecosystem and restart PM2
    const ecosystemPath = rebuildEcosystem(appDir);
    const restarted = restartPM2(ecosystemPath);

    return NextResponse.json({
      ok: true,
      restarted,
      message: restarted
        ? `Switched to ${mode} mode. PM2 restarting — wait ~10s then refresh.`
        : `Switched to ${mode} mode. Restart your dev server to apply.`,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// GET /api/stripe-mode — return which keys are saved
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
