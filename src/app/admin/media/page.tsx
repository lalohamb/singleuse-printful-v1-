"use client";
import { useEffect, useState, useRef } from "react";
import { Trash2, Upload, Loader2, Copy, Check, Search, RefreshCw, Pencil, X, FolderOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import AppImage from "@/components/AppImage";

const BUCKET = "store-images";
const FOLDERS = ["uploads", "settings/hero", "settings/our-why", "settings/story", "settings/logo", "settingshero", "settingsour-why", "settingsstory", "settingslogo"];

interface MediaFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size: number; mimetype: string } | null;
  publicUrl: string;
  folder: string;
  path: string;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(str: string) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Media() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    const all: MediaFile[] = [];
    for (const folder of FOLDERS) {
      const { data } = await supabase.storage.from(BUCKET).list(folder, { sortBy: { column: "created_at", order: "desc" } });
      for (const f of data || []) {
        if (!f.name || f.name === ".emptyFolderPlaceholder") continue;
        const path = `${folder}/${f.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        all.push({ name: f.name, id: f.id || path, created_at: f.created_at || "", metadata: f.metadata as MediaFile["metadata"], publicUrl: urlData.publicUrl, folder, path });
      }
    }
    setFiles(all);
    setLoading(false);
  };

  useEffect(() => { fetchFiles(); }, []);

  const handleUpload = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      const ext = file.name.split(".").pop();
      const path = `uploads/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    }
    await fetchFiles();
    setUploading(false);
  };

  const handleDelete = async (file: MediaFile) => {
    if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
    setDeleting((s) => new Set(s).add(file.id));
    await supabase.storage.from(BUCKET).remove([file.path]);
    if (selected?.id === file.id) setSelected(null);
    await fetchFiles();
    setDeleting((s) => { const n = new Set(s); n.delete(file.id); return n; });
  };

  const handleDeleteSelected = async () => {
    const sel = filtered.filter((f) => selectedIds.has(f.id));
    if (!confirm(`Delete ${sel.length} file(s)? This cannot be undone.`)) return;
    const paths = sel.map((f) => f.path);
    sel.forEach((f) => setDeleting((s) => new Set(s).add(f.id)));
    await supabase.storage.from(BUCKET).remove(paths);
    setSelectedIds(new Set());
    setSelected(null);
    await fetchFiles();
  };

  const startRename = (file: MediaFile) => {
    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    setRenaming(file.id);
    setRenameValue(nameWithoutExt);
    setTimeout(() => renameRef.current?.select(), 50);
  };

  const handleRename = async (file: MediaFile) => {
    const ext = file.name.split(".").pop();
    const newName = `${renameValue.trim().replace(/[^a-z0-9-_]/gi, "_")}.${ext}`;
    if (!renameValue.trim() || newName === file.name) { setRenaming(null); return; }
    setRenameBusy(true);
    const newPath = `${file.folder}/${newName}`;
    const { error } = await supabase.storage.from(BUCKET).move(file.path, newPath);
    if (!error) {
      if (selected?.id === file.id) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);
        setSelected({ ...file, name: newName, path: newPath, publicUrl: data.publicUrl });
      }
      await fetchFiles();
    }
    setRenaming(null);
    setRenameBusy(false);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  // bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelectedIds((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((f) => f.id)));

  const filtered = files.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchFolder = folderFilter === "all" || f.folder === folderFilter;
    return matchSearch && matchFolder;
  });

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-secondary-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="input-field pl-9 py-2" />
        </div>
        <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} className="input-field py-2 max-w-[180px]">
          <option value="all">All folders</option>
          {FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex rounded-lg border border-secondary-200 overflow-hidden">
          <button onClick={() => setView("grid")} className={`px-3 py-2 text-sm ${view === "grid" ? "bg-secondary-900 text-white" : "text-secondary-500 hover:bg-secondary-50"}`}>Grid</button>
          <button onClick={() => setView("list")} className={`px-3 py-2 text-sm ${view === "list" ? "bg-secondary-900 text-white" : "text-secondary-500 hover:bg-secondary-50"}`}>List</button>
        </div>
        <button onClick={fetchFiles} disabled={loading} className="btn-outline py-2"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-primary py-2">
          {uploading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && handleUpload(e.target.files)} />
      </div>

      {/* bulk actions */}
      {selectedIds.size > 0 && (
        <div className="bg-primary-50 border border-primary-100 rounded-lg px-4 py-2 flex items-center gap-4">
          <span className="text-sm font-medium text-secondary-900">{selectedIds.size} selected</span>
          <button onClick={handleDeleteSelected} className="text-sm text-error-600 hover:text-error-700 font-medium flex items-center gap-1"><Trash2 size={14} />Delete selected</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-secondary-500 underline ml-auto">Clear</button>
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* main content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-secondary-400">
              <FolderOpen size={40} className="mx-auto mb-3 text-secondary-200" />
              <p>No images found.</p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((f) => (
                <div key={f.id} className={`group relative aspect-square rounded-xl overflow-hidden bg-secondary-100 cursor-pointer border-2 transition-all ${selected?.id === f.id ? "border-gold-500" : selectedIds.has(f.id) ? "border-primary-400" : "border-transparent hover:border-secondary-300"}`}>
                  <AppImage fill src={f.publicUrl} alt={f.name} className="w-full h-full object-cover" onClick={() => setSelected(f)} />
                  {/* checkbox */}
                  <div className="absolute top-2 left-2">
                    <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded accent-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); copyUrl(f.publicUrl); }} className="p-1.5 bg-white rounded-lg shadow text-secondary-700 hover:text-primary-600" title="Copy URL">
                      {copied === f.publicUrl ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); startRename(f); }} className="p-1.5 bg-white rounded-lg shadow text-secondary-700 hover:text-primary-600" title="Rename"><Pencil size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(f); }} disabled={deleting.has(f.id)} className="p-1.5 bg-white rounded-lg shadow text-secondary-700 hover:text-error-500" title="Delete">
                      {deleting.has(f.id) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                  {/* rename inline */}
                  {renaming === f.id && (
                    <div className="absolute inset-0 bg-secondary-900/80 flex items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
                      <div className="w-full space-y-2">
                        <input ref={renameRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(f); if (e.key === "Escape") setRenaming(null); }} className="input-field text-xs py-1.5 w-full" />
                        <div className="flex gap-2">
                          <button onClick={() => handleRename(f)} disabled={renameBusy} className="btn-primary py-1 text-xs flex-1">{renameBusy ? <Loader2 size={12} className="animate-spin" /> : "Save"}</button>
                          <button onClick={() => setRenaming(null)} className="btn-outline py-1 text-xs"><X size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary-900/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs truncate">{f.name}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* list view */
            <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
              <table className="w-full min-w-[600px]">
                <thead className="bg-secondary-50 border-b border-secondary-100">
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleAll} className="w-4 h-4 rounded" /></th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700">File</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden md:table-cell">Folder</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Size</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-secondary-700 hidden lg:table-cell">Date</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-secondary-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-50">
                  {filtered.map((f) => (
                    <tr key={f.id} className={`hover:bg-secondary-50 transition-colors ${selectedIds.has(f.id) ? "bg-primary-50/50" : ""}`}>
                      <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} className="w-4 h-4 rounded" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelected(f)}>
                          <AppImage src={f.publicUrl} alt={f.name} width={40} height={40} className="w-10 h-10 rounded-lg object-cover bg-secondary-100 flex-shrink-0" />
                          {renaming === f.id ? (
                            <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                              <input ref={renameRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(f); if (e.key === "Escape") setRenaming(null); }} className="input-field text-sm py-1 flex-1" />
                              <button onClick={() => handleRename(f)} disabled={renameBusy} className="btn-primary py-1 px-2 text-xs">{renameBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}</button>
                              <button onClick={() => setRenaming(null)} className="p-1 text-secondary-400 hover:text-secondary-700"><X size={14} /></button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-secondary-900 truncate max-w-[200px]">{f.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary-500 hidden md:table-cell">{f.folder}</td>
                      <td className="px-4 py-3 text-sm text-secondary-500 hidden lg:table-cell">{formatBytes(f.metadata?.size || 0)}</td>
                      <td className="px-4 py-3 text-sm text-secondary-500 hidden lg:table-cell">{formatDate(f.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => copyUrl(f.publicUrl)} className="p-2 text-secondary-400 hover:text-primary-600 hover:bg-secondary-100 rounded-lg transition-colors" title="Copy URL">
                            {copied === f.publicUrl ? <Check size={15} /> : <Copy size={15} />}
                          </button>
                          <button onClick={() => startRename(f)} className="p-2 text-secondary-400 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors" title="Rename"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(f)} disabled={deleting.has(f.id)} className="p-2 text-secondary-400 hover:text-error-500 hover:bg-error-50 rounded-lg transition-colors" title="Delete">
                            {deleting.has(f.id) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* detail panel */}
        {selected && (
          <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-secondary-100 shadow-sm p-4 space-y-4 self-start sticky top-24">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-secondary-900">File Details</p>
              <button onClick={() => setSelected(null)} className="text-secondary-400 hover:text-secondary-700"><X size={16} /></button>
            </div>
            <AppImage src={selected.publicUrl} alt={selected.name} width={400} height={400} className="w-full aspect-square object-contain rounded-lg bg-secondary-50" />
            <div className="space-y-1.5 text-sm">
              <div><span className="text-secondary-500 text-xs">Name</span><p className="font-medium text-secondary-900 break-all">{selected.name}</p></div>
              <div><span className="text-secondary-500 text-xs">Folder</span><p className="text-secondary-700">{selected.folder}</p></div>
              {selected.metadata?.size && <div><span className="text-secondary-500 text-xs">Size</span><p className="text-secondary-700">{formatBytes(selected.metadata.size)}</p></div>}
              {selected.metadata?.mimetype && <div><span className="text-secondary-500 text-xs">Type</span><p className="text-secondary-700">{selected.metadata.mimetype}</p></div>}
              {selected.created_at && <div><span className="text-secondary-500 text-xs">Uploaded</span><p className="text-secondary-700">{formatDate(selected.created_at)}</p></div>}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-secondary-700">Public URL</p>
              <div className="flex gap-2">
                <input readOnly value={selected.publicUrl} className="input-field text-xs flex-1 py-1.5" onClick={(e) => (e.target as HTMLInputElement).select()} />
                <button onClick={() => copyUrl(selected.publicUrl)} className="btn-outline py-1.5 px-2 flex-shrink-0">
                  {copied === selected.publicUrl ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => startRename(selected)} className="btn-outline py-2 flex-1 text-sm"><Pencil size={14} className="mr-1" />Rename</button>
              <button onClick={() => handleDelete(selected)} disabled={deleting.has(selected.id)} className="btn-outline py-2 flex-1 text-sm text-error-500 hover:bg-error-50 border-error-200">
                {deleting.has(selected.id) ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Trash2 size={14} className="mr-1" />}Delete
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-secondary-400">{filtered.length} of {files.length} file{files.length !== 1 ? "s" : ""} · Bucket: {BUCKET}</p>
    </div>
  );
}

export default function AdminMediaPage() {
  return <ProtectedAdmin><Media /></ProtectedAdmin>;
}
