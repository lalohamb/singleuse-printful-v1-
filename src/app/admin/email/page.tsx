"use client";
import { useState, useEffect } from "react";
import { Send, Loader2, Check, Mail, RefreshCw } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

interface SentEmail {
  id: string;
  to: string[];
  subject: string;
  created_at: string;
}

function EmailPanel() {
  const [form, setForm] = useState({ to: "", subject: "", html: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);

  const fetchEmails = async () => {
    setLoadingEmails(true);
    try {
      const res = await fetch("/api/resend?path=/emails");
      const data = await res.json();
      setEmails(data.data || []);
    } catch {
      setEmails([]);
    }
    setLoadingEmails(false);
  };

  useEffect(() => { fetchEmails(); }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true); setError(null);
    const res = await fetch("/api/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Body & Sleeves <orders@bodyandsleeves.com>",
        to: form.to.split(",").map((s) => s.trim()),
        subject: form.subject,
        html: form.html,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.message || "Failed to send"); }
    else { setSent(true); setForm({ to: "", subject: "", html: "" }); fetchEmails(); setTimeout(() => setSent(false), 3000); }
    setSending(false);
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Send Email */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-secondary-900 flex items-center gap-2 mb-6">
          <Mail size={22} className="text-primary-500" />Send Email
        </h2>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="label-text">To (comma-separated)</label>
            <input required value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="input-field" placeholder="customer@example.com, another@example.com" />
          </div>
          <div>
            <label className="label-text">Subject</label>
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" placeholder="Your order has shipped!" />
          </div>
          <div>
            <label className="label-text">Body (HTML)</label>
            <textarea required rows={8} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className="input-field font-mono text-sm" placeholder="<p>Hello,</p><p>Your order is on its way!</p>" />
          </div>
          {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm">{error}</div>}
          <button type="submit" disabled={sending} className="btn-primary">
            {sending ? <><Loader2 size={18} className="mr-2 animate-spin" />Sending...</>
              : sent ? <><Check size={18} className="mr-2" />Sent!</>
              : <><Send size={18} className="mr-2" />Send Email</>}
          </button>
        </form>
      </section>

      {/* Recent Emails */}
      <section className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100">
          <h2 className="font-semibold text-secondary-900">Recent Emails</h2>
          <button onClick={fetchEmails} className="text-secondary-400 hover:text-secondary-700 transition-colors">
            <RefreshCw size={18} className={loadingEmails ? "animate-spin" : ""} />
          </button>
        </div>
        {loadingEmails ? (
          <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-2 border-secondary-300 border-t-secondary-900" /></div>
        ) : emails.length === 0 ? (
          <div className="p-10 text-center text-secondary-400"><Mail size={36} className="mx-auto mb-2 text-secondary-200" />No emails sent yet</div>
        ) : (
          <div className="divide-y divide-secondary-50">
            {emails.map((email) => (
              <div key={email.id} className="flex items-start justify-between p-4 hover:bg-secondary-50 transition-colors">
                <div>
                  <p className="font-medium text-sm text-secondary-900">{email.subject}</p>
                  <p className="text-xs text-secondary-500 mt-0.5">{email.to?.join(", ")}</p>
                </div>
                <p className="text-xs text-secondary-400 whitespace-nowrap ml-4">
                  {new Date(email.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminEmailPage() {
  return <ProtectedAdmin><EmailPanel /></ProtectedAdmin>;
}
