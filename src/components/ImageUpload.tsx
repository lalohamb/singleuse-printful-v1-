"use client";
import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, X, Image as ImageIcon, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const BUCKET = "store-images";
const FOLDERS = ["uploads", "settings/hero", "settings/our-why", "settings/story", "settings/logo", "settings/about", "settings/popup"];


interface MediaFile {
  name: string;
  publicUrl: string;
  folder: string;
}

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  preview?: boolean;
}

export default function ImageUpload({ value, onChange, folder = "uploads", label, preview = true }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    setLoadingMedia(true);
    const all: MediaFile[] = [];
    for (const f of FOLDERS) {
      const { data } = await supabase.storage.from(BUCKET).list(f, { sortBy: { column: "created_at", order: "desc" } });
      for (const file of data || []) {
        if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${f}/${file.name}`);
        all.push({ name: file.name, publicUrl: urlData.publicUrl, folder: f });
      }
    }
    setMedia(all);
    setLoadingMedia(false);
  };

  const openPicker = () => {
    setPickerOpen(true);
    if (media.length === 0) fetchMedia();
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB."); return; }
    setUploading(true); setError(null);
    // Reset input so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Upload failed"); setUploading(false); return; }
    onChange(json.url);
    setUploading(false);
    if (media.length > 0) fetchMedia();
  };

  return (
    <div className="space-y-2">
      {label && <label className="label-text">{label}</label>}

      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste URL or pick from media library"
          className="input-field flex-1"
        />
        <button type="button" onClick={openPicker} className="btn-outline py-2 px-3 flex-shrink-0 flex items-center gap-2" title="Pick from media library">
          <ImageIcon size={16} />Library
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-outline py-2 px-3 flex-shrink-0 flex items-center gap-2" title="Upload new image">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "..." : "Upload"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange("")} className="p-2 text-secondary-400 hover:text-error-500 transition-colors"><X size={16} /></button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      {error && <p className="text-xs text-error-600">{error}</p>}

      {preview && value && (
        <img src={value} alt="Preview" className="w-full max-h-48 object-contain rounded-lg bg-secondary-100 mt-1" />
      )}

      {/* Media picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-secondary-900/60" onClick={() => setPickerOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-secondary-100">
              <h3 className="text-lg font-semibold text-secondary-900">Media Library</h3>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { inputRef.current?.click(); }} disabled={uploading} className="btn-primary py-1.5 text-sm flex items-center gap-2">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}Upload New
                </button>
                <button onClick={() => setPickerOpen(false)} className="text-secondary-400 hover:text-secondary-700"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingMedia ? (
                <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>
              ) : media.length === 0 ? (
                <div className="text-center py-12 text-secondary-400">
                  <ImageIcon size={36} className="mx-auto mb-3 text-secondary-200" />
                  <p>No images uploaded yet.</p>
                  <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary mt-4 py-2 text-sm">Upload your first image</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {media.map((f) => (
                    <button
                      key={f.publicUrl}
                      type="button"
                      onClick={() => { onChange(f.publicUrl); setPickerOpen(false); }}
                      className={`group relative aspect-square rounded-xl overflow-hidden bg-secondary-100 border-2 transition-all hover:border-gold-500 ${value === f.publicUrl ? "border-gold-500" : "border-transparent"}`}
                    >
                      <img src={f.publicUrl} alt={f.name} className="w-full h-full object-cover" />
                      {value === f.publicUrl && (
                        <div className="absolute inset-0 bg-gold-500/20 flex items-center justify-center">
                          <div className="bg-gold-500 rounded-full p-1"><Check size={14} className="text-white" /></div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary-900/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{f.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
