"use client";
import { useEffect, useState } from "react";
import { X, ArrowRight, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveStorageUrl } from "@/lib/storage";
import AppImage from "@/components/AppImage";

interface PopupSettings {
  active: boolean;
  delay: number;
  title: string;
  body: string;
  ctaLabel: string;
  bgColor: string;
  imageUrl: string;
  groupId: string;
  position: string;
  imgX: number;
  imgY: number;
  popupImageScale: number;
  popupImageFlip: boolean;
  popupImageFit: string;
}

const STORAGE_KEY_PREFIX = "newsletter_popup_dismissed";

function getDismissKey(settings: PopupSettings): string {
  const signature = JSON.stringify({
    title: settings.title,
    body: settings.body,
    ctaLabel: settings.ctaLabel,
    imageUrl: settings.imageUrl,
    position: settings.position,
    delay: settings.delay,
  });
  let hash = 0;
  for (let i = 0; i < signature.length; i += 1) {
    hash = ((hash << 5) - hash + signature.charCodeAt(i)) | 0;
  }
  return `${STORAGE_KEY_PREFIX}_${Math.abs(hash).toString(36)}`;
}

function sanitizeImageUrl(url: string): string {
  if (url.startsWith("/")) return url;
  try {
    const { protocol } = new URL(url);
    if (protocol === "https:" || protocol === "http:") return url;
  } catch { /* invalid URL */ }
  return "/hero-placeholder.svg";
}

function getLayout(position: string) {
  switch (position) {
    case "left":
      return {
        wrapper: "fixed inset-y-0 left-0 z-50 flex",
        panel: "relative h-full w-80 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300",
        roundedClass: "rounded-r-2xl",
        imageClass: "w-full h-52 object-cover flex-shrink-0",
        contentClass: "flex-1 overflow-y-auto p-6 text-center space-y-4",
        backdropClass: "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
      };
    case "right":
      return {
        wrapper: "fixed inset-y-0 right-0 z-50 flex",
        panel: "relative h-full w-80 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300",
        roundedClass: "rounded-l-2xl",
        imageClass: "w-full h-52 object-cover flex-shrink-0",
        contentClass: "flex-1 overflow-y-auto p-6 text-center space-y-4",
        backdropClass: "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
      };
    case "bottom-left":
    case "bottom-center":
    case "bottom-right":
      return {
        wrapper: `fixed bottom-0 z-50 p-4 ${position === "bottom-left" ? "left-0" : position === "bottom-right" ? "right-0" : "left-1/2 -translate-x-1/2"}`,
        panel: "relative w-80 rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-300",
        roundedClass: "",
        imageClass: "w-full h-36 object-cover rounded-t-2xl",
        contentClass: "p-5 text-center space-y-3",
        backdropClass: "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
      };
    case "top-left":
    case "top-center":
    case "top-right":
      return {
        wrapper: `fixed top-0 z-50 p-4 ${position === "top-left" ? "left-0" : position === "top-right" ? "right-0" : "left-1/2 -translate-x-1/2"}`,
        panel: "relative w-80 rounded-2xl shadow-2xl animate-in slide-in-from-top duration-300",
        roundedClass: "",
        imageClass: "w-full h-36 object-cover rounded-t-2xl",
        contentClass: "p-5 text-center space-y-3",
        backdropClass: "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm",
      };
    default: // center
      return {
        wrapper: "fixed inset-0 z-50 flex items-center justify-center p-4",
        panel: "relative w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300",
        roundedClass: "",
        imageClass: "w-full h-48 object-cover",
        contentClass: "p-8 text-center space-y-4",
        backdropClass: "absolute inset-0 bg-black/60 backdrop-blur-sm",
      };
  }
}

