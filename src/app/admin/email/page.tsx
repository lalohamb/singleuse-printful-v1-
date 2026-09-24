"use client";
import { useState, useEffect } from "react";
import { Send, Loader2, Check, Mail, RefreshCw, Users, AlertTriangle, CheckCircle, XCircle, Info, Key, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface SentEmail { id: string; to: string[]; subject: string; created_at: string; }
interface EmailEvent { resend_id: string; to_email: string; subject: string; event_type: string; created_at: string; }

const eventBadge: Record<string, { label: string; cls: string }> = {
  sent:       { label: "Sent",       cls: "bg-secondary-100 text-secondary-600" },
  delivered:  { label: "Delivered",  cls: "bg-success-50 text-success-600" },
  opened:     { label: "Opened",     cls: "bg-primary-50 text-primary-600" },
  clicked:    { label: "Clicked",    cls: "bg-primary-100 text-primary-700" },
  bounced:    { label: "Bounced",    cls: "bg-error-50 text-error-600" },
  complained: { label: "Spam",       cls: "bg-error-100 text-error-700" },
};

function EmailPanel() {
  const [tab, setTab] = useState<"send" | "broadcast" | "events" | "settings">("send");

  // API key
  const [resendKey, setResendKey] = useState("");
  const [keyMasked, setKeyMasked] = useState(true);
  const [keySaving, setKeySaving] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [keyValidating, setKeyValidating] = useState(false);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSupport, setEmailSupport] = useState("");

  // Single send
  const [form, setForm] = useState({ to: "", subject: "", html: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Broadcast
  const [broadcast, setBroadcast] = useState({ subject: "", html: "" });
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [customerEmails, setCustomerEmails] = useState<string[]>([]);

  // Recent sent
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  // Delivery events
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [webhookConfigured, setWebhookConfigured] = useState(false);

  useEffect(() => {
    setWebhookConfigured(localStorage.getItem("resend_webhook_configured") === "1");
  }, []);

  const fetchEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch("/api/resend?path=/emails");
      const data = await res.json();
      setEmails(data.data || []);
    } catch { setEmails([]); }
    setLoadingEmails(false);
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    const { data } = await supabase.from("email_events").select("*").order("created_at", { ascending: false }).limit(50);
    setEvents((data || []) as EmailEvent[]);
    setLoadingEvents(false);
  };

  const fetchCustomerEmails = async () => {
    const { data } = await supabase.from("orders").select("email").eq("livemode", true).eq("status", "paid");
    const unique = Array.from(new Set((data || []).map((o) => o.email).filter(Boolean)));
    setCustomerEmails(unique);
  };

  useEffect(() => { fetchEmails(); fetchCustomerEmails(); loadKey(); }, []);
  useEffect(() => { if (tab === "events") fetchEvents(); }, [tab]);

  const loadKey = async () => {
    const { data } = await supabase.from("settings").select("resend_api_key, email_from, email_support").limit(1).maybeSingle();
    if (data?.resend_api_key) setResendKey(data.resend_api_key);
    if (data?.email_from) setEmailFrom(data.email_from);
    if (data?.email_support) setEmailSupport(data.email_support);
  };

  const validateKey = async () => {
    if (!resendKey.trim()) return;
    setKeyValidating(true); setKeyMsg(null);
    const res = await fetch("/api/resend?path=/domains", {
      headers: { "x-resend-key-override": resendKey.trim() },
    });
    setKeyValidating(false);
    if (res.ok) setKeyMsg({ text: "Key is valid ✓", ok: true });
    else setKeyMsg({ text: "Invalid key — check and try again", ok: false });
  };

  const saveKey = async () => {
    setKeySaving(true); setKeyMsg(null);
    const { data: row } = await supabase.from("settings").select("id").limit(1).maybeSingle();
    if (!row?.id) { setKeyMsg({ text: "Settings row not found", ok: false }); setKeySaving(false); return; }
    const { error } = await supabase.from("settings").update({ resend_api_key: resendKey.trim() || null, email_from: emailFrom.trim() || null, email_support: emailSupport.trim() || null }).eq("id", row.id);
    setKeySaving(false);
    setKeyMsg(error ? { text: error.message, ok: false } : { text: "Saved!", ok: true });
    setTimeout(() => setKeyMsg(null), 3000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setSendError(null);
    const res = await fetch("/api/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Your Store <orders@your-store.example>",
        to: form.to.split(",").map((s) => s.trim()),
        subject: form.subject,
        html: form.html,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setSendError(data.message || "Failed to send"); }
    else { setSent(true); setForm({ to: "", subject: "", html: "" }); fetchEmails(); setTimeout(() => setSent(false), 3000); }
    setSending(false);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerEmails.length) { setBroadcastError("No live customer emails found."); return; }
    if (!confirm(`Send to ${customerEmails.length} customers?`)) return;
    setBroadcasting(true); setBroadcastError(null); setBroadcastDone(null);
    let success = 0;
    // Send in batches of 10 to avoid rate limits
    for (let i = 0; i < customerEmails.length; i += 10) {
      const batch = customerEmails.slice(i, i + 10);
      await Promise.all(batch.map((email) =>
        fetch("/api/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Your Store <orders@your-store.example>",
            to: [email],
            subject: broadcast.subject,
            html: broadcast.html,
          }),
        }).then((r) => { if (r.ok) success++; })
      ));
    }
    setBroadcastDone(`Sent to ${success} of ${customerEmails.length} customers.`);
    setBroadcast({ subject: "", html: "" });
    setBroadcasting(false);
    fetchEmails();
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Info banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 flex items-start gap-3">
        <Info size={18} className="text-primary-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm text-secondary-700">
          <p className="font-semibold text-secondary-900">Email — Resend</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><p className="font-medium">📧 Send Email</p><p className="text-xs text-secondary-500">Send a one-off email to any address — customer support, manual order updates, etc.</p></div>
            <div><p className="font-medium">📣 Broadcast</p><p className="text-xs text-secondary-500">Send a message to all customers who have placed a live paid order. Great for announcements, new arrivals, and promotions.</p></div>
            <div><p className="font-medium">📊 Delivery Events</p><p className="text-xs text-secondary-500">Track whether emails are delivered, opened, bounced, or marked as spam. Requires the webhook URL to be added in your Resend dashboard.</p></div>
          </div>
          <p className="text-xs text-secondary-400 pt-1">Order confirmation and shipping emails are sent automatically — you do not need to send those manually here.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary-100 p-1 rounded-lg w-fit">
        {([["send", "Send Email"], ["broadcast", "Broadcast"], ["events", "Delivery Events"], ["settings", "API Key"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === key ? "bg-white text-secondary-900 shadow-sm" : "text-secondary-500 hover:text-secondary-700"}`}>
            {label}{key === "broadcast" && customerEmails.length > 0 && <span className="ml-1.5 text-xs bg-primary-100 text-primary-600 px-1.5 py-0.5 rounded-full">{customerEmails.length}</span>}
          </button>
        ))}
      </div>

      {/* Send single email */}
      {tab === "send" && (
        <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6"><Mail size={22} className="text-primary-500" />Send Email via Resend</h2>
          <form onSubmit={handleSend} className="space-y-4">
            <div><label className="label-text">To (comma-separated)</label><input required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="input-field" placeholder="customer@example.com" /></div>
            <div><label className="label-text">Subject</label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" placeholder="Your order has shipped!" /></div>
            <div><label className="label-text">Body (HTML)</label><textarea required rows={8} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className="input-field font-mono text-sm" placeholder="<p>Hello,</p>" /></div>
            {sendError && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{sendError}</div>}
            <button type="submit" disabled={sending} className="btn-primary">
              {sending ? <><Loader2 size={18} className="mr-2 animate-spin" />Sending...</> : sent ? <><Check size={18} className="mr-2" />Sent!</> : <><Send size={18} className="mr-2" />Send Email</>}
            </button>
          </form>
          {/* Recent sent */}
          <div className="mt-8 border-t border-secondary-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-secondary-900">Recent Sent</h3>
              <button onClick={fetchEmails} className="text-secondary-400 hover:text-secondary-700"><RefreshCw size={16} className={loadingEmails ? "animate-spin" : ""} /></button>
            </div>
            {loadingEmails ? <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-secondary-300 border-t-secondary-900" /></div>
              : emails.length === 0 ? <p className="text-secondary-400 text-sm text-center py-6">No emails sent yet</p>
              : <div className="divide-y divide-secondary-50">{emails.map((email) => (
                <div key={email.id} className="flex items-start justify-between py-3">
                  <div><p className="text-sm font-medium text-secondary-900">{email.subject}</p><p className="text-xs text-secondary-500">{email.to?.join(", ")}</p></div>
                  <p className="text-xs text-secondary-400 whitespace-nowrap ml-4">{new Date(email.created_at).toLocaleDateString()}</p>
                </div>
              ))}</div>}
          </div>
        </section>
      )}

      {/* Broadcast */}
      {tab === "broadcast" && (
        <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-2"><Users size={22} className="text-primary-500" />Broadcast to Customers</h2>
          <div className="flex items-center gap-2 mb-6 p-3 bg-primary-50 rounded-lg">
            <Info size={15} className="text-primary-500 flex-shrink-0" />
            <p className="text-sm text-secondary-600"><strong>{customerEmails.length}</strong> unique live customer email{customerEmails.length !== 1 ? "s" : ""} found from paid orders.</p>
          </div>
          <form onSubmit={handleBroadcast} className="space-y-4">
            <div><label className="label-text">Subject</label><input required value={broadcast.subject} onChange={(e) => setBroadcast({ ...broadcast, subject: e.target.value })} className="input-field" placeholder="New arrivals just dropped! 🔥" /></div>
            <div><label className="label-text">Body (HTML)</label><textarea required rows={10} value={broadcast.html} onChange={(e) => setBroadcast({ ...broadcast, html: e.target.value })} className="input-field font-mono text-sm" placeholder="<p>Hey,</p><p>Check out our latest collection...</p>" /></div>
            {broadcastError && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{broadcastError}</div>}
            {broadcastDone && <div className="bg-success-50 border border-success-100 text-success-700 rounded-lg p-3 text-sm flex items-center gap-2"><CheckCircle size={16} />{broadcastDone}</div>}
            <button type="submit" disabled={broadcasting || !customerEmails.length} className="btn-primary">
              {broadcasting ? <><Loader2 size={18} className="mr-2 animate-spin" />Sending...</> : <><Send size={18} className="mr-2" />Send to {customerEmails.length} customers</>}
            </button>
          </form>
        </section>
      )}

      {/* Delivery events */}
      {tab === "events" && (
        <section className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-secondary-100">
            <div>
              <h2 className="font-semibold text-secondary-900">Delivery Events</h2>
              <p className="text-xs text-secondary-400 mt-0.5">Webhook URL: <code className="bg-secondary-100 px-1 rounded">{(process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "")}/api/resend/webhook</code></p>
            </div>
            <button onClick={fetchEvents} className="text-secondary-400 hover:text-secondary-700"><RefreshCw size={16} className={loadingEvents ? "animate-spin" : ""} /></button>
          </div>

          {events.length === 0 && !loadingEvents && !webhookConfigured && (
            <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-start justify-between gap-2 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500" />
                <span>Add the webhook URL above in your <a href="https://resend.com/webhooks" target="_blank" rel="noreferrer" className="underline font-medium">Resend dashboard → Webhooks</a> to start receiving delivery events.</span>
              </div>
              <button onClick={() => { localStorage.setItem("resend_webhook_configured", "1"); setWebhookConfigured(true); }} className="flex-shrink-0 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-1 rounded font-medium whitespace-nowrap">Already configured</button>
            </div>
          )}

          {/* Stats */}
          {events.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-secondary-100 border-b border-secondary-100">
              {Object.entries(eventBadge).map(([key, { label, cls }]) => {
                const count = events.filter(e => e.event_type === key).length;
                return (
                  <button key={key} onClick={() => setEventFilter(eventFilter === key ? "all" : key)}
                    className={`flex flex-col items-center py-3 px-2 bg-white hover:bg-secondary-50 transition-colors ${eventFilter === key ? "ring-2 ring-inset ring-primary-400" : ""}`}>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
                    <span className="text-lg font-bold text-secondary-900 mt-1">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {loadingEvents
            ? <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-secondary-300 border-t-secondary-900" /></div>
            : events.length === 0
              ? <div className="p-10 text-center text-secondary-400"><Mail size={36} className="mx-auto mb-2 text-secondary-200" />No events yet — add the webhook in Resend to start tracking</div>
              : (
                <div className="divide-y divide-secondary-50">
                  {events
                    .filter(ev => eventFilter === "all" || ev.event_type === eventFilter)
                    .map((ev, i) => {
                      const badge = eventBadge[ev.event_type] || { label: ev.event_type, cls: "bg-secondary-100 text-secondary-500" };
                      return (
                        <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-secondary-50">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-secondary-900 truncate">{ev.subject || "—"}</p>
                            <p className="text-xs text-secondary-500">{ev.to_email}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                            <p className="text-xs text-secondary-400 whitespace-nowrap">{new Date(ev.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  {eventFilter !== "all" && events.filter(ev => ev.event_type === eventFilter).length === 0 && (
                    <p className="text-center text-secondary-400 text-sm py-8">No {eventBadge[eventFilter]?.label.toLowerCase()} events</p>
                  )}
                </div>
              )}
        </section>
      )}

      {tab === "settings" && (
        <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-primary-500" />
            <h2 className="font-semibold text-secondary-900">Resend API Key</h2>
          </div>
          <p className="text-sm text-secondary-500">Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">resend.com/api-keys</a>. Stored in your database — takes priority over any environment variable.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text">From Address</label>
              <input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} className="input-field font-mono text-sm" placeholder="orders@yourdomain.com" />
              <p className="text-xs text-secondary-400 mt-1">Used as the sender on all transactional emails. Must be a verified Resend domain.</p>
            </div>
            <div>
              <label className="label-text">Support Address</label>
              <input value={emailSupport} onChange={(e) => setEmailSupport(e.target.value)} className="input-field font-mono text-sm" placeholder="hello@yourdomain.com" />
              <p className="text-xs text-secondary-400 mt-1">Shown in email footers as the reply-to contact address.</p>
            </div>
          </div>
          {keyMsg && <p className={`text-sm px-3 py-2 rounded-lg ${keyMsg.ok ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>{keyMsg.text}</p>}
          <div className="space-y-3">
            <label className="label-text">API Key</label>
            <div className="relative">
              <input
                type={keyMasked ? "password" : "text"}
                value={resendKey}
                onChange={(e) => setResendKey(e.target.value)}
                placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                className="input-field pr-10 font-mono text-sm"
              />
              <button type="button" onClick={() => setKeyMasked(m => !m)} className="absolute right-3 top-2.5 text-secondary-400 hover:text-secondary-700">
                {keyMasked ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={validateKey} disabled={!resendKey.trim() || keyValidating} className="btn-outline py-2 text-sm flex items-center gap-1.5">
                {keyValidating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {keyValidating ? "Validating..." : "Validate"}
              </button>
              <button onClick={saveKey} disabled={keySaving} className="btn-primary py-2 text-sm flex items-center gap-1.5">
                {keySaving ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />}
                {keySaving ? "Saving..." : "Save Key"}
              </button>
              {resendKey && (
                <button onClick={() => { setResendKey(""); saveKey(); }} className="btn-outline py-2 text-sm text-error-600 border-error-200 hover:bg-error-50">Remove</button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminEmailPage() {
  return <ProtectedAdmin><EmailPanel /></ProtectedAdmin>;
}
