"use client";
import { useEffect, useState } from "react";
import { CreditCard, Printer, Send, Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";

type Status = "checking" | "connected" | "warning" | "disconnected";

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
  const [storeValidating, setStoreValidating] = useState(false);
  const [storeValidation, setStoreValidation] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/stripe-admin?action=balance").then((r) => setStripeOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setStripeOk("warning"));
    fetch("/api/mailerlite?action=groups").then((r) => setMailerOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setMailerOk("warning"));
    fetch("/api/resend?path=/domains").then((r) => setResendOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setResendOk("warning"));
  }, []);

  const validatePrintfulStore = async () => {
    const storeId = (form.printful_store_id || "").trim();
    if (!storeId) return;
    setStoreValidating(true); setStoreValidation(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/printful-proxy/stores`, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const store = (data.result || []).find((s: any) => String(s.id) === storeId);
        if (store) setStoreValidation({ ok: true, msg: `Store found: "${store.name}"` });
        else setStoreValidation({ ok: false, msg: "Store ID not found in your Printful account" });
      } else {
        setStoreValidation({ ok: false, msg: "Could not reach Printful — check your API token" });
      }
    } catch {
      setStoreValidation({ ok: false, msg: "Connection failed" });
    }
    setStoreValidating(false);
  };

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      {/* Printful */}
      <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Printer size={22} className={form.printful_connected ? "text-success-500" : "text-secondary-400"} />
          <div><p className="font-medium text-secondary-900">Printful</p><p className="text-sm text-secondary-500">Print-on-demand fulfillment</p></div>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${form.printful_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{form.printful_connected ? "Connected" : "Not Connected"}</span>
      </div>
      <div className="space-y-2">
        <label className="label-text">Printful Store ID</label>
        <div className="flex gap-2">
          <input
            value={form.printful_store_id || ""}
            onChange={(e) => { set("printful_store_id", e.target.value); setStoreValidation(null); }}
            placeholder="e.g. 12345"
            className="input-field flex-1"
          />
          <button
            onClick={validatePrintfulStore}
            disabled={storeValidating || !(form.printful_store_id || "").trim()}
            className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {storeValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {storeValidating ? "Checking..." : "Validate"}
          </button>
        </div>
        <p className="text-xs text-secondary-400">Find this in Printful Dashboard → Settings → Stores, or via GET /stores.</p>
        {storeValidation && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${storeValidation.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>
            {storeValidation.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {storeValidation.msg}
          </div>
        )}
      </div>

      {/* Stripe — managed on its own page */}
      <div className="flex items-start justify-between p-4 bg-secondary-50 rounded-lg gap-4">
        <div className="flex items-start gap-3">
          <CreditCard size={22} className={`mt-0.5 ${stripeOk === "connected" ? "text-success-500" : stripeOk === "warning" ? "text-warning-500" : "text-secondary-400"}`} />
          <div className="space-y-1">
            <p className="font-medium text-secondary-900">Stripe</p>
            <p className="text-sm text-secondary-500">Handles all payment processing at checkout. Supports live and test modes so you can verify your setup before taking real payments. Keys and webhook secrets are stored securely in the database — no env file changes needed to switch modes.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={stripeOk} />
          <Link href="/admin/stripe" className="text-xs text-primary-600 hover:underline font-medium">Configure →</Link>
        </div>
      </div>

      {/* MailerLite */}
      <div className="flex items-start justify-between p-4 bg-secondary-50 rounded-lg gap-4">
        <div className="flex items-start gap-3">
          <Send size={22} className={`mt-0.5 ${mailerOk === "connected" ? "text-success-500" : mailerOk === "warning" ? "text-warning-500" : "text-secondary-400"}`} />
          <div className="space-y-1">
            <p className="font-medium text-secondary-900">MailerLite</p>
            <p className="text-sm text-secondary-500">Email marketing platform used to grow and manage your subscriber list. Customers who complete a purchase are automatically added to your MailerLite group, keeping your audience in sync without any manual work. Configure your API key via the <Link href="/admin/mailerlite" className="text-primary-600 hover:underline">MailerLite page</Link>.</p>
          </div>
        </div>
        <div className="shrink-0"><StatusBadge status={mailerOk} /></div>
      </div>

      {/* Resend */}
      <div className="flex items-start justify-between p-4 bg-secondary-50 rounded-lg gap-4">
        <div className="flex items-start gap-3">
          <Mail size={22} className={`mt-0.5 ${resendOk === "connected" ? "text-success-500" : resendOk === "warning" ? "text-warning-500" : "text-secondary-400"}`} />
          <div className="space-y-1">
            <p className="font-medium text-secondary-900">Resend</p>
            <p className="text-sm text-secondary-500">Transactional email service that sends order confirmations to customers after a successful payment. Also used to notify affiliates of new conversions. Requires a verified sending domain and API key set in your environment variables.</p>
          </div>
        </div>
        <div className="shrink-0"><StatusBadge status={resendOk} /></div>
      </div>

      <SaveBar onSave={() => save({ printful_store_id: form.printful_store_id })} saved={saved} error={error} />
    </div>
  );
}
