"use client";
import { useEffect, useRef, useState } from "react";
import { Video, X, SkipBack, SkipForward, Play, Pause, Volume2, VolumeX, GripHorizontal, Minimize2, Maximize2 } from "lucide-react";
import { getAudio } from "@/lib/audioSingleton";

interface VideoTrack { id: string; name: string; url: string; enabled: boolean; }

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tracks, setTracks] = useState<VideoTrack[]>([]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const tracksRef = useRef<VideoTrack[]>([]);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  useEffect(() => {
    fetch("/api/video-config")
      .then(r => r.json())
      .then(d => {
        if (!d.enabled) return;
        const enabled = (d.tracks || []).filter((t: VideoTrack) => t.enabled);
        setTracks(enabled);
        tracksRef.current = enabled;
      })
      .catch(() => {});
  }, []);

  // Panel drag
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPanelPos({
        x: Math.max(0, Math.min(window.innerWidth - 288, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 300, e.clientY - dragOffset.current.y)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const openPanel = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ x: r.left - 100, y: r.bottom + 8 });
    }
    setOpen(o => !o);
  };

  const loadTrack = (i: number, autoplay = false) => {
    const t = tracksRef.current;
    if (!t[i]) return;
    setIdx(i);
    setProgress(0); setDuration(0);
    const ytId = getYouTubeId(t[i].url);
    if (!ytId && videoRef.current) {
      videoRef.current.src = t[i].url;
      videoRef.current.load();
      if (autoplay) videoRef.current.play().catch(() => {});
    }
    if (autoplay && !ytId) {
      const audio = getAudio();
      if (!audio.paused) audio.pause();
    }
  };

  const toggle = () => {
    const v = videoRef.current;
    const current = tracks[idx];
    if (!current) return;
    if (getYouTubeId(current.url)) return;
    if (!v) return;
    if (!v.src) { loadTrack(idx, true); return; }
    if (playing) { v.pause(); }
    else {
      const audio = getAudio();
      if (!audio.paused) audio.pause();
      v.play().catch(() => {});
    }
  };

  const next = () => loadTrack((idx + 1) % tracks.length, true);
  const prev = () => loadTrack((idx - 1 + tracks.length) % tracks.length, true);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Number(e.target.value);
    setProgress(Number(e.target.value));
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const current = tracks[idx];
  if (!tracks.length) return null;

  const ytId = current ? getYouTubeId(current.url) : null;
  const panelW = expanded ? 480 : 288;

  return (
    <>
      {/* Fixed panel */}
      {open && current && (
        <div style={{ position: "fixed", left: panelPos.x, top: panelPos.y, zIndex: 9998, userSelect: "none", width: panelW }}
          className="bg-secondary-900 rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 bg-secondary-800">
            <div onMouseDown={onMouseDown} className="cursor-grab active:cursor-grabbing p-1">
              <GripHorizontal size={16} className="text-secondary-500" />
            </div>
            <p className="text-white text-xs font-medium truncate flex-1 mx-2">{current.name}</p>
            <button onClick={() => setExpanded(e => !e)} className="text-secondary-400 hover:text-white mr-2">
              {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {!ytId && (
              <button onClick={() => setMuted(m => !m)} className="text-secondary-400 hover:text-white">
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            )}
          </div>
          {ytId ? (
            <iframe key={ytId} src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media" allowFullScreen
              className="w-full bg-black" style={{ aspectRatio: "16/9", border: "none" }}
              onLoad={() => { const a = getAudio(); if (!a.paused) a.pause(); }} />
          ) : (
            <video ref={videoRef} muted={muted} playsInline
              onTimeUpdate={e => setProgress(e.currentTarget.currentTime)}
              onDurationChange={e => setDuration(e.currentTarget.duration)}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={next}
              className="w-full bg-black" style={{ aspectRatio: "16/9" }} />
          )}
          {!ytId && (
            <div className="p-3 space-y-2">
              <input type="range" min={0} max={duration || 1} value={progress} onChange={seek}
                className="w-full h-1 accent-white cursor-pointer" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary-500">{fmt(progress)} / {fmt(duration)}</span>
                <div className="flex items-center gap-3">
                  {tracks.length > 1 && <button onClick={prev} className="text-secondary-400 hover:text-white"><SkipBack size={16} /></button>}
                  <button onClick={toggle}
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-secondary-900 hover:bg-secondary-100">
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  {tracks.length > 1 && <button onClick={next} className="text-secondary-400 hover:text-white"><SkipForward size={16} /></button>}
                </div>
              </div>
            </div>
          )}
          {ytId && tracks.length > 1 && (
            <div className="flex items-center justify-center gap-4 p-3">
              <button onClick={prev} className="text-secondary-400 hover:text-white"><SkipBack size={16} /></button>
              <button onClick={next} className="text-secondary-400 hover:text-white"><SkipForward size={16} /></button>
            </div>
          )}
        </div>
      )}

      {/* Inline nav button */}
      <button ref={btnRef} onClick={() => { openPanel(); if (!open) loadTrack(idx, false); }}
        className={`relative flex items-center justify-center w-8 h-18 rounded-full transition-colors ${
          open || playing ? "bg-secondary-900 text-white" : "text-current hover:opacity-70"
        }`}>
        {!open && (
          <span className="signal-bars">
            <span /><span /><span /><span /><span />
          </span>
        )}
        {open ? <X size={15} /> : <Video size={15} />}
      </button>
    </>
  );
}
