import { NextRequest, NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const KEYS = {
  live: {
    STRIPE_SECRET_KEY: "STRIPE_LIVE_SECRET_KEY_REDACTED",
    STRIPE_WEBHOOK_SECRET: "whsec_08V5JvZ6KocRdBB2PDoj6xrxaJEKfmXG",
  },
  test: {
    STRIPE_SECRET_KEY: "STRIPE_SECRET_KEY_REDACTED",
    STRIPE_WEBHOOK_SECRET: "whsec_j0pXblTz4FdVBON9vKEkA2ZpTtGrvgud",
  },
};

export async function POST(req: NextRequest) {
  const { mode } = await req.json() as { mode: string };
  if (mode !== "live" && mode !== "test") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const envPath = path.resolve(process.cwd(), ".env.local");
  const keys = KEYS[mode as "live" | "test"];
  const log: string[] = [];

  try {
    // 1. Patch .env.local — replace only the two Stripe lines
    let env = fs.readFileSync(envPath, "utf8");
    env = env.replace(/^STRIPE_SECRET_KEY=.*/m, `STRIPE_SECRET_KEY=${keys.STRIPE_SECRET_KEY}`);
    env = env.replace(/^STRIPE_WEBHOOK_SECRET=.*/m, `STRIPE_WEBHOOK_SECRET=${keys.STRIPE_WEBHOOK_SECRET}`);
    fs.writeFileSync(envPath, env, "utf8");
    log.push(`✅ .env.local updated with ${mode} keys`);

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

    // 4. Restart pm2 — detached so it survives killing the current process
    const pm2Exists = fs.existsSync("/usr/bin/pm2");
    if (pm2Exists) {
      spawn("/usr/bin/pm2", ["restart", "bodyandsleeves", "--update-env"], {
        detached: true,
        stdio: "ignore",
      }).unref();
      log.push("✅ pm2 restart triggered (detached)");
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
