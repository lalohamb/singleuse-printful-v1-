"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Lock, Unlock, Save, Eye, EyeOff, ExternalLink } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type Policy = { id: string; title: string; content: string; locked: boolean; updated_at: string };

const POLICIES = [
  { id: "terms",   title: "Terms of Service",          href: "/terms-of-service" },
  { id: "privacy", title: "Privacy Policy",            href: "/privacy-policy" },
  { id: "refund",  title: "Refund and Returns Policy", href: "/refund-policy" },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<string, Policy>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("policies").select("*").then(({ data }) => {
      if (!data) return;
      const map: Record<string, Policy> = {};
      const d: Record<string, string> = {};
      data.forEach((p: Policy) => { map[p.id] = p; d[p.id] = p.content; });
      setPolicies(map);
      setDrafts(d);
    });
  }, []);

  const onChange = (id: string, val: string) => {
    setDrafts((prev) => ({ ...prev, [id]: val }));
    setDirty((prev) => ({ ...prev, [id]: val !== policies[id]?.content }));
  };

  const save = async (id: string) => {
    if (policies[id]?.locked) return;
    setSaving((prev) => ({ ...prev, [id]: true }));
    const { error } = await supabase.from("policies").upsert({ id, title: POLICIES.find(p => p.id === id)!.title, content: drafts[id], locked: policies[id]?.locked ?? false, updated_at: new Date().toISOString() });
    setSaving((prev) => ({ ...prev, [id]: false }));
    if (!error) {
      setPolicies((prev) => ({ ...prev, [id]: { ...prev[id], content: drafts[id] } }));
      setDirty((prev) => ({ ...prev, [id]: false }));
      setMsg((prev) => ({ ...prev, [id]: "Saved & published!" }));
      const policyHref = POLICIES.find(p => p.id === id)?.href;
      if (policyHref) fetch("/api/revalidate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths: [policyHref] }) });
      setTimeout(() => setMsg((prev) => ({ ...prev, [id]: "" })), 3000);
    }
  };

  const toggleLock = async (id: string) => {
    const newLocked = !policies[id]?.locked;
    await supabase.from("policies").update({ locked: newLocked }).eq("id", id);
    setPolicies((prev) => ({ ...prev, [id]: { ...prev[id], locked: newLocked } }));
    setMsg((prev) => ({ ...prev, [id]: newLocked ? "Locked." : "Unlocked." }));
    setTimeout(() => setMsg((prev) => ({ ...prev, [id]: "" })), 2000);
  };

  return (
    <ProtectedAdmin>
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Policies</h1>
          <p className="text-secondary-500 text-sm mt-1">Edit, preview, lock and publish your store policies.</p>
        </div>
        {POLICIES.map(({ id, title, href }) => {
          const policy = policies[id];
          const isLocked = policy?.locked ?? false;
          const isPreview = previewing[id] ?? false;
          const isDirty = dirty[id] ?? false;
          return (
            <section key={id} className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-secondary-900">{title}</h2>
                  {isLocked && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Lock size={11} />Locked</span>}
                  {isDirty && !isLocked && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                  <a href={href} target="_blank" rel="noopener noreferrer" className="p-2 text-secondary-400 hover:text-secondary-700 transition-colors" title="View live page"><ExternalLink size={16} /></a>
                  <button onClick={() => setPreviewing((prev) => ({ ...prev, [id]: !isPreview }))} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-secondary-200 text-secondary-600 hover:border-secondary-400 transition-colors">
                    {isPreview ? <><EyeOff size={13} />Edit</> : <><Eye size={13} />Preview</>}
                  </button>
                  <button onClick={() => toggleLock(id)} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-colors ${isLocked ? "border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-secondary-200 text-secondary-600 hover:border-secondary-400"}`}>
                    {isLocked ? <><Unlock size={13} />Unlock</> : <><Lock size={13} />Lock</>}
                  </button>
                  <button onClick={() => save(id)} disabled={isLocked || !isDirty || saving[id]} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-secondary-900 text-white hover:bg-secondary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <Save size={13} />{saving[id] ? "Saving…" : "Push Update"}
                  </button>
                </div>
              </div>

              {msg[id] && <p className="text-xs text-green-600 font-medium">{msg[id]}</p>}

              {isPreview ? (
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto border border-secondary-100 rounded-lg p-6 prose prose-sm max-w-none text-secondary-600 leading-relaxed whitespace-pre-wrap">
                  {drafts[id] || <span className="text-secondary-300 italic">No content yet.</span>}
                </div>
              ) : (
                <textarea
                  value={drafts[id] ?? ""}
                  onChange={(e) => onChange(id, e.target.value)}
                  disabled={isLocked}
                  rows={18}
                  className="w-full input-field font-mono text-sm leading-relaxed resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={`Enter ${title} content here…`}
                />
              )}

              {policy?.updated_at && (
                <p className="text-xs text-secondary-400">Last updated: {new Date(policy.updated_at).toLocaleString()}</p>
              )}
            </section>
          );
        })}
      </div>
    </ProtectedAdmin>
  );
}
