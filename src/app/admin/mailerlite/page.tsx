"use client";
import { useEffect, useState } from "react";
import { Users, Mail, BarChart2, RefreshCw, Plus, Trash2, X, Loader2, Check, AlertCircle, ExternalLink, FolderOpen, Search, Edit2, UserMinus, Zap, FileText, ChevronLeft, ChevronRight, Copy, TrendingUp, MousePointer } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { getErrorMessage } from "@/lib/errors";

interface SubscriberField { key: string; value: string }
interface Subscriber { id: string; email: string; status: string; type: string; date_created: string; source?: string | null; sent?: number; opens_count?: number; clicks_count?: number; open_rate?: number; fields?: SubscriberField[] }
interface Group { id: string; name: string; total: number; active: number }
interface Campaign { id: string; name: string; status: string; date_created: string; opened: number; clicked: number; sent: number; unsubscribed: number; open_rate: number; click_rate: number }
interface Automation { id: string; name: string; enabled: boolean; steps_count: number; trigger_type: string | null; trigger_group: string | null; sent: number; open_rate: number; completed: number; in_queue: number; screenshot_url: string | null }
interface Form { id: string; name: string; type: string; conversions_count: number; url?: string | null }
interface Account { account: { name: string; email: string }; statistics?: { total_subscribers: number; open_rate: { float: number }; click_rate: { float: number } } }

const statusBadge: Record<string, string> = {
  active: "bg-success-50 text-success-600",
  unsubscribed: "bg-secondary-100 text-secondary-500",
  bounced: "bg-error-50 text-error-600",
  junk: "bg-warning-50 text-warning-600",
  sent: "bg-primary-50 text-primary-600",
  draft: "bg-secondary-100 text-secondary-500",
  ready: "bg-success-50 text-success-600",
  finished: "bg-success-50 text-success-600",
};

