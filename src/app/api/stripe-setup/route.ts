import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAdmin } from "@/lib/require-admin";
import { getStripeSettings, saveStripeKeys, setStripeMode } from "@/lib/stripe-config";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "payment_intent.payment_failed",
];

function getWebhookUrl(): string {
  return `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`;
}

const mask = (k: string) => k ? `${k.slice(0, 12)}...${k.slice(-4)}` : "";

/**
 * POST /api/stripe-setup
 * Body: { secret_key: string, activate?: boolean }
 * Validates key format, registers webhook in Stripe, saves to DB.
 * If activate=true, also sets stripe_mode in DB.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const { secret_key, webhook_secret, activate = false } = await req.json();

  if (!secret_key)
    return NextResponse.json({ error: "secret_key is required" }, { status: 400 });
  if (!secret_key.startsWith("sk_live_") && !secret_key.startsWith("sk_test_"))
    return NextResponse.json({ error: "Invalid key — must start with sk_live_ or sk_test_" }, { status: 400 });
  if (webhook_secret && !webhook_secret.startsWith("whsec_"))
    return NextResponse.json({ error: "Invalid webhook_secret — must start with whsec_" }, { status: 400 });

  const mode: "live" | "test" = secret_key.startsWith("sk_live_") ? "live" : "test";
  const steps: string[] = [];

  try {
    // If webhook secret was manually provided, skip auto-registration
    if (webhook_secret) {
      await saveStripeKeys(mode, secret_key, webhook_secret);
      steps.push(`${mode} keys saved to database (webhook secret provided manually)`);
      if (activate) {
        await setStripeMode(mode);
        steps.push(`stripe_mode set to ${mode}`);
      }
      return NextResponse.json({ ok: true, mode, activated: activate, steps });
    }
    // Save keys to DB directly — webhook registration is optional and can be done separately
    const webhookUrl = getWebhookUrl();
    const client = new Stripe(secret_key, { apiVersion: "2026-08-26.dahlia" });
    const existing = await client.webhookEndpoints.list({ limit: 20 });
    const match = existing.data.find((ep) => ep.url === webhookUrl);

    let webhookSecret: string | null = null;

    if (match) {
      // Reuse saved webhook secret from DB if available
      const saved = await getStripeSettings();
      const savedSecret = mode === "live" ? saved?.stripe_live_webhook_secret : saved?.stripe_test_webhook_secret;
      if (savedSecret) {
        webhookSecret = savedSecret;
        steps.push("Webhook already registered — reused existing endpoint");
      } else {
        // Secret not in DB (Stripe only returns it once) — delete and recreate to get a fresh one
        await client.webhookEndpoints.del(match.id);
        const endpoint = await client.webhookEndpoints.create({ url: webhookUrl, enabled_events: WEBHOOK_EVENTS });
        webhookSecret = endpoint.secret!;
        steps.push("Webhook recreated to recover signing secret");
      }
    } else {
      const endpoint = await client.webhookEndpoints.create({ url: webhookUrl, enabled_events: WEBHOOK_EVENTS });
      webhookSecret = endpoint.secret!;
      steps.push("Webhook registered in Stripe");
    }

    // Save keys to DB (webhook secret optional)
    await saveStripeKeys(mode, secret_key, webhookSecret ?? "");
    steps.push(`${mode} keys saved to database`);

    if (activate) {
      await setStripeMode(mode);
      steps.push(`stripe_mode set to ${mode}`);
    }

    return NextResponse.json({ ok: true, mode, activated: activate, steps });
  } catch (e: unknown) {
    return NextResponse.json({ error: getErrorMessage(e), steps }, { status: 500 });
  }
}

/**
 * GET /api/stripe-setup
 * Returns saved key status for both modes and active mode from DB.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAdmin();
  if (authError) return authError;

  const data = await getStripeSettings();

  return NextResponse.json({
    live: {
      configured: !!(data?.stripe_live_secret_key && data?.stripe_live_webhook_secret),
      key_configured: !!(data?.stripe_live_secret_key),
      key_hint: mask(data?.stripe_live_secret_key ?? ""),
    },
    test: {
      configured: !!(data?.stripe_test_secret_key && data?.stripe_test_webhook_secret),
      key_configured: !!(data?.stripe_test_secret_key),
      key_hint: mask(data?.stripe_test_secret_key ?? ""),
    },
    active_mode: data?.stripe_mode === "live" ? "live" : "test",
  });
}
