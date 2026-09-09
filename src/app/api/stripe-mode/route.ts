import { NextRequest, NextResponse } from "next/server";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

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
    return NextResponse.json({ error: `.env.${mode} not found or missing Stripe keys` }, { status: 500 });
  }
  const log: string[] = [];

  try {
    // On local (no PM2): patch .env.local so next dev picks up the new keys
    const pm2Check = ["/usr/bin/pm2", "/usr/local/bin/pm2", "/root/.nvm/versions/node/v22/bin/pm2"].find(p => fs.existsSync(p));
    if (!pm2Check) {
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        let env = fs.readFileSync(envPath, "utf8");
        env = env.replace(/^STRIPE_SECRET_KEY=.*/m, `STRIPE_SECRET_KEY=${keys.STRIPE_SECRET_KEY}`);
        env = env.replace(/^STRIPE_WEBHOOK_SECRET=.*/m, `STRIPE_WEBHOOK_SECRET=${keys.STRIPE_WEBHOOK_SECRET}`);
        fs.writeFileSync(envPath, env, "utf8");
        log.push(`✅ .env.local updated with ${mode} keys`);
      }
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

      // Seed from current process.env so we don't lose other vars
      let existingEnv: Record<string, string> = {};
      const envKeysToPreserve = [
        "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "PRINTIFY_SHOP_ID", "NEXT_PUBLIC_PRINTIFY_SHOP_ID", "PRINTIFY_API_TOKEN",
        "RESEND_API_KEY", "MAILER_LITE_API_KEY",
      ];
      for (const k of envKeysToPreserve) {
        if (process.env[k]) existingEnv[k] = process.env[k]!;
      }
      if (fs.existsSync(ecosystemPath)) {
        // Extract current env block via regex — avoids eval
        const content = fs.readFileSync(ecosystemPath, "utf8");
        const m = content.match(/env\s*:\s*(\{[\s\S]*?\})/m);
        if (m) {
          try { existingEnv = JSON.parse(m[1].replace(/'/g, '"')); } catch {}
        }
      }

      const mergedEnv = { ...existingEnv, ...keys };
      const envLines = Object.entries(mergedEnv)
        .map(([k, v]) => `    ${k}: '${v}'`)
        .join(",\n");

      const ecosystem = `module.exports = {
  apps: [{
    name: 'bodyandsleeves',
    script: 'npm',
    args: 'start',
    cwd: '${appDir}',
    env: {
${envLines}
    }
  }]
};
`;
      fs.writeFileSync(ecosystemPath, ecosystem, "utf8");
      log.push(`✅ ecosystem.config.js written with ${mode} keys`);

      spawn(
        "/bin/bash",
        ["-c", `${pm2Bin} restart ${ecosystemPath} --update-env`],
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
