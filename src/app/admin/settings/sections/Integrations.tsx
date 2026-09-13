"use client";
import { useEffect, useState } from "react";
import { CreditCard, Printer, Send, Mail, Eye, EyeOff, Loader2 } from "lucide-react";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

type Status = "checking" | "connected" | "warning" | "disconnected";
const WEBHOOK_URL = "https://SUPABASE_PROJECT_REF_REDACTED.supabase.co/functions/v1/stripe-webhook";

function StatusBadge({ status }: { status: Status }) {
  const styles = { checking: "bg-secondary-100 text-secondary-500", connected: "bg-success-50 text-success-600", warning: "bg-warning-50 text-warning-600", disconnected: "bg-error-50 text-error-600" };
  const labels = { checking: "Checking...", connected: "Connected", warning: "Account Issue", disconnected: "Not Connected" };
  return <span className={`text-xs px-3 py-1 rounded-full ${styles[status]}`}>{labels[status]}</span>;
}

export default function Integrations() {
  const { form, set, save, saved, error } = useSettings();
  const [stripeOk, setStripeOk] = useState<Status>("checking");
  const [mailerOk, setMailerOk] = useState<Status>("checking");
  const [resendOk, setResendOk] = useState<Status>("checking");
  const [stripeSecret, setStripeSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeResult, setStripeResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/stripe-admin?action=balance").then((r) => setStripeOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setStripeOk("warning"));
    fetch("/api/mailerlite?action=groups").then((r) => setMailerOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setMailerOk("warning"));
    fetch("/api/resend?path=/domains").then((r) => setResendOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setResendOk("warning"));
  }, []);

  const registerWebhook = async () => {
    if (!stripeSecret) return;
    setStripeSaving(true); setStripeResult(null);
    try {
      // Step 1 — create webhook endpoint in Stripe, get signing secret
      const r = await fetch("/api/stripe-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register_webhook", secret_key: stripeSecret, webhook_url: WEBHOOK_URL }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);

      // Step 2 — persist both keys to .env.live / .env.test automatically
      // Skip if webhook already existed — signing secret was already saved on first setup
      if (data.reused) {
        setStripeResult({ type: "success", msg: `Webhook already registered for this URL. Keys are already saved. Go to Admin → Stripe to activate this mode.` });
        setStripeSecret("");
        setStripeSaving(false);
        return;
      }

      const mode = stripeSecret.startsWith("sk_live") ? "live" : "test";
      const saveR = await fetch("/api/stripe-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-keys", mode, secret_key: stripeSecret, webhook_secret: data.signing_secret }) });
      if (!saveR.ok) throw new Error("Webhook registered but keys could not be saved to disk.");

      setStripeResult({ type: "success", msg: `Stripe ${mode} keys saved. Webhook is live. Go to Admin → Stripe to activate this mode.` });
      setStripeSecret("");
    } catch (e: any) {
      setStripeResult({ type: "error", msg: e.message });
    }
    setStripeSaving(false);
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      {/* Printify */}
      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Printer size={22} className={form.printify_connected ? "text-success-500" : "text-secondary-400"} />
          <div><p className="font-medium text-secondary-900">Printify</p><p className="text-sm text-secondary-500">Print-on-demand fulfillment</p></div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${form.printify_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{form.printify_connected ? "Connected" : "Not Connected"}</span>
      </div>
      <div>
        <label className="label-text">Printify Shop ID</label>
        <input value={form.printify_shop_id || ""} onChange={(e) => set("printify_shop_id", e.target.value)} placeholder="e.g. 12345678" className="input-field" />
        <p className="text-xs text-secondary-400 mt-1">Find this in your Printify dashboard URL or via the API.</p>
      </div>

      {/* Stripe */}
      <div className="border border-secondary-100 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-secondary-50">
          <div className="flex items-center gap-3">
            <CreditCard size={22} className={stripeOk === "connected" ? "text-success-500" : stripeOk === "warning" ? "text-warning-500" : "text-secondary-400"} />
            <div><p className="font-medium text-secondary-900">Stripe</p><p className="text-sm text-secondary-500">Payment processing</p></div>
          </div>
          <StatusBadge status={stripeOk} />
        </div>
        <div className="p-4 space-y-3">
          <label className="label-text">Secret Key
            <div className="relative">
              <input type={showSecret ? "text" : "password"} value={stripeSecret} onChange={(e) => { setStripeSecret(e.target.value); setStripeResult(null); }} placeholder="sk_test_... or sk_live_..." className="input-field pr-10" />
              <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-2.5 text-secondary-400">{showSecret ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </label>
          {stripeSecret && (
            <p className={`text-xs ${stripeSecret.startsWith("sk_live") ? "text-success-600" : stripeSecret.startsWith("sk_test") ? "text-amber-600" : "text-error-600"}`}>
              {stripeSecret.startsWith("sk_live") ? "✓ Live key — real payments" : stripeSecret.startsWith("sk_test") ? "⚠ Test key — no real money" : "✗ Invalid key format"}
            </p>
          )}
          {stripeResult && (
            <div className={`rounded-lg p-3 text-xs ${stripeResult.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
              {stripeResult.type === "success" && <p className="font-semibold mb-1">✓ Webhook registered successfully</p>}
              <p className="break-all">{stripeResult.msg}</p>
            </div>
          )}
          <button type="button" onClick={registerWebhook} disabled={stripeSaving || (!stripeSecret.startsWith("sk_test") && !stripeSecret.startsWith("sk_live"))} className="btn-primary py-2 text-sm">
            {stripeSaving ? <><Loader2 size={15} className="mr-2 animate-spin" />Registering...</> : "Save Key & Register Webhook"}
          </button>
        </div>
      </div>

      {/* MailerLite */}
      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Send size={22} className={mailerOk === "connected" ? "text-success-500" : mailerOk === "warning" ? "text-warning-500" : "text-secondary-400"} />
          <div><p className="font-medium text-secondary-900">MailerLite</p><p className="text-sm text-secondary-500">Email marketing</p></div>
        </div>
        <StatusBadge status={mailerOk} />
      </div>

      {/* Resend */}
      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Mail size={22} className={resendOk === "connected" ? "text-success-500" : resendOk === "warning" ? "text-warning-500" : "text-secondary-400"} />
          <div><p className="font-medium text-secondary-900">Resend</p><p className="text-sm text-secondary-500">Transactional email</p></div>
        </div>
        <StatusBadge status={resendOk} />
      </div>

      <SaveBar onSave={() => save({ printify_shop_id: form.printify_shop_id })} saved={saved} error={error} />
    </div>
  );
}
