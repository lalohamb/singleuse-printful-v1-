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