function api(action: string, params = "") {
  return fetch(`/api/mailerlite?action=${action}${params}`).then((r) => r.json());
}
function post(body: object) {
  return fetch("/api/mailerlite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

// ── Modals ──────────────────────────────────────────────────────────────────

function AddSubscriberModal({ groups, onClose, onDone }: { groups: Group[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ email: "", name: "", group: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await post({ action: "add_subscriber", email: form.email, name: form.name, groups: form.group ? [form.group] : [] });
    if (res.error || res.message) setError(typeof res.message === "string" ? res.message : typeof res.error === "string" ? res.error : JSON.stringify(res.message || res.error));
    else { setDone(true); setTimeout(() => { onDone(); onClose(); }, 1000); }
    setLoading(false);
  };

  return (
    <Modal title="Add Subscriber" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label-text">Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="subscriber@example.com" /></div>
        <div><label className="label-text">Name (optional)</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" /></div>
        <div><label className="label-text">Group (optional)</label>
          <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className="input-field">
            <option value="">No group</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {error && <ErrorMsg msg={error} />}
        <SubmitBtn loading={loading} done={done} label="Add Subscriber" />
      </form>
    </Modal>
  );
}

function EditSubscriberModal({ subscriber, groups, onClose, onDone }: { subscriber: Subscriber; groups: Group[]; onClose: () => void; onDone: (patch?: Partial<Subscriber>) => void }) {
  const [status, setStatus] = useState(subscriber.type || subscriber.status);
  const [name, setName] = useState(subscriber.fields?.find((f) => f.key === "name")?.value || "");
  const [lastName, setLastName] = useState(subscriber.fields?.find((f) => f.key === "last_name")?.value || "");
  const [subGroups, setSubGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api("subscriber_groups", `&id=${subscriber.id}`).then((data) => setSubGroups(Array.isArray(data) ? data : []));
  }, [subscriber.id]);

  const handleSave = async () => {
    setLoading(true); setError(null);
    const res = await post({ action: "update_subscriber", id: subscriber.id, status, fields: subscriber.fields?.map(f => f.key === "name" ? { ...f, value: name } : f.key === "last_name" ? { ...f, value: lastName } : f) || [{ key: "name", value: name }, { key: "last_name", value: lastName }] });
    if (res.error) setError(typeof res.error === "string" ? res.error : JSON.stringify(res.error));
    else { setDone(true); setTimeout(() => { onDone(); onClose(); }, 800); }
    setLoading(false);
  };

  const removeFromGroup = async (groupId: string) => {
    await post({ action: "remove_from_group", group_id: groupId, subscriber_id: subscriber.id });
    setSubGroups((p) => p.filter((g) => g.id !== groupId));
  };

  const addToGroup = async (groupId: string) => {
    await post({ action: "assign_group", group_id: groupId, email: subscriber.email });
    const g = groups.find((g) => g.id === groupId);
    if (g && !subGroups.find((sg) => sg.id === groupId)) setSubGroups((p) => [...p, g]);
  };

  return (
    <Modal title="Edit Subscriber" onClose={onClose}>
      <div className="space-y-4">
        <div><label className="label-text">Email</label><p className="text-sm text-secondary-700 font-medium mt-1">{subscriber.email}</p></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-text">First Name</label><input value={name} onChange={(e) => setName(e.target.value)} className="input-field" /></div>
          <div><label className="label-text">Last Name</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input-field" /></div>
        </div>
        <div><label className="label-text">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field">
            {["active", "unsubscribed", "bounced", "junk"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {(subscriber.sent !== undefined) && (
          <div className="grid grid-cols-3 gap-2">
            {[{label:"Sent",value:subscriber.sent},{label:"Opens",value:subscriber.opens_count},{label:"Clicks",value:subscriber.clicks_count}].map(({label,value}) => (
              <div key={label} className="bg-secondary-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-secondary-900">{value ?? 0}</p>
                <p className="text-xs text-secondary-500">{label}</p>
              </div>
            ))}
          </div>
        )}
        <div>
          <label className="label-text mb-2 block">Groups</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {subGroups.map((g) => (
              <span key={g.id} className="flex items-center gap-1 text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                {g.name}
                <button onClick={() => removeFromGroup(g.id)} className="hover:text-error-600"><X size={11} /></button>
              </span>
            ))}
            {subGroups.length === 0 && <span className="text-xs text-secondary-400">No groups</span>}
          </div>
          <select onChange={(e) => { if (e.target.value) addToGroup(e.target.value); e.target.value = ""; }} className="input-field text-sm" defaultValue="">
            <option value="">+ Add to group...</option>
            {groups.filter((g) => !subGroups.find((sg) => sg.id === g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {error && <ErrorMsg msg={error} />}
        <SubmitBtn loading={loading} done={done} label="Save Changes" onClick={handleSave} />
      </div>
    </Modal>
  );
}

function CreateCampaignModal({ groups, defaultFromName, defaultFromEmail, onClose, onDone }: { groups: Group[]; defaultFromName: string; defaultFromEmail: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", subject: "", from_name: defaultFromName, from_email: defaultFromEmail, html: "", group: "", send_now: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await post({ action: "create_campaign", ...form, groups: form.group ? [form.group] : [] });
    if (res.error || res.message || res.errors) {
      const msg = typeof res.message === "string" ? res.message
        : typeof res.error === "string" ? res.error
        : res.errors ? Object.values(res.errors).flat().join(", ")
        : JSON.stringify(res.message || res.error || res.errors);
      setError(msg);
    }
    else { setDone(true); setTimeout(() => { onDone(); onClose(); }, 1200); }
    setLoading(false);
  };

  return (
    <Modal title="Create Campaign" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label-text">Campaign Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. July Newsletter" /></div>
        <div><label className="label-text">Subject Line</label><input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input-field" placeholder="e.g. New arrivals just dropped 🔥" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-text">From Name</label><input required value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} className="input-field" /></div>
          <div><label className="label-text">From Email</label><input required type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} className="input-field" /><p className="text-xs text-secondary-400 mt-1">Must be a domain verified in MailerLite — no Gmail/Yahoo addresses.</p></div>
        </div>
        <div><label className="label-text">Send To Group</label>
          <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} className="input-field">
            <option value="">All subscribers (all groups)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.active ?? g.total ?? 0})</option>)}
          </select>
        </div>
        <div>
          <label className="label-text">Email Body (HTML)</label>
          <textarea required value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} className="input-field min-h-[180px] font-mono text-xs" placeholder="<h1>Hello!</h1><p>Check out our latest collection...</p>" />
          <p className="text-xs text-secondary-400 mt-1">Tip: paste plain text or basic HTML. For rich designs use MailerLite&apos;s editor.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.send_now} onChange={(e) => setForm({ ...form, send_now: e.target.checked })} className="w-4 h-4 rounded text-gold-500" />
          <span className="text-sm text-secondary-700">Send immediately (uncheck to save as draft)</span>
        </label>
        {error && <ErrorMsg msg={error} />}
        <SubmitBtn loading={loading} done={done} label={form.send_now ? "Send Campaign" : "Save as Draft"} />
      </form>
    </Modal>
  );
}

