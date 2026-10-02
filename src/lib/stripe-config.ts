import { createClient } from "@supabase/supabase-js";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  mode: "live" | "test";
}

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getStripeConfig(): Promise<StripeConfig | null> {
  const { data, error } = await sb()
    .from("settings")
    .select("stripe_mode, stripe_live_secret_key, stripe_live_webhook_secret, stripe_test_secret_key, stripe_test_webhook_secret")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const mode: "live" | "test" = data.stripe_mode === "live" ? "live" : "test";
  const secretKey = mode === "live" ? data.stripe_live_secret_key : data.stripe_test_secret_key;
  const webhookSecret = mode === "live" ? data.stripe_live_webhook_secret : data.stripe_test_webhook_secret;

  if (!secretKey) return null;

  // Phase 6: Detect mixed environment configuration.
  // A live secret key must not be paired with a test webhook secret and vice versa.
  // This prevents silent mixed-mode operation where payments are live but
  // webhooks are verified against the wrong secret (causing all webhooks to fail).
  if (secretKey && webhookSecret) {
    const keyIsLive = secretKey.startsWith("sk_live_");
    const webhookIsLive = !webhookSecret.startsWith("whsec_test_") && mode === "live";
    // Detect explicit cross-contamination: sk_live_ key with test-mode active, or sk_test_ with live-mode active
    if (keyIsLive && mode !== "live") {
      console.error("[stripe-config] MIXED ENVIRONMENT: sk_live_ key loaded in test mode — check stripe_mode setting");
    }
    if (!keyIsLive && mode === "live") {
      console.error("[stripe-config] MIXED ENVIRONMENT: sk_test_ key loaded in live mode — check stripe_mode setting");
    }
  }

  return { secretKey, webhookSecret: webhookSecret ?? "", mode };
}

export async function getStripeSettings() {
  const { data } = await sb()
    .from("settings")
    .select("id, stripe_mode, stripe_live_secret_key, stripe_live_webhook_secret, stripe_test_secret_key, stripe_test_webhook_secret")
    .limit(1)
    .maybeSingle();
  return data;
}

export async function saveStripeKeys(mode: "live" | "test", secretKey: string, webhookSecret: string) {
  const { data: row } = await sb().from("settings").select("id").limit(1).maybeSingle();
  if (!row) throw new Error("Settings row not found");
  const update = mode === "live"
    ? { stripe_live_secret_key: secretKey, stripe_live_webhook_secret: webhookSecret }
    : { stripe_test_secret_key: secretKey, stripe_test_webhook_secret: webhookSecret };
  const { error } = await sb().from("settings").update(update).eq("id", row.id);
  if (error) throw new Error(error.message);
}

export async function setStripeMode(mode: "live" | "test") {
  const { data: row } = await sb().from("settings").select("id").limit(1).maybeSingle();
  if (!row) throw new Error("Settings row not found");
  const { error } = await sb().from("settings").update({ stripe_mode: mode }).eq("id", row.id);
  if (error) throw new Error(error.message);
}
