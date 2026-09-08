"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { StoreSettings } from "@/types";

const STORAGE_KEY = "promo_banner_count";
const MAX_SHOWS = 2;

export default function PromoBanner({ settings }: { settings: StoreSettings | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!settings?.promo_banner_active) return;
    const count = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? "0", 10);
    if (count < MAX_SHOWS) {
      sessionStorage.setItem(STORAGE_KEY, String(count + 1));
      // slight delay so the drop-down animation plays after mount
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, [settings?.promo_banner_active]);

  if (!visible) return null;

  const bg = settings?.promo_banner_bg_color || "#1a1a1a";

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] animate-slide-down shadow-xl"
      style={{ backgroundColor: bg }}
    >
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-start gap-4">
        <div className="flex-1 text-center">
          {settings?.promo_banner_title && (
            <p className="font-bold text-white text-base leading-tight">
              {settings.promo_banner_title}
            </p>
          )}
          {settings?.promo_banner_body && (
            <p className="text-white/80 text-sm mt-1">{settings.promo_banner_body}</p>
          )}
          {settings?.promo_banner_cta_label && settings?.promo_banner_cta_url && (
            <Link
              href={settings.promo_banner_cta_url}
              onClick={() => setVisible(false)}
              className="inline-block mt-3 px-5 py-1.5 rounded-full bg-white text-secondary-900 text-sm font-semibold hover:bg-gold-100 transition-colors"
            >
              {settings.promo_banner_cta_label}
            </Link>
          )}
        </div>
        <button
          onClick={() => setVisible(false)}
          className="flex-shrink-0 text-white/60 hover:text-white transition-colors mt-0.5"
          aria-label="Close banner"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
