"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Lock, Unlock, Save, Eye, EyeOff, ExternalLink,
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Unlink,
  Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight,
  Quote, Minus, Code, Superscript, Subscript,
  Undo2, Redo2, RemoveFormatting, Palette,
} from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import { DEFAULT_POLICY_CONTENT, type PolicyId } from "@/lib/policy-content";

type Policy = { id: string; title: string; content: string; locked: boolean; updated_at: string };

const POLICIES = [
  { id: "terms",   title: "Terms of Service",          href: "/terms-of-service" },
  { id: "privacy", title: "Privacy Policy",            href: "/privacy-policy" },
  { id: "refund",  title: "Refund and Returns Policy", href: "/refund-policy" },
];

const SEP = "sep";

type ToolDef =
  | typeof SEP
  | { cmd: string; label: string; icon: React.ElementType; value?: string; custom?: never }
  | { custom: "link" | "unlink" | "color" | "highlight"; label: string; icon: React.ElementType; cmd?: never };

const TOOLS: ToolDef[] = [
  { cmd: "undo",              label: "Undo",            icon: Undo2 },
  { cmd: "redo",              label: "Redo",            icon: Redo2 },
  SEP,
  { cmd: "formatBlock",       label: "Heading 1",       icon: Heading1,   value: "<h1>" },
  { cmd: "formatBlock",       label: "Heading 2",       icon: Heading2,   value: "<h2>" },
  { cmd: "formatBlock",       label: "Heading 3",       icon: Heading3,   value: "<h3>" },
  SEP,
  { cmd: "bold",              label: "Bold",            icon: Bold },
  { cmd: "italic",            label: "Italic",          icon: Italic },
  { cmd: "underline",         label: "Underline",       icon: Underline },
  { cmd: "strikeThrough",     label: "Strikethrough",   icon: Strikethrough },
  { cmd: "superscript",       label: "Superscript",     icon: Superscript },
  { cmd: "subscript",         label: "Subscript",       icon: Subscript },
  SEP,
  { cmd: "justifyLeft",       label: "Align left",      icon: AlignLeft },
  { cmd: "justifyCenter",     label: "Align center",    icon: AlignCenter },
  { cmd: "justifyRight",      label: "Align right",     icon: AlignRight },
  SEP,
  { cmd: "insertUnorderedList", label: "Bullet list",   icon: List },
  { cmd: "insertOrderedList",   label: "Numbered list", icon: ListOrdered },
  { cmd: "formatBlock",       label: "Blockquote",      icon: Quote,      value: "<blockquote>" },
  { cmd: "formatBlock",       label: "Code block",      icon: Code,       value: "<pre>" },
  { cmd: "insertHorizontalRule", label: "Divider",      icon: Minus },
  SEP,
  { custom: "link",           label: "Insert link",     icon: LinkIcon },
  { custom: "unlink",         label: "Remove link",     icon: Unlink },
  { custom: "color",          label: "Text color",      icon: Palette },
  { custom: "highlight",      label: "Highlight",       icon: Palette },
  SEP,
  { cmd: "removeFormat",      label: "Clear formatting", icon: RemoveFormatting },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Record<string, Policy>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    supabase.from("policies").select("*").then(({ data }) => {
      if (!data) return;
      const map: Record<string, Policy> = {};
      const d: Record<string, string> = {};
      data.forEach((p: Policy) => { map[p.id] = p; d[p.id] = p.content || DEFAULT_POLICY_CONTENT[p.id as PolicyId] || ""; });
      setPolicies(map);
      setDrafts(d);
      data.forEach((p: Policy) => {
        const el = editorRefs.current[p.id];
        if (el) el.innerHTML = p.content || DEFAULT_POLICY_CONTENT[p.id as PolicyId] || "";
      });
    });
  }, []);

  const readEditor = (id: string) => editorRefs.current[id]?.innerHTML ?? "";

  const onInput = (id: string) => {
    const val = readEditor(id);
    setDrafts((prev) => ({ ...prev, [id]: val }));
    setDirty((prev) => ({ ...prev, [id]: val !== policies[id]?.content }));
  };

  const format = (id: string, command: string, value?: string) => {
    editorRefs.current[id]?.focus();
    document.execCommand(command, false, value);
    onInput(id);
  };

  const handleCustom = (id: string, custom: string) => {
    editorRefs.current[id]?.focus();
    if (custom === "link") {
      const url = window.prompt("Link URL (include https://)");
      if (url) { document.execCommand("createLink", false, url); onInput(id); }
    } else if (custom === "unlink") {
      document.execCommand("unlink", false, undefined);
      onInput(id);
    } else if (custom === "color") {
      const color = window.prompt("Text color (hex or name, e.g. #e53e3e or red)");
      if (color) { document.execCommand("foreColor", false, color); onInput(id); }
    } else if (custom === "highlight") {
      const color = window.prompt("Highlight color (hex or name, e.g. #fef08a or yellow)");
      if (color) { document.execCommand("hiliteColor", false, color); onInput(id); }
    }
  };

  const save = async (id: string) => {
    if (policies[id]?.locked) return;
    const content = readEditor(id);
    setSaving((prev) => ({ ...prev, [id]: true }));
    const { error } = await supabase.from("policies").upsert({ id, title: POLICIES.find(p => p.id === id)!.title, content, locked: policies[id]?.locked ?? false, updated_at: new Date().toISOString() });
    setSaving((prev) => ({ ...prev, [id]: false }));
    if (!error) {
      setPolicies((prev) => ({ ...prev, [id]: { ...prev[id], content } }));
      setDrafts((prev) => ({ ...prev, [id]: content }));
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

  const btnClass = "p-1.5 text-secondary-600 hover:bg-white hover:text-secondary-900 rounded transition-colors disabled:opacity-30";

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
              <div className="flex items-center justify-between flex-wrap gap-2">
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
                <div className="min-h-[300px] max-h-[500px] overflow-y-auto border border-secondary-100 rounded-lg p-6 text-secondary-600 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 [&_a]:text-primary-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-secondary-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-secondary-500 [&_pre]:bg-secondary-50 [&_pre]:rounded [&_pre]:p-3 [&_pre]:text-sm [&_pre]:font-mono [&_hr]:border-secondary-200 [&_hr]:my-4" dangerouslySetInnerHTML={{ __html: drafts[id] || "<em>No content yet.</em>" }} />
              ) : (
                <div className={`border border-secondary-200 rounded-lg overflow-hidden ${isLocked ? "opacity-50" : ""}`}>
                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-0.5 p-2 bg-secondary-50 border-b border-secondary-200">
                    {TOOLS.map((tool, i) => {
                      if (tool === SEP) return <div key={i} className="w-px h-5 bg-secondary-200 mx-1" />;
                      const { label, icon: Icon } = tool;
                      if ("custom" in tool && tool.custom) {
                        return (
                          <button key={label} type="button" disabled={isLocked} onMouseDown={(e) => e.preventDefault()} onClick={() => handleCustom(id, tool.custom!)} className={btnClass} title={label} aria-label={label}>
                            <Icon size={15} />
                          </button>
                        );
                      }
                      return (
                        <button key={`${tool.cmd}-${label}`} type="button" disabled={isLocked} onMouseDown={(e) => e.preventDefault()} onClick={() => format(id, tool.cmd!, tool.value)} className={btnClass} title={label} aria-label={label}>
                          <Icon size={15} />
                        </button>
                      );
                    })}
                  </div>
                  {/* Editor */}
                  <div
                    ref={(el) => { editorRefs.current[id] = el; }}
                    contentEditable={!isLocked}
                    suppressContentEditableWarning
                    onInput={() => onInput(id)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const html = e.clipboardData.getData("text/html");
                      const text = e.clipboardData.getData("text/plain");
                      const content = html || text.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>").replace(/^/, "<p>").replace(/$/, "</p>");
                      document.execCommand("insertHTML", false, content);
                      onInput(id);
                    }}
                    className="w-full min-h-[360px] p-4 text-secondary-700 leading-relaxed focus:outline-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-1 [&_a]:text-primary-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-secondary-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-secondary-500 [&_pre]:bg-secondary-50 [&_pre]:rounded [&_pre]:p-3 [&_pre]:text-sm [&_pre]:font-mono [&_hr]:border-secondary-200 [&_hr]:my-4"
                  />
                </div>
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
