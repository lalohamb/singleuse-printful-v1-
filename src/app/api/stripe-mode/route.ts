import { NextRequest, NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const execAsync = promisify(exec);

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  return fs.readFileSync(filePath, "utf8")
    .split("\n")
    .reduce((acc, line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) acc[match[1].trim()] = match[2].trim();
      return acc;
    }, {} as Record<string, string>);
}

function getKeysFromEnvFile(mode: "live" | "test") {
  const file = path.resolve(process.cwd(), mode === "live" ? ".env.live" : ".env.test");
  const env = parseEnvFile(file);
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return null;
  return { STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET };
}

export async function POST(req: NextRequest) {
  const { mode } = await req.json() as { mode: string };
  if (mode !== "live" && mode !== "test") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const keys = getKeysFromEnvFile(mode as "live" | "test");
  if (!keys) {
    return NextResponse.json({ error: `.env.${mode} not found or missing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET. Make sure both files exist on the droplet at /var/www/bodyandsleeves/.env.live and .env.test` }, { status: 500 });
  }
  const log: string[] = [];

  try {
    // Always update .env.local with the new keys
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf8");
      envContent = envContent.replace(/^STRIPE_SECRET_KEY=.*/m, `STRIPE_SECRET_KEY=${keys.STRIPE_SECRET_KEY}`);
      envContent = envContent.replace(/^STRIPE_WEBHOOK_SECRET=.*/m, `STRIPE_WEBHOOK_SECRET=${keys.STRIPE_WEBHOOK_SECRET}`);
      fs.writeFileSync(envPath, envContent, "utf8");
      log.push(`✅ .env.local updated with ${mode} keys`);
    }

    // 2. Push secrets to Supabase edge functions
    const secretsCmd = [
      "npx supabase secrets set",
      `STRIPE_SECRET_KEY=${keys.STRIPE_SECRET_KEY}`,
      `STRIPE_WEBHOOK_SECRET=${keys.STRIPE_WEBHOOK_SECRET}`,
      "--project-ref SUPABASE_PROJECT_REF_REDACTED",
    ].join(" ");
    const { stdout: s1, stderr: e1 } = await execAsync(secretsCmd, { timeout: 30_000 });
    log.push(`✅ Supabase secrets updated\n${(s1 + e1).trim()}`);

    // 3. Redeploy edge functions
    const { stdout: s2, stderr: e2 } = await execAsync(
      "npx supabase functions deploy stripe-webhook stripe-checkout --project-ref SUPABASE_PROJECT_REF_REDACTED",
      { timeout: 120_000 }
    );
    log.push(`✅ Edge functions redeployed\n${(s2 + e2).trim()}`);

    // 4. Write ecosystem.config.js with updated env, then pm2 reload from it
    const pm2Bin = ["/usr/bin/pm2", "/usr/local/bin/pm2", "/root/.nvm/versions/node/v22/bin/pm2"]
      .find(p => fs.existsSync(p));

    if (pm2Bin) {
      const appDir = process.cwd();
      const ecosystemPath = path.join(appDir, "ecosystem.config.js");

      // Read all vars from .env.local — source of truth
      const envPath = path.resolve(appDir, ".env.local");
      const fullEnv: Record<string, string> = {};
      if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (m) fullEnv[m[1].trim()] = m[2].trim();
        });
      }

      const ecosystem = `module.exports = { apps: [{ name: 'bodyandsleeves', script: '.next/standalone/server.js', interpreter: 'node', cwd: '${appDir}', env: ${JSON.stringify(fullEnv, null, 2)} }] };`;
      fs.writeFileSync(ecosystemPath, ecosystem, "utf8");
      log.push(`✅ ecosystem.config.js written with ${Object.keys(fullEnv).length} vars`);

      spawn(
        "/bin/bash",
        ["-c", `${pm2Bin} delete bodyandsleeves; ${pm2Bin} start ${ecosystemPath}; ${pm2Bin} save`],
        { detached: true, stdio: "ignore" }
      ).unref();
      log.push("✅ PM2 restart triggered. Wait ~10s then refresh.");
    } else {
      log.push("ℹ️ Running locally — restart your dev server to pick up the new keys.");
    }

    return NextResponse.json({ ok: true, log: log.join("\n\n") });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, log: [...log, `❌ ${e.stderr || e.message}`].join("\n\n") },
      { status: 500 }
    );
  }
}