export default function NewsletterPopup() {
  const [settings, setSettings] = useState<PopupSettings | null>(null);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dismissDays, setDismissDays] = useState(7);
  const [dismissKey, setDismissKey] = useState(STORAGE_KEY_PREFIX);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    supabase.from("settings").select("popup_settings").limit(1).maybeSingle().then(({ data }) => {
      if (cancelled) return;
      if (!data?.popup_settings?.active) return;
      setDismissDays(data.popup_settings.dismissDays ?? 7);
      const s: PopupSettings = {
        active: true,
        delay: data.popup_settings.delay ?? 3,
        title: data.popup_settings.title || "Join the Culture",
        body: data.popup_settings.body || "New drops, exclusive offers, and culture — straight to your inbox.",
        ctaLabel: data.popup_settings.ctaLabel || "Subscribe",
        bgColor: data.popup_settings.bgColor || "#111111",
        imageUrl: sanitizeImageUrl(resolveStorageUrl(data.popup_settings.imageUrl) || "/hero-placeholder.svg"),
        groupId: data.popup_settings.groupId || "",
        position: data.popup_settings.position || "right",
        imgX: data.popup_settings.imgX ?? 0,
        imgY: data.popup_settings.imgY ?? 0,
        popupImageScale: data.popup_settings.popupImageScale ?? 100,
        popupImageFlip: data.popup_settings.popupImageFlip ?? false,
        popupImageFit: data.popup_settings.popupImageFit || "cover",
      };
      const currentDismissKey = getDismissKey(s);
      const dismissed = localStorage.getItem(currentDismissKey);
      if (dismissed && Date.now() < parseInt(dismissed, 10)) return;
      setDismissKey(currentDismissKey);
      setSettings(s);
      timer = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, s.delay * 1000);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(dismissKey, String(Date.now() + dismissDays * 86400000));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/mailerlite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_subscriber", email, groups: settings?.groupId ? [settings.groupId] : [] }),
      });
      const data = await res.json();
      if (!res.ok || data.error || data.message) {
        setErrorMsg(data.message || data.error || "Something went wrong.");
        setState("error");
      } else {
        setState("done");
        setTimeout(dismiss, 2500);
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  };

  if (!visible || !settings) return null;

  const layout = getLayout(settings.position);

  return (
    <>
      <div className={layout.backdropClass} onClick={dismiss} />
      <div className={layout.wrapper}>
        <div className={`${layout.panel} ${layout.roundedClass} overflow-hidden`} style={{ backgroundColor: settings.bgColor }}>
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {settings.imageUrl && (
            <div className="relative flex-shrink-0 overflow-hidden" style={{ height: settings.position === "left" || settings.position === "right" ? "13rem" : "9rem" }}>
              <AppImage fill src={settings.imageUrl} alt="" className={`w-full h-full ${
                  settings.popupImageFit === "contain" ? "object-contain" :
                  settings.popupImageScale === 100 ? "object-cover" : "object-contain"
                }`} style={{
                  objectPosition: (settings.imgX === 0 && settings.imgY === 0) ? "center" : `${settings.imgX}px ${settings.imgY}px`,
                  transform: settings.popupImageFlip ? "scaleX(-1)" : undefined,
                  scale: `${settings.popupImageScale}%`,
                }} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
            </div>
          )}

          <div className={layout.contentClass}>
            <p className="text-gold-400 text-xs font-semibold tracking-widest uppercase">Join the Culture</p>
            <h2 className="text-xl font-bold text-white">{settings.title}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{settings.body}</p>

            {state === "done" ? (
              <div className="flex items-center justify-center gap-2 text-green-400 font-semibold py-2">
                <Check size={20} /> You&apos;re in!
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setState("idle"); }}
                  placeholder="Enter your email"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gold-400"
                />
                <button disabled={state === "loading"} className="btn-gold flex items-center justify-center gap-2 disabled:opacity-60">
                  {state === "loading"
                    ? <><Loader2 size={16} className="animate-spin" />Joining...</>
                    : <>{settings.ctaLabel} <ArrowRight size={16} /></>}
                </button>
                {state === "error" && <p className="text-red-400 text-xs">{errorMsg}</p>}
              </form>
            )}

            <button onClick={dismiss} className="text-white/40 text-xs hover:text-white/60 transition-colors">
              No thanks
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
