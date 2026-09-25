"use client";
import { useRef, useState } from "react";
import ImageUpload from "@/components/ImageUpload";
import { useSettings } from "./useSettings";
import { SaveBar } from "./SaveBar";
import { Music, Video, Upload, Loader2, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";

interface Track { id: string; name: string; url: string; enabled: boolean; cover_url?: string; }
interface VideoTrack { id: string; name: string; url: string; enabled: boolean; thumb_url?: string; }

export default function Branding() {
  const { form, set, save, saved, error } = useSettings();
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = async (file: File) => {
    setVideoError("");
    setVideoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "settings/video");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setVideoError(json.error || "Upload failed"); }
    else {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const newTrack: VideoTrack = { id: crypto.randomUUID(), name, url: json.url, enabled: true };
      const newTracks = [...videoTracks, newTrack];
      setVideoTracks(newTracks);
      await saveAll({ video_tracks: newTracks });
    }
    setVideoUploading(false);
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const updateVideoTrack = (id: string, patch: Partial<VideoTrack>) =>
    setVideoTracks(videoTracks.map(t => t.id === id ? { ...t, ...patch } : t));
  const removeVideoTrack = (id: string) => setVideoTracks(videoTracks.filter(t => t.id !== id));
  const [audioError, setAudioError] = useState("");
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  const tracks: Track[] = Array.isArray(form.music_tracks) ? form.music_tracks : [];
  const setTracks = (t: Track[]) => set("music_tracks", t);
  const videoTracks: VideoTrack[] = Array.isArray(form.video_tracks) ? form.video_tracks : [];
  const setVideoTracks = (t: VideoTrack[]) => set("video_tracks", t);

  const saveAll = (overrides?: { music_tracks?: Track[]; video_tracks?: VideoTrack[] }) => save({
    store_name: form.store_name, tagline: form.tagline,
    logo_url: form.logo_url, logo_size: form.logo_size,
    music_enabled: !!form.music_enabled, music_shuffle: !!form.music_shuffle,
    music_tracks: overrides?.music_tracks ?? tracks,
    video_enabled: !!form.video_enabled,
    video_tracks: overrides?.video_tracks ?? videoTracks,
  });

  const handleAudioUpload = async (file: File) => {
    setAudioError("");
    setAudioUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "settings/music");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) { setAudioError(json.error || "Upload failed"); }
    else {
      const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const newTrack: Track = { id: crypto.randomUUID(), name, url: json.url, enabled: true };
      const newTracks = [...tracks, newTrack];
      setTracks(newTracks);
      await saveAll({ music_tracks: newTracks });
    }
    setAudioUploading(false);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const updateTrack = (id: string, patch: Partial<Track>) =>
    setTracks(tracks.map(t => t.id === id ? { ...t, ...patch } : t));

  const removeTrack = (id: string) => setTracks(tracks.filter(t => t.id !== id));

  return (
    <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
      <div>
        <label className="label-text">Store Name</label>
        <input value={form.store_name || ""} onChange={(e) => set("store_name", e.target.value)} className="input-field" />
      </div>
      <div>
        <label className="label-text">Tagline</label>
        <input value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} className="input-field" />
      </div>
      <ImageUpload label="Logo" value={form.logo_url || ""} onChange={(url) => set("logo_url", url)} folder="settings/logo" preview={false} />
      <label className="label-text">
        Logo Size: {form.logo_size || 40}px
        <input type="range" min={20} max={160} value={form.logo_size || 40} onChange={(e) => set("logo_size", Number(e.target.value))} className="w-full accent-gold-500" />
      </label>

      {/* Music */}
      <div className="border-t border-secondary-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music size={16} className="text-primary-500" />
            <span className="label-text mb-0">Background Music</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary-600">
              <div onClick={() => set("music_shuffle", !form.music_shuffle)}
                className={`relative w-8 h-5 rounded-full transition-colors ${form.music_shuffle ? "bg-primary-600" : "bg-secondary-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.music_shuffle ? "translate-x-3" : ""}`} />
              </div>
              Shuffle
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary-600">
              <div onClick={() => set("music_enabled", !form.music_enabled)}
                className={`relative w-8 h-5 rounded-full transition-colors ${form.music_enabled ? "bg-primary-600" : "bg-secondary-200"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.music_enabled ? "translate-x-3" : ""}`} />
              </div>
              {form.music_enabled ? "On" : "Off"}
            </label>
          </div>
        </div>

        {/* Track list */}
        {tracks.length > 0 && (
          <div className="space-y-2">
            {tracks.map((track) => (
              <div key={track.id} className="rounded-lg border border-secondary-100 bg-secondary-50 overflow-hidden">
                <div className="flex items-center gap-2 p-2">
                  <GripVertical size={14} className="text-secondary-300 flex-shrink-0" />
                  {track.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.cover_url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  )}
                  <input
                    value={track.name}
                    onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                    className="flex-1 text-sm bg-transparent border-none outline-none text-secondary-800 min-w-0"
                    placeholder="Track name"
                  />
                  <button onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
                    className="text-secondary-400 hover:text-secondary-600 flex-shrink-0">
                    {expandedTrack === track.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <div onClick={() => updateTrack(track.id, { enabled: !track.enabled })}
                    className={`relative w-8 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${track.enabled ? "bg-primary-600" : "bg-secondary-200"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${track.enabled ? "translate-x-3" : ""}`} />
                  </div>
                  <button onClick={() => removeTrack(track.id)} className="text-secondary-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {expandedTrack === track.id && (
                  <div className="px-3 pb-3 border-t border-secondary-100 pt-2">
                    <ImageUpload
                      label="Cover Image"
                      value={track.cover_url || ""}
                      onChange={(url) => updateTrack(track.id, { cover_url: url })}
                      folder="settings/music-covers"
                      preview={false}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload */}
        <div>
          <button type="button" onClick={() => audioInputRef.current?.click()} disabled={audioUploading}
            className="btn-outline py-2 px-3 flex items-center gap-2 text-sm">
            {audioUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {audioUploading ? "Uploading…" : "Upload Track"}
          </button>
          <input ref={audioInputRef} type="file"
            accept="audio/mp3,audio/mpeg,audio/ogg,audio/wav,audio/aac,audio/m4a,.mp3,.ogg,.wav,.aac,.m4a"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])} />
          {audioError && <p className="text-xs text-error-600 mt-1">{audioError}</p>}
          <p className="text-xs text-secondary-400 mt-1">mp3, ogg, wav, aac — max 20MB</p>
        </div>
      </div>

      {/* Video */}
      <div className="border-t border-secondary-100 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video size={16} className="text-primary-500" />
            <span className="label-text mb-0">Video Player</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary-600">
            <div onClick={() => set("video_enabled", !form.video_enabled)}
              className={`relative w-8 h-5 rounded-full transition-colors ${form.video_enabled ? "bg-primary-600" : "bg-secondary-200"}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.video_enabled ? "translate-x-3" : ""}`} />
            </div>
            {form.video_enabled ? "On" : "Off"}
          </label>
        </div>
        {videoTracks.length > 0 && (
          <div className="space-y-2">
            {videoTracks.map((track) => (
              <div key={track.id} className="flex items-center gap-2 p-2 rounded-lg border border-secondary-100 bg-secondary-50">
                <GripVertical size={14} className="text-secondary-300 flex-shrink-0" />
                <input value={track.name} onChange={(e) => updateVideoTrack(track.id, { name: e.target.value })}
                  className="flex-1 text-sm bg-transparent border-none outline-none text-secondary-800 min-w-0" placeholder="Video name" />
                <div onClick={() => updateVideoTrack(track.id, { enabled: !track.enabled })}
                  className={`relative w-8 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${track.enabled ? "bg-primary-600" : "bg-secondary-200"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${track.enabled ? "translate-x-3" : ""}`} />
                </div>
                <button onClick={() => removeVideoTrack(track.id)} className="text-secondary-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {/* YouTube URL */}
          <div className="flex gap-2">
            <input
              id="yt-url"
              placeholder="Paste YouTube URL"
              className="input-field flex-1 text-sm"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const val = (e.target as HTMLInputElement).value.trim();
                if (!val) return;
                const newTrack: VideoTrack = { id: crypto.randomUUID(), name: "YouTube Video", url: val, enabled: true };
                const newTracks = [...videoTracks, newTrack];
                setVideoTracks(newTracks);
                saveAll({ video_tracks: newTracks });
                (e.target as HTMLInputElement).value = "";
              }}
            />
            <button type="button" className="btn-outline py-2 px-3 text-sm flex-shrink-0"
              onClick={() => {
                const input = document.getElementById("yt-url") as HTMLInputElement;
                const val = input?.value.trim();
                if (!val) return;
                const newTrack: VideoTrack = { id: crypto.randomUUID(), name: "YouTube Video", url: val, enabled: true };
                const newTracks = [...videoTracks, newTrack];
                setVideoTracks(newTracks);
                saveAll({ video_tracks: newTracks });
                input.value = "";
              }}>Add</button>
          </div>
          {/* File upload */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => videoInputRef.current?.click()} disabled={videoUploading}
              className="btn-outline py-2 px-3 flex items-center gap-2 text-sm">
              {videoUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {videoUploading ? "Uploading…" : "Upload Video"}
            </button>
            <span className="text-xs text-secondary-400">mp4, webm, mov — max 200MB</span>
          </div>
          <input ref={videoInputRef} type="file"
            accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
          {videoError && <p className="text-xs text-error-600">{videoError}</p>}
        </div>
      </div>

      <SaveBar onSave={() => saveAll()} saved={saved} error={error} />
    </div>
  );
}