function GroupModal({ group, onClose, onDone }: { group?: Group; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(group?.name || "");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = group
      ? await post({ action: "rename_group", id: group.id, name })
      : await post({ action: "create_group", name });
    if (res.error) setError(res.error);
    else { setDone(true); setTimeout(() => { onDone(); onClose(); }, 1000); }
    setLoading(false);
  };

  return (
    <Modal title={group ? "Rename Group" : "Create Group"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label-text">Group Name</label><input required value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. Customers" /></div>
        {error && <ErrorMsg msg={error} />}
        <SubmitBtn loading={loading} done={done} label={group ? "Rename" : "Create Group"} />
      </form>
    </Modal>
  );
}

// ── Shared UI ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-secondary-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-secondary-400 hover:text-secondary-900"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  const is500 = msg.includes("500") || msg.toLowerCase().includes("internal server error");
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-error-600 text-sm"><AlertCircle size={16} className="flex-shrink-0" />{msg}</div>
      {is500 && (
        <p className="text-xs text-secondary-500 pl-6">A 500 error from MailerLite usually means the <strong>From email address</strong> is not verified with them. Check that your sending domain is authenticated under <a href="https://app.mailerlite.com/settings/domains" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline">MailerLite → Settings → Domains</a>.</p>
      )}
    </div>
  );
}

