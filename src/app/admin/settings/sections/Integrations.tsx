"use client";
import { useEffect, useState } from "react";
import { CreditCard, Printer, Send, Mail, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { supabase } from "@/lib/supabase";

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
  const [shopValidating, setShopValidating] = useState(false);
  const [shopValidation, setShopValidation] = useState<{ ok: boolean; msg: string } | null>(null);
  const [syncedProductCount, setSyncedProductCount] = useState(0);
  const [originalShopId, setOriginalShopId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe-admin?action=balance").then((r) => setStripeOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setStripeOk("warning"));
    fetch("/api/mailerlite?action=groups").then((r) => setMailerOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setMailerOk("warning"));
    fetch("/api/resend?path=/domains").then((r) => setResendOk(r.status === 200 ? "connected" : r.status === 401 ? "disconnected" : "warning")).catch(() => setResendOk("warning"));
    // Count synced products and store original shop ID
    supabase.from("products").select("id", { count: "exact" }).not("printify_id", "is", null).eq("status", "active")
      .then(({ count }) => setSyncedProductCount(count ?? 0));
    supabase.from("settings").select("printify_shop_id").limit(1).maybeSingle()
      .then(({ data }) => setOriginalShopId(data?.printify_shop_id ?? null));
  }, []);

  const validateShopId = async () => {
    const shopId = (form.printify_shop_id || "").trim();
    if (!shopId) return;
    setShopValidating(true); setShopValidation(null);
    try {
      const res = await fetch(`/api/printify-shops?shop_id=${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setShopValidation({ ok: true, msg: `Shop found: "${data.title || shopId}"` });
      } else {
        setShopValidation({ ok: false, msg: "Shop ID not found in your Printify account" });
      }
    } catch {
      setShopValidation({ ok: false, msg: "Could not reach Printify — check your API token" });
    }
    setShopValidating(false);
  };

  const isChanged = (form.printify_shop_id || "") !== (originalShopId || "");
  const showSyncWarning = isChanged && syncedProductCount > 0;

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
      <div className="space-y-2">
        <label className="label-text">Printify Shop ID</label>
        <div className="flex gap-2">
          <input
            value={form.printify_shop_id || ""}
            onChange={(e) => { set("printify_shop_id", e.target.value); setShopValidation(null); }}
            placeholder="e.g. 12345678"
            className="input-field flex-1"
          />
          <button
            onClick={validateShopId}
            disabled={shopValidating || !(form.printify_shop_id || "").trim()}
            className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {shopValidating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {shopValidating ? "Checking..." : "Validate"}
          </button>
        </div>
        <p className="text-xs text-secondary-400">Find this in your Printify dashboard URL or via the API.</p>

        {/* Validation result */}
        {shopValidation && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            shopValidation.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"
          }`}>
            {shopValidation.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {shopValidation.msg}
          </div>
        )}

        {/* Warning when changing shop ID with existing synced products */}
        {showSyncWarning && (
          <div className="flex items-start gap-2 text-sm px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              You have <strong>{syncedProductCount} active product{syncedProductCount !== 1 ? "s" : ""}</strong> synced from the current shop.
              Changing the Shop ID means new orders will be submitted to a different Printify shop — those product IDs won&apos;t exist there and fulfillment will fail.
              Run a full product sync after saving to update your catalog.
            </span>
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

      <SaveBar onSave={() => save({ printify_shop_id: form.printify_shop_id })} saved={saved} error={error} />
    </div>
  );
}
