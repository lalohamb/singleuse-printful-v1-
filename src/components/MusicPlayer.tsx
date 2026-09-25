"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Music, X, Play, Pause, Volume2, VolumeX, GripHorizontal } from "lucide-react";
import { getAudio } from "@/lib/audioSingleton";

interface Track { id: string; name: string; url: string; enabled: boolean; cover_url?: string; }

export default function MusicPlayer() {
  const pathname = usePathname();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const tracksRef = useRef<Track[]>([]);
  const idxRef = useRef(0);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { idxRef.current = idx; }, [idx]);

  useEffect(() => {
    fetch("/api/music-config")
      .then(r => r.json())
      .then(d => {
        if (!d.enabled) return;
        const enabled: Track[] = (d.tracks || []).filter((t: Track) => t.enabled);
        if (d.shuffle) enabled.sort(() => Math.random() - 0.5);
        setTracks(enabled);
        tracksRef.current = enabled;
      })
      .catch(() => {});

    const audio = getAudio();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      const t = tracksRef.current;
      if (!t.length) return;
      const next = (idxRef.current + 1) % t.length;
      idxRef.current = next;
      setIdx(next);
      audio.src = t[next].url;
      audio.load();
      audio.play().catch(() => {});
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    setPlaying(!audio.paused);
    const poll = setInterval(() => setPlaying(!audio.paused), 500);
    return () => {
      clearInterval(poll);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    getAudio().muted = pathname.startsWith("/checkout") || muted;
  }, [pathname, muted]);

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
    const audio = getAudio();
    if (!tracks[i]) return;
    audio.src = tracks[i].url;
    audio.load();
    if (autoplay) audio.play().catch(() => {});
    setIdx(i); idxRef.current = i;
  };

  const toggle = () => {
    const audio = getAudio();
    if (!audio.src && tracks[idx]) { loadTrack(idx, true); return; }
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  };

  const current = tracks[idx];
  if (!tracks.length) return null;

  return (
    <>
      {/* Fixed panel */}
      {open && current && (
        <div style={{ position: "fixed", left: panelPos.x, top: panelPos.y, zIndex: 9999, userSelect: "none" }}
          className="w-72 bg-secondary-900 rounded-2xl overflow-hidden shadow-2xl">
          <div onMouseDown={onMouseDown}
            className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing bg-secondary-800">
            <GripHorizontal size={16} className="text-secondary-500" />
          </div>
          {current.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.cover_url} alt={current.name} className="w-full aspect-square object-contain bg-black" />
          ) : (
            <div className="w-full aspect-square bg-secondary-800 flex items-center justify-center text-5xl">🎵</div>
          )}
          <div className="p-3 flex items-center justify-center gap-4">
            <button onClick={() => setMuted(m => !m)} className="text-secondary-400 hover:text-white">
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button onClick={toggle}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-secondary-900 hover:bg-secondary-100">
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* Inline nav button */}
      <button ref={btnRef} onClick={() => { openPanel(); if (!open && !playing) toggle(); }}
        className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
          open || playing ? "bg-secondary-900 text-white" : "text-current hover:opacity-70"
        }`}>
        {!open && (
          <>
            <span className="absolute -top-4 left-0 text-xs animate-float-note-1 pointer-events-none select-none">♪</span>
            <span className="absolute -top-5 left-3 text-xs animate-float-note-2 pointer-events-none select-none">♫</span>
            <span className="absolute -top-3 left-5 text-xs animate-float-note-3 pointer-events-none select-none">♩</span>
          </>
        )}
        {open ? <X size={15} /> : <Music size={15} />}
      </button>
    </>
  );
}