function SubmitBtn({ loading, done, label, onClick }: { loading: boolean; done: boolean; label: string; onClick?: () => void }) {
  return (
    <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={loading || done} className="btn-primary w-full">
      {done ? <><Check size={18} className="mr-2" />Done!</> : loading ? <><Loader2 size={18} className="mr-2 animate-spin" />Processing...</> : label}
    </button>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

function MailerLiteDashboard() {
  const [account, setAccount] = useState<Account | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subMeta, setSubMeta] = useState<{ total: number; next_cursor?: string; prev_cursor?: string } | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"subscribers" | "groups" | "campaigns" | "automations" | "forms">("subscribers");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cursor, setCursor] = useState("");
  const [modal, setModal] = useState<"add_sub" | "edit_sub" | "add_group" | "edit_group" | "create_campaign" | null>(null);
  const [selectedSub, setSelectedSub] = useState<Subscriber | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true); setError(null);
    try {
      const [statsData, subsData, formsData] = await Promise.all([
        api("stats"),
        api("subscribers", "&limit=25"),
        api("all_forms"),
      ]);
      if (statsData.error) throw new Error(statsData.error);
      setAccount(statsData.account);
      setGroups(statsData.groups || []);
      setCampaigns(statsData.campaigns || []);
      setAutomations(statsData.automations || []);
      setForms(Array.isArray(formsData) ? formsData : (statsData.forms || []));
      setSubscribers(Array.isArray(subsData) ? subsData : (subsData.data || []));
      setSubMeta(subsData.meta || null);
    } catch (e: unknown) { setError(getErrorMessage(e)); }
    setLoading(false);
  };

  const fetchSubscribers = async (cur = "", q = search, f = statusFilter) => {
    const data = await api("subscribers", `&limit=25${cur ? `&cursor=${cur}` : ""}${q ? `&search=${q}` : ""}${f ? `&filter=${f}` : ""}`);
    setSubscribers(Array.isArray(data) ? data : (data.data || []));
    setSubMeta(data.meta || null);
    setCursor(cur);
  };

  useEffect(() => { fetchAll(); }, []);

  const deleteSub = async (id: string) => {
    setDeleting(id);
    await post({ action: "delete_subscriber", id });
    setSubscribers((p) => p.filter((s) => s.id !== id));
    setDeleting(null);
  };

  const unsubscribeSub = async (id: string) => {
    setDeleting(id);
    await post({ action: "unsubscribe", id });
    setSubscribers((p) => p.map((s) => s.id === id ? { ...s, type: "unsubscribed", status: "unsubscribed" } : s));
    setDeleting(null);
  };

  const deleteGroup = async (id: string) => {
    setDeleting(id);
    await post({ action: "delete_group", id });
    setGroups((p) => p.filter((g) => g.id !== id));
    setDeleting(null);
  };

  const totalSubs = account?.statistics?.total_subscribers ?? subMeta?.total ?? subscribers.length;
  const activeSubs = subscribers.filter((s) => s.type === "active" || s.status === "active").length;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  if (error) return (
    <div className="bg-error-50 border border-error-100 rounded-xl p-6 text-center">
      <AlertCircle size={32} className="mx-auto mb-3 text-error-500" />
      <p className="font-semibold text-error-700 mb-1">Could not connect to MailerLite</p>
      <p className="text-sm text-error-600 mb-2">{error}</p>
      <p className="text-xs text-secondary-500">Make sure <code>MAILER_LITE_API_KEY</code> is set in <code>.env.local</code></p>
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Requirements banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 space-y-3">
        <p className="font-semibold text-secondary-900 flex items-center gap-2"><Mail size={18} className="text-primary-500" />MailerLite Requirements</p>
        <ul className="space-y-2 text-sm text-secondary-600">
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5 flex-shrink-0">✦</span>
            <span><strong>Verified custom domain required</strong> — campaigns cannot be sent from Gmail, Yahoo, or other free email addresses. Use a domain you own (e.g. <code className="bg-white px-1 rounded text-xs">orders@your-domain.com</code>) and verify it under <a href="https://app.mailerlite.com/settings/domains" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">MailerLite → Settings → Domains</a>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5 flex-shrink-0">✦</span>
            <span><strong>At least one group required</strong> — MailerLite&apos;s API requires subscribers to be in a group. Campaigns sent to &quot;All subscribers&quot; will automatically include all groups in your account.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5 flex-shrink-0">✦</span>
            <span><strong>HTML email body</strong> — paste plain text or basic HTML. For rich drag-and-drop designs, build the campaign directly in <a href="https://app.mailerlite.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 underline hover:text-primary-700">MailerLite&apos;s editor</a> and send from there.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-500 mt-0.5 flex-shrink-0">✦</span>
            <span><strong>API key</strong> — set <code className="bg-white px-1 rounded text-xs">MAILER_LITE_API_KEY</code> in <code className="bg-white px-1 rounded text-xs">.env.local</code> and in Supabase edge function secrets.</span>
          </li>
        </ul>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {account?.account && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-success-50 border border-success-100 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-success-500 flex-shrink-0" />
              <span className="text-xs font-medium text-success-700">Connected:</span>
              <span className="text-xs text-success-700 font-semibold">{account.account.name}</span>
              <span className="text-xs text-success-600">&middot; {account.account.email}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a href="https://app.mailerlite.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium">Open MailerLite <ExternalLink size={16} /></a>
          <button onClick={fetchAll} className="flex items-center gap-2 text-sm text-secondary-500 hover:text-secondary-900"><RefreshCw size={16} />Refresh</button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Subscribers", value: totalSubs, icon: Users, color: "bg-primary-50 text-primary-600" },
          { label: "Active (this page)", value: activeSubs, icon: Check, color: "bg-success-50 text-success-600" },
          { label: "Groups", value: groups.length, icon: FolderOpen, color: "bg-accent-50 text-accent-600" },
          { label: "Campaigns", value: campaigns.length, icon: BarChart2, color: "bg-warning-50 text-warning-600" },
          { label: "Automations", value: automations.length, icon: Zap, color: "bg-primary-50 text-primary-600" },
          { label: "Forms", value: forms.length, icon: FileText, color: "bg-secondary-100 text-secondary-600" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border border-secondary-100 shadow-sm">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${card.color}`}><card.icon size={20} /></div>
            <p className="text-2xl font-bold text-secondary-900">{card.value}</p>
            <p className="text-xs text-secondary-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-secondary-100">
          <div className="flex flex-wrap gap-1">
            {(["subscribers", "groups", "campaigns", "automations", "forms"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-secondary-900 text-white" : "text-secondary-500 hover:text-secondary-900 hover:bg-secondary-50"}`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === "subscribers" && (
              <>
                <div className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-secondary-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchSubscribers("", search, statusFilter)} placeholder="Search email..." className="input-field pl-8 py-2 text-sm w-44" /></div>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); fetchSubscribers("", search, e.target.value); }} className="input-field py-2 text-sm w-auto">
                  <option value="">All</option>
                  {["active", "unsubscribed", "bounced", "junk"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => setModal("add_sub")} className="btn-primary py-2 text-sm flex items-center gap-1"><Plus size={15} />Add</button>
              </>
            )}
            {tab === "groups" && (
              <button onClick={() => { setSelectedGroup(null); setModal("add_group"); }} className="btn-primary py-2 text-sm flex items-center gap-1"><Plus size={15} />New Group</button>
            )}
            {tab === "campaigns" && (
              <button onClick={() => setModal("create_campaign")} className="btn-primary py-2 text-sm flex items-center gap-1"><Plus size={15} />New Campaign</button>
            )}
          </div>
        </div>

        {/* Subscribers Tab */}
        {tab === "subscribers" && (
          <>
            {subscribers.length === 0 ? (
              <div className="p-10 text-center text-secondary-400"><Users size={36} className="mx-auto mb-2 text-secondary-200" />No subscribers found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary-50 border-b border-secondary-100">
                    <tr>{["Email", "Name", "Status", "Source", "Sent", "Opens", "Joined", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-50">
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="hover:bg-secondary-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-secondary-900">{sub.email}</td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{sub.fields?.find((f) => f.key === "name")?.value || "—"} {sub.fields?.find((f) => f.key === "last_name")?.value || ""}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${statusBadge[sub.type] || statusBadge[sub.status] || "bg-secondary-100 text-secondary-500"}`}>{sub.type || sub.status}</span></td>
                        <td className="px-4 py-3 text-xs text-secondary-400 capitalize">{sub.source || "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{sub.sent ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{sub.opens_count ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{sub.date_created ? new Date(sub.date_created).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setSelectedSub(sub); setModal("edit_sub"); }} className="p-1.5 text-secondary-400 hover:text-primary-600 transition-colors" title="Edit"><Edit2 size={15} /></button>
                            <button onClick={() => unsubscribeSub(sub.id)} disabled={deleting === sub.id || sub.type === "unsubscribed" || sub.status === "unsubscribed"} className="p-1.5 text-secondary-400 hover:text-warning-600 transition-colors disabled:opacity-30" title="Unsubscribe"><UserMinus size={15} /></button>
                            <button onClick={() => deleteSub(sub.id)} disabled={deleting === sub.id} className="p-1.5 text-secondary-400 hover:text-error-600 transition-colors" title="Delete">
                              {deleting === sub.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {subMeta && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 text-sm text-secondary-500">
                <span>{subMeta.total} total subscribers</span>
                <div className="flex gap-2">
                  <button disabled={!cursor} onClick={() => fetchSubscribers("")} className="p-1.5 rounded hover:bg-secondary-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <button disabled={!subMeta.next_cursor} onClick={() => fetchSubscribers(subMeta.next_cursor!)} className="p-1.5 rounded hover:bg-secondary-100 disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Groups Tab */}
        {tab === "groups" && (
          groups.length === 0 ? (
            <div className="p-10 text-center text-secondary-400"><FolderOpen size={36} className="mx-auto mb-2 text-secondary-200" />No groups yet</div>
          ) : (
            <div className="divide-y divide-secondary-50">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between px-5 py-4 hover:bg-secondary-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center"><FolderOpen size={18} className="text-primary-500" /></div>
                    <div><p className="font-medium text-secondary-900">{group.name}</p><p className="text-xs text-secondary-500">{group.active ?? group.total ?? 0} active subscribers</p></div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelectedGroup(group); setModal("edit_group"); }} className="p-1.5 text-secondary-400 hover:text-primary-600 transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => deleteGroup(group.id)} disabled={deleting === group.id} className="p-1.5 text-secondary-400 hover:text-error-600 transition-colors">
                      {deleting === group.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Campaigns Tab */}
        {tab === "campaigns" && (
          campaigns.length === 0 ? (
            <div className="p-10 text-center text-secondary-400"><Mail size={36} className="mx-auto mb-2 text-secondary-200" />No campaigns yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>{["Campaign", "Status", "Sent", "Open Rate", "Click Rate", "Unsubs", "Created", ""].map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-secondary-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-secondary-900 max-w-[200px] truncate">{c.name}</td>
                        <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${statusBadge[c.status] || "bg-secondary-100 text-secondary-500"}`}>{c.status}</span></td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{c.sent ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{c.open_rate ? `${c.open_rate}%` : "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{c.click_rate ? `${c.click_rate}%` : "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-600">{c.unsubscribed ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-secondary-500">{c.date_created ? new Date(c.date_created).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          {c.status === "draft" && (
                            <button onClick={async () => { setDeleting(c.id); await post({ action: "delete_campaign", id: c.id }); setCampaigns((p) => p.filter((x) => x.id !== c.id)); setDeleting(null); }} disabled={deleting === c.id} className="p-1.5 text-secondary-400 hover:text-error-600 transition-colors">
                              {deleting === c.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                            </button>
                          )}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Automations Tab */}
        {tab === "automations" && (
          automations.length === 0 ? (
            <div className="p-10 text-center text-secondary-400"><Zap size={36} className="mx-auto mb-2 text-secondary-200" />No automations yet</div>
          ) : (
            <div className="divide-y divide-secondary-50">
              {automations.map((a) => (
                <div key={a.id} className="p-5 hover:bg-secondary-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${a.enabled ? "bg-success-50" : "bg-secondary-100"}`}>
                        <Zap size={18} className={a.enabled ? "text-success-500" : "text-secondary-400"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-secondary-900">{a.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${a.enabled ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}>{a.enabled ? "Active" : "Disabled"}</span>
                        </div>
                        {(a.trigger_type || a.trigger_group) && (
                          <p className="text-xs text-secondary-500 mt-0.5">
                            Trigger: <span className="font-medium">{a.trigger_type?.replace(/_/g, " ")}</span>
                            {a.trigger_group && <> → <span className="font-medium">{a.trigger_group}</span></>}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="text-xs text-secondary-500">{a.steps_count} email{a.steps_count !== 1 ? "s" : ""}</span>
                          <span className="text-xs text-secondary-500">Sent: <span className="font-medium text-secondary-700">{a.sent}</span></span>
                          <span className="text-xs text-secondary-500">Completed: <span className="font-medium text-secondary-700">{a.completed}</span></span>
                          <span className="text-xs text-secondary-500">In queue: <span className="font-medium text-secondary-700">{a.in_queue}</span></span>
                          <span className="text-xs text-secondary-500">Open rate: <span className="font-medium text-secondary-700">{a.open_rate ? `${Math.round(a.open_rate * 100)}%` : "—"}</span></span>
                        </div>
                      </div>
                    </div>
                    {a.screenshot_url && (
                      <a href={a.screenshot_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                        <img src={a.screenshot_url} alt="Email preview" className="w-16 h-20 object-cover rounded border border-secondary-100 hover:opacity-80 transition-opacity" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Forms Tab */}
        {tab === "forms" && (
          forms.length === 0 ? (
            <div className="p-10 text-center text-secondary-400"><FileText size={36} className="mx-auto mb-2 text-secondary-200" />No forms yet</div>
          ) : (
            <div className="divide-y divide-secondary-50">
              {forms.map((f) => (
                <div key={f.id} className="flex items-center justify-between px-5 py-4 hover:bg-secondary-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center"><FileText size={18} className="text-primary-500" /></div>
                    <div>
                      <p className="font-medium text-secondary-900">{f.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-secondary-100 text-secondary-500 px-2 py-0.5 rounded-full capitalize">{f.type}</span>
                        <span className="text-xs text-secondary-400">{f.conversions_count} conversions</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.url && (
                      <button onClick={() => { navigator.clipboard.writeText(f.url!); }} className="flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-secondary-200 text-secondary-600 hover:border-secondary-400 transition-colors" title="Copy URL">
                        <Copy size={13} />Copy URL
                      </button>
                    )}
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-secondary-400 hover:text-primary-600 transition-colors"><ExternalLink size={15} /></a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {modal === "add_sub" && <AddSubscriberModal groups={groups} onClose={() => setModal(null)} onDone={fetchAll} />}
      {modal === "edit_sub" && selectedSub && <EditSubscriberModal subscriber={selectedSub} groups={groups} onClose={() => setModal(null)} onDone={(patch) => { if (patch) setSubscribers((p) => p.map((s) => s.id === selectedSub.id ? { ...s, ...patch } : s)); else fetchAll(); }} />}
      {modal === "add_group" && <GroupModal onClose={() => setModal(null)} onDone={fetchAll} />}
      {modal === "edit_group" && selectedGroup && <GroupModal group={selectedGroup} onClose={() => setModal(null)} onDone={fetchAll} />}
      {modal === "create_campaign" && <CreateCampaignModal groups={groups} defaultFromName={account?.account?.name || ""} defaultFromEmail={account?.account?.email || ""} onClose={() => setModal(null)} onDone={fetchAll} />}
    </div>
  );
}

export default function AdminMailerLitePage() {
  return <ProtectedAdmin><MailerLiteDashboard /></ProtectedAdmin>;
}
