"use client";

import { useEffect, useState, useRef } from "react";
import {
  Save,
  Check,
  ExternalLink,
  CreditCard,
  Printer,
  Send,
  Mail,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import ImageUpload from "@/components/ImageUpload";
import ProductImagePicker from "./ProductImagePicker";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_ABOUT_SETTINGS,
  type AboutSettings,
} from "@/lib/about-settings";
import {
  DEFAULT_AFFIRMATIONS_SETTINGS,
  type AffirmationsSettings,
} from "@/lib/affirmations-settings";
import {
  DEFAULT_NEW_ARRIVALS_SETTINGS,
  type NewArrivalsSettings,
} from "@/lib/new-arrivals-settings";
import {
  DEFAULT_BRAND_VALUES_SETTINGS,
  type BrandValuesSettings,
} from "@/lib/brand-values-settings";

const TITLES: Record<string, string> = {
  branding: "Branding",
  homepage: "Homepage",
  "homepage-hero": "Homepage Hero",
  "new-arrivals": "New Arrivals",
  "brand-values": "Brand Values",
  "our-why": "Our Why",
  "wear-your-story": "Wear Your Story",
  "customer-love": "Customer Love",
  announcements: "Announcements",
  "store-information": "Store Information",
  about: "About, Mission & Culture",
  footer: "Footer",
  integrations: "Integrations",
  social: "Social Links",
};

type Testimonial = {
  quote: string;
  name: string;
  location: string;
  product: string;
};

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.",
    name: "Jasmine T.",
    location: "Atlanta, GA",
    product: "Culture First Tee",
  },
  {
    quote:
      "The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.",
    name: "Marcus W.",
    location: "Houston, TX",
    product: "Faith Over Fear Hoodie",
  },
  {
    quote:
      "Finally a brand that celebrates who we are. Every piece feels intentional and powerful.",
    name: "Aaliyah R.",
    location: "Chicago, IL",
    product: "Heritage Collection",
  },
];

type ServiceStatus = "checking" | "connected" | "warning" | "disconnected";
const WEBHOOK_URL =
  "https://SUPABASE_PROJECT_REF_REDACTED.supabase.co/functions/v1/stripe-webhook";

function StatusBadge({ status }: { status: ServiceStatus }) {
  const styles = {
    checking: "bg-secondary-100 text-secondary-500",
    connected: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    disconnected: "bg-error-50 text-error-600",
  };
  const labels = {
    checking: "Checking...",
    connected: "Connected",
    warning: "Account Issue",
    disconnected: "Not Connected",
  };
  return (
    <span className={`text-xs px-3 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

const PROMO_EMOJIS = [
  {
    label: "Business",
    icons: [
      "✨",
      "💎",
      "⭐",
      "🏆",
      "✅",
      "💯",
      "🛍️",
      "🛒",
      "🎁",
      "🏷️",
      "💸",
      "🔥",
      "⚡",
      "📦",
      "🚚",
      "🧵",
      "♻️",
      "🛡️",
      "💬",
      "📩",
    ],
  },
  {
    label: "Hype",
    icons: ["🔥", "⚡", "💥", "🚨", "🎯", "💎", "👑", "🏆", "✨", "💫"],
  },
  {
    label: "Sale",
    icons: ["🛍️", "🎁", "💸", "💰", "🤑", "📦", "🏷️", "🎉", "🎊", "🥳"],
  },
  {
    label: "Style",
    icons: ["👕", "👗", "🧥", "👟", "🧢", "💍", "🕶️", "👜", "🧣", "🧤"],
  },
  {
    label: "Vibes",
    icons: ["😍", "🥰", "😎", "🤩", "💯", "🙌", "👏", "🫶", "❤️", "🖤"],
  },
];

const AFFIRMATION_EMOJIS = [
  {
    label: "Business",
    icons: [
      "✨",
      "💎",
      "⭐",
      "🏆",
      "✅",
      "💯",
      "🛍️",
      "🛒",
      "🎁",
      "🏷️",
      "💸",
      "🔥",
      "⚡",
      "📦",
      "🚚",
      "🧵",
      "♻️",
      "🛡️",
      "💬",
      "📩",
    ],
  },
  { label: "Energy", icons: ["✨", "⚡", "💫", "🔥", "💥", "🌟", "🎯", "💎"] },
  { label: "Style", icons: ["👕", "👗", "🧥", "👟", "🧢", "💍", "🕶️", "👜"] },
  {
    label: "Confidence",
    icons: ["💪", "🙌", "👏", "💯", "👑", "🏆", "😎", "🤩"],
  },
  {
    label: "Good Vibes",
    icons: ["❤️", "🖤", "🫶", "🌈", "🌍", "🌱", "☀️", "🎉"],
  },
  {
    label: "Holiday",
    icons: [
      "🎄",
      "🎅",
      "🤶",
      "🎁",
      "❄️",
      "☃️",
      "🕎",
      "🕯️",
      "🎃",
      "🦃",
      "💝",
      "🎆",
    ],
  },
];

export default function SettingsSectionClient({
  section,
}: {
  section: string;
}) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [heroPreviewH, setHeroPreviewH] = useState(70);
  const [ourWhyPreviewH, setOurWhyPreviewH] = useState(400);
  const [showOurWhyPicker, setShowOurWhyPicker] = useState(false);
  const [stripeOk, setStripeOk] = useState<ServiceStatus>("checking");
  const [mailerOk, setMailerOk] = useState<ServiceStatus>("checking");
  const [resendOk, setResendOk] = useState<ServiceStatus>("checking");
  const [stripeSecret, setStripeSecret] = useState("");
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeResult, setStripeResult] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [affirmations, setAffirmations] = useState<AffirmationsSettings>(
    DEFAULT_AFFIRMATIONS_SETTINGS,
  );
  const [newArrivals, setNewArrivals] = useState<NewArrivalsSettings>(
    DEFAULT_NEW_ARRIVALS_SETTINGS,
  );
  const [brandValues, setBrandValues] = useState<BrandValuesSettings>(
    DEFAULT_BRAND_VALUES_SETTINGS,
  );
  const [promoEmojiOpen, setPromoEmojiOpen] = useState(false);
  const promoTitleRef = useRef<HTMLInputElement>(null);
  const [affirmationEmojiOpen, setAffirmationEmojiOpen] = useState(false);
  const affirmationRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            ...data,
            about_settings: {
              ...DEFAULT_ABOUT_SETTINGS,
              ...(data.about_settings || {}),
            },
          });
          setAffirmations({
            ...DEFAULT_AFFIRMATIONS_SETTINGS,
            ...(data.affirmations_settings || {}),
          });
          setNewArrivals({
            ...DEFAULT_NEW_ARRIVALS_SETTINGS,
            ...(data.new_arrivals_settings || {}),
          });
          setBrandValues({
            ...DEFAULT_BRAND_VALUES_SETTINGS,
            ...(data.brand_values_settings || {}),
          });
          if (data.hero_height_vh) setHeroPreviewH(data.hero_height_vh);
          if (data.our_why_height_vh) setOurWhyPreviewH(data.our_why_height_vh);
        }
      });
    fetch("/api/stripe-admin?action=balance")
      .then((response) =>
        setStripeOk(
          response.status === 200
            ? "connected"
            : response.status === 401
              ? "disconnected"
              : "warning",
        ),
      )
      .catch(() => setStripeOk("warning"));
    fetch("/api/mailerlite?action=groups")
      .then((response) =>
        setMailerOk(
          response.status === 200
            ? "connected"
            : response.status === 401
              ? "disconnected"
              : "warning",
        ),
      )
      .catch(() => setMailerOk("warning"));
    fetch("/api/resend?path=/domains")
      .then((response) =>
        setResendOk(
          response.status === 200
            ? "connected"
            : response.status === 401
              ? "disconnected"
              : "warning",
        ),
      )
      .catch(() => setResendOk("warning"));
  }, []);

  const registerStripeWebhook = async () => {
    if (!stripeSecret) return;
    setStripeSaving(true);
    setStripeResult(null);
    try {
      const response = await fetch("/api/stripe-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_webhook",
          secret_key: stripeSecret,
          webhook_url: WEBHOOK_URL,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStripeResult({
        type: "success",
        msg: `Webhook registered. Set this signing secret in Supabase: ${result.signing_secret}`,
      });
    } catch (error) {
      setStripeResult({
        type: "error",
        msg:
          error instanceof Error ? error.message : "Unable to register webhook",
      });
    }
    setStripeSaving(false);
  };

  const set = (key: string, value: any) =>
    setForm((current) => ({ ...current, [key]: value }));
  const insertPromoEmoji = (emoji: string) => {
    const input = promoTitleRef.current;
    const current = form.promo_banner_title || "";
    if (!input) {
      set("promo_banner_title", current + emoji);
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    set(
      "promo_banner_title",
      current.slice(0, start) + emoji + current.slice(end),
    );
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  const insertAffirmationEmoji = (emoji: string) => {
    const input = affirmationRef.current;
    const current = affirmations.phrases.join("\n");
    if (!input) {
      setAffirmations((settings) => ({
        ...settings,
        phrases: [...settings.phrases, emoji],
      }));
      return;
    }
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    setAffirmations((settings) => ({
      ...settings,
      phrases: next
        .split("\n")
        .map((phrase) => phrase.trim())
        .filter(Boolean),
    }));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  const about = {
    ...DEFAULT_ABOUT_SETTINGS,
    ...(form.about_settings || {}),
  } as AboutSettings;
  const setAbout = (key: keyof AboutSettings, value: string) =>
    set("about_settings", { ...about, [key]: value });

  const save = async () => {
    setError("");
    const updates =
      section === "about"
        ? { about_settings: about }
        : section === "store-information"
          ? {
              store_name: form.store_name,
              tagline: form.tagline,
              logo_url: form.logo_url,
              logo_size: form.logo_size,
              footer_logo_url: form.footer_logo_url,
              footer_logo_size: form.footer_logo_size,
              footer_text: form.footer_text,
              footer_bottom_message: form.footer_bottom_message,
              favicon_url: form.favicon_url,
            }
          : section === "branding"
            ? {
                store_name: form.store_name,
                tagline: form.tagline,
                logo_url: form.logo_url,
                logo_size: form.logo_size,
              }
            : section === "homepage-hero"
              ? {
                  hero_title: form.hero_title,
                  hero_subtitle: form.hero_subtitle,
                  hero_image_url: form.hero_image_url,
                  hero_object_position: form.hero_object_position,
                  hero_height_vh: heroPreviewH,
                  hero_image_flip: form.hero_image_flip,
                  hero_image_scale: form.hero_image_scale,
                  hero_gradient_opacity: form.hero_gradient_opacity,
                  hero_gradient_dir: form.hero_gradient_dir,
                  hero_image_fit: form.hero_image_fit,
                  affirmations_settings: affirmations,
                }
              : section === "new-arrivals"
                ? { new_arrivals_settings: newArrivals }
                : section === "brand-values"
                  ? { brand_values_settings: brandValues }
                  : section === "our-why"
                    ? {
                        our_why_label: form.our_why_label,
                        our_why_quote: form.our_why_quote,
                        our_why_body: form.our_why_body,
                        our_why_image_url: form.our_why_image_url,
                        our_why_object_position: form.our_why_object_position,
                        our_why_height_vh: ourWhyPreviewH,
                        our_why_image_scale: form.our_why_image_scale,
                        our_why_image_flip: form.our_why_image_flip,
                        our_why_image_fit: form.our_why_image_fit,
                        our_why_gradient_opacity: form.our_why_gradient_opacity,
                        our_why_gradient_dir: form.our_why_gradient_dir,
                      }
                    : section === "wear-your-story"
                      ? {
                          story_image_url: form.story_image_url,
                          story_object_position: form.story_object_position,
                          story_image_scale: form.story_image_scale,
                          story_image_flip: form.story_image_flip,
                          story_image_fit: form.story_image_fit,
                          story_gradient_opacity: form.story_gradient_opacity,
                          story_gradient_dir: form.story_gradient_dir,
                        }
                      : section === "customer-love"
                        ? {
                            testimonials:
                              form.testimonials ?? DEFAULT_TESTIMONIALS,
                          }
                        : section === "announcements"
                          ? {
                              announcement: form.announcement,
                              announcement_active: form.announcement_active,
                              promo_banner_active: form.promo_banner_active,
                              promo_banner_title: form.promo_banner_title,
                              promo_banner_body: form.promo_banner_body,
                              promo_banner_cta_label:
                                form.promo_banner_cta_label,
                              promo_banner_cta_url: form.promo_banner_cta_url,
                              promo_banner_bg_color: form.promo_banner_bg_color,
                            }
                          : section === "homepage"
                            ? {
                                hero_title: form.hero_title,
                                hero_subtitle: form.hero_subtitle,
                                hero_image_url: form.hero_image_url,
                                announcement: form.announcement,
                                announcement_active: form.announcement_active,
                              }
                            : section === "footer"
                              ? {
                                  footer_logo_url: form.footer_logo_url,
                                  footer_logo_size: form.footer_logo_size,
                                  footer_text: form.footer_text,
                                  footer_bottom_message:
                                    form.footer_bottom_message,
                                }
                              : section === "integrations"
                                ? { printify_shop_id: form.printify_shop_id }
                                : { social_links: form.social_links };
    const { error: saveError } = await supabase
      .from("settings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", form.id);
    if (saveError) setError(saveError.message);
    else {
      setSaved(true);
      fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: ["/", "/about", "/shop"] }),
      });
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const text = (label: string, key: string, placeholder = "") => (
    <div>
      <label className="label-text">{label}</label>
      <input
        value={form[key] || ""}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
  const color = (label: string, key: keyof AboutSettings) => (
    <label className="label-text">
      {label}
      <input
        type="color"
        value={about[key] as string}
        onChange={(e) => setAbout(key, e.target.value)}
        className="mt-1 h-10 w-full cursor-pointer"
      />
    </label>
  );

  return (
    <ProtectedAdmin>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {TITLES[section] || "Settings"}
          </h1>
          <p className="text-sm text-secondary-500 mt-1">
            Manage this settings group independently.
          </p>
        </div>
        <section className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
          {section === "branding" && (
            <>
              {text("Store Name", "store_name")} {text("Tagline", "tagline")}
              <ImageUpload
                label="Logo"
                value={form.logo_url || ""}
                onChange={(url) => set("logo_url", url)}
                folder="settings/logo"
                preview={false}
              />{" "}
              <label className="label-text">
                Logo Size: {form.logo_size || 40}px
                <input
                  type="range"
                  min={20}
                  max={160}
                  value={form.logo_size || 40}
                  onChange={(e) => set("logo_size", Number(e.target.value))}
                  className="w-full accent-gold-500"
                />
              </label>
            </>
          )}
          {section === "homepage" && (
            <>
              {text("Hero Title", "hero_title")}{" "}
              {text("Hero Subtitle", "hero_subtitle")}
              <ImageUpload
                label="Hero Image"
                value={form.hero_image_url || ""}
                onChange={(url) => set("hero_image_url", url)}
                folder="settings/hero"
                preview={false}
              />{" "}
              {text("Announcement", "announcement")}
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!form.announcement_active}
                  onChange={(e) => set("announcement_active", e.target.checked)}
                />
                Show announcement bar
              </label>
            </>
          )}
          {section === "announcements" && (
            <>
              <div>
                <label className="label-text">Announcement Text</label>
                <input
                  value={form.announcement || ""}
                  onChange={(e) => set("announcement", e.target.value)}
                  className="input-field"
                  placeholder="Free shipping on orders over $75!"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.announcement_active || false}
                  onChange={(e) => set("announcement_active", e.target.checked)}
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-secondary-700">
                  Show announcement bar
                </span>
              </label>
              <div className="border-t border-secondary-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-secondary-800">
                      Promotional Drop Banner
                    </p>
                    <p className="text-xs text-secondary-400 mt-0.5">
                      Drops from the top on homepage load. Shown max 2× per
                      session. User can dismiss.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.promo_banner_active || false}
                      onChange={(e) =>
                        set("promo_banner_active", e.target.checked)
                      }
                      className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-secondary-700">
                      Active
                    </span>
                  </label>
                </div>
                <div>
                  <label className="label-text">Headline</label>
                  <input
                    ref={promoTitleRef}
                    value={form.promo_banner_title || ""}
                    onChange={(e) => set("promo_banner_title", e.target.value)}
                    className="input-field"
                    placeholder="🔥 Limited Drop — 20% Off This Weekend Only"
                  />
                  <button
                    type="button"
                    onClick={() => setPromoEmojiOpen((open) => !open)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary-500 hover:text-secondary-800 transition-colors"
                  >
                    <span>😊</span>
                    <span>Add emoji</span>
                    <span className="text-secondary-400">
                      {promoEmojiOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {promoEmojiOpen && (
                    <div className="mt-2 border border-secondary-200 rounded-xl p-3 bg-secondary-50 space-y-2">
                      {PROMO_EMOJIS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[10px] font-semibold text-secondary-400 uppercase tracking-wide mb-1">
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {group.icons.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => insertPromoEmoji(emoji)}
                                className="text-lg hover:scale-125 transition-transform leading-none p-0.5 rounded hover:bg-secondary-200"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="label-text">Body Text</label>
                  <input
                    value={form.promo_banner_body || ""}
                    onChange={(e) => set("promo_banner_body", e.target.value)}
                    className="input-field"
                    placeholder="Use code CULTURE20 at checkout. Ends Sunday."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">CTA Button Label</label>
                    <input
                      value={form.promo_banner_cta_label || ""}
                      onChange={(e) =>
                        set("promo_banner_cta_label", e.target.value)
                      }
                      className="input-field"
                      placeholder="Shop the Drop"
                    />
                  </div>
                  <div>
                    <label className="label-text">CTA URL</label>
                    <input
                      value={form.promo_banner_cta_url || ""}
                      onChange={(e) =>
                        set("promo_banner_cta_url", e.target.value)
                      }
                      className="input-field"
                      placeholder="/shop"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="label-text">
                      Banner Background Color
                    </label>
                    <input
                      type="color"
                      value={form.promo_banner_bg_color || "#1a1a1a"}
                      onChange={(e) =>
                        set("promo_banner_bg_color", e.target.value)
                      }
                      className="mt-1 h-10 w-full rounded border border-secondary-200 cursor-pointer"
                    />
                  </div>
                  <div
                    className="flex-shrink-0 rounded-lg overflow-hidden border border-secondary-100"
                    style={{
                      backgroundColor: form.promo_banner_bg_color || "#1a1a1a",
                      minWidth: 160,
                      padding: "10px 16px",
                    }}
                  >
                    <p className="text-white font-bold text-xs truncate">
                      {form.promo_banner_title || "Headline preview"}
                    </p>
                    {form.promo_banner_body && (
                      <p className="text-white/70 text-[10px] mt-0.5 truncate">
                        {form.promo_banner_body}
                      </p>
                    )}
                    {form.promo_banner_cta_label && (
                      <span className="inline-block mt-1.5 px-3 py-0.5 rounded-full bg-white text-secondary-900 text-[10px] font-semibold">
                        {form.promo_banner_cta_label}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {section === "store-information" && (
            <>
              {text("Store Name", "store_name")}
              {text("Tagline", "tagline")}
              <ImageUpload
                label="Logo"
                value={form.logo_url || ""}
                onChange={(url) => set("logo_url", url)}
                folder="settings/logo"
                preview={false}
              />
              <label className="label-text">
                Logo Size: {form.logo_size || 40}px
                <input
                  type="range"
                  min={20}
                  max={160}
                  value={form.logo_size || 40}
                  onChange={(e) => set("logo_size", Number(e.target.value))}
                  className="w-full accent-gold-500"
                />
              </label>
              <div className="border-t border-secondary-100 pt-4 space-y-4">
                <p className="font-semibold text-secondary-800">
                  Footer Branding
                </p>
                <ImageUpload
                  label="Footer Logo Image"
                  value={form.footer_logo_url || ""}
                  onChange={(url) => set("footer_logo_url", url)}
                  folder="settings/footer-logo"
                  preview={false}
                />
                <label className="label-text">
                  Footer Logo Size: {form.footer_logo_size || 40}px
                  <input
                    type="range"
                    min={20}
                    max={160}
                    value={form.footer_logo_size || 40}
                    onChange={(e) =>
                      set("footer_logo_size", Number(e.target.value))
                    }
                    className="w-full accent-gold-500"
                  />
                </label>
                <div>
                  <label className="label-text">Top Footer Text</label>
                  <textarea
                    value={form.footer_text || ""}
                    onChange={(e) => set("footer_text", e.target.value)}
                    className="input-field min-h-[90px]"
                  />
                </div>
                {text(
                  "Bottom Footer Message",
                  "footer_bottom_message",
                  "Made to order. Made with love.",
                )}
              </div>
              <div className="border-t border-secondary-100 pt-4">
                <ImageUpload
                  label="Favicon"
                  value={form.favicon_url || ""}
                  onChange={(url) => set("favicon_url", url)}
                  folder="settings/logo"
                  preview={false}
                />
                <p className="text-xs text-secondary-400 mt-1">
                  Use a square PNG or ICO image for browser tabs.
                </p>
              </div>
            </>
          )}
          {section === "homepage-hero" && (
            <>
              {text("Hero Title", "hero_title")}
              <div>
                <label className="label-text">Hero Subtitle</label>
                <textarea
                  value={form.hero_subtitle || ""}
                  onChange={(e) => set("hero_subtitle", e.target.value)}
                  className="input-field min-h-[80px]"
                />
              </div>
              <ImageUpload
                label="Hero Image URL"
                value={form.hero_image_url || ""}
                onChange={(url) => set("hero_image_url", url)}
                folder="settings/hero"
                preview={false}
              />
              {(() => {
                const position = (form.hero_object_position || "0px 0px")
                  .replace(/px/g, "")
                  .split(" ");
                const x = parseInt(position[0]) || 0;
                const y = parseInt(position[1]) || 0;
                const setPosition = (nextX: number, nextY: number) =>
                  set("hero_object_position", `${nextX}px ${nextY}px`);
                const opacity = (form.hero_gradient_opacity ?? 70) / 100;
                const direction = form.hero_gradient_dir || "left";
                const gradients: Record<string, string> = {
                  left: `linear-gradient(to right, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity * 0.6}) 50%, transparent 100%)`,
                  right: `linear-gradient(to left, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity * 0.6}) 50%, transparent 100%)`,
                  center: `linear-gradient(to bottom, rgba(17,17,17,${opacity * 0.6}) 0%, rgba(17,17,17,${opacity}) 50%, rgba(17,17,17,${opacity * 0.6}) 100%)`,
                  top: `linear-gradient(to bottom, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  bottom: `linear-gradient(to top, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  full: `rgba(17,17,17,${opacity})`,
                  none: "transparent",
                };
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-16">
                        X: {x}px
                      </span>
                      <input
                        type="range"
                        min={-1000}
                        max={1000}
                        value={x}
                        onChange={(e) => setPosition(Number(e.target.value), y)}
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    {form.hero_image_url && (
                      <div className="flex gap-2 items-stretch">
                        <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                          <span className="text-[10px] text-secondary-400">
                            ▲
                          </span>
                          <input
                            type="range"
                            min={30}
                            max={100}
                            value={heroPreviewH}
                            onChange={(e) =>
                              setHeroPreviewH(Number(e.target.value))
                            }
                            className="flex-1 accent-gold-500"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              width: 28,
                              cursor: "ns-resize",
                            }}
                          />
                          <span className="text-[10px] text-secondary-400">
                            ▼
                          </span>
                          <span className="text-[10px] text-secondary-500 mt-1">
                            {heroPreviewH}vh
                          </span>
                        </div>
                        <div
                          className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden"
                          style={{ height: Math.max(240, heroPreviewH * 4) }}
                        >
                          <img
                            src={form.hero_image_url}
                            alt="Hero preview"
                            className={`absolute inset-0 w-full h-full ${form.hero_image_fit === "contain" ? "object-contain" : (form.hero_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`}
                            style={{
                              objectPosition:
                                form.hero_object_position || "center",
                              transform: form.hero_image_flip
                                ? "scaleX(-1)"
                                : undefined,
                              scale: `${form.hero_image_scale ?? 100}%`,
                            }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: gradients[direction] }}
                          />
                          <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                            Live preview
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                          <span className="text-[10px] text-secondary-400">
                            ▲
                          </span>
                          <input
                            type="range"
                            min={-1000}
                            max={1000}
                            value={y}
                            onChange={(e) =>
                              setPosition(x, Number(e.target.value))
                            }
                            className="flex-1 accent-gold-500"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              width: 28,
                              cursor: "ns-resize",
                            }}
                          />
                          <span className="text-[10px] text-secondary-400">
                            ▼
                          </span>
                          <span className="text-[10px] text-secondary-500 mt-1">
                            {y}px
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24">
                        Zoom: {form.hero_image_scale ?? 100}%
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={form.hero_image_scale ?? 100}
                        onChange={(e) =>
                          set("hero_image_scale", Number(e.target.value))
                        }
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24">
                        Overlay: {form.hero_gradient_opacity ?? 70}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.hero_gradient_opacity ?? 70}
                        onChange={(e) =>
                          set("hero_gradient_opacity", Number(e.target.value))
                        }
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div>
                      <label className="label-text">Gradient</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          "left",
                          "right",
                          "center",
                          "top",
                          "bottom",
                          "full",
                          "none",
                        ].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => set("hero_gradient_dir", value)}
                            className={`text-xs px-3 py-1 rounded border capitalize ${direction === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-24">
                        Fit
                      </span>
                      {["cover", "contain"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set("hero_image_fit", value)}
                          className={`text-xs px-3 py-1 rounded border capitalize ${(form.hero_image_fit || "cover") === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                        >
                          {value}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          set("hero_image_flip", !form.hero_image_flip)
                        }
                        className={`text-xs px-3 py-1 rounded border ${form.hero_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                      >
                        Flip
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set("hero_object_position", "center");
                          set("hero_image_scale", 100);
                          set("hero_image_flip", false);
                          set("hero_gradient_opacity", 70);
                          set("hero_gradient_dir", "left");
                          set("hero_image_fit", "cover");
                          setHeroPreviewH(70);
                        }}
                        className="btn-outline py-1 text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                );
              })()}
              <div className="border-t border-secondary-100 pt-5 mt-5 space-y-4">
                <div>
                  <h2 className="font-semibold text-secondary-800">
                    Affirmations Marquee
                  </h2>
                  <p className="text-xs text-secondary-500 mt-1">
                    The scrolling phrase strip displayed directly below the
                    homepage hero.
                  </p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={affirmations.active}
                    onChange={(e) =>
                      setAffirmations((current) => ({
                        ...current,
                        active: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-secondary-700">
                    Show affirmations marquee
                  </span>
                </label>
                <div>
                  <label className="label-text">
                    Phrases{" "}
                    <span className="text-secondary-400 font-normal">
                      (one per line)
                    </span>
                  </label>
                  <textarea
                    ref={affirmationRef}
                    value={affirmations.phrases.join("\n")}
                    onChange={(e) =>
                      setAffirmations((current) => ({
                        ...current,
                        phrases: e.target.value
                          .split("\n")
                          .map((phrase) => phrase.trim())
                          .filter(Boolean),
                      }))
                    }
                    className="input-field min-h-[140px]"
                  />
                  <button
                    type="button"
                    onClick={() => setAffirmationEmojiOpen((open) => !open)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary-500 hover:text-secondary-800 transition-colors"
                  >
                    <span>😊</span>
                    <span>Add emoji</span>
                    <span className="text-secondary-400">
                      {affirmationEmojiOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {affirmationEmojiOpen && (
                    <div className="mt-2 border border-secondary-200 rounded-xl p-3 bg-secondary-50 space-y-2">
                      {AFFIRMATION_EMOJIS.map((group) => (
                        <div key={group.label}>
                          <p className="text-[10px] font-semibold text-secondary-400 uppercase tracking-wide mb-1">
                            {group.label}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {group.icons.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => insertAffirmationEmoji(emoji)}
                                className="text-lg hover:scale-125 transition-transform leading-none p-0.5 rounded hover:bg-secondary-200"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="label-text">
                    Background
                    <input
                      type="color"
                      value={affirmations.backgroundColor}
                      onChange={(e) =>
                        setAffirmations((current) => ({
                          ...current,
                          backgroundColor: e.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full cursor-pointer"
                    />
                  </label>
                  <label className="label-text">
                    Text color
                    <input
                      type="color"
                      value={affirmations.textColor}
                      onChange={(e) =>
                        setAffirmations((current) => ({
                          ...current,
                          textColor: e.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full cursor-pointer"
                    />
                  </label>
                  <label className="label-text">
                    Accent color
                    <input
                      type="color"
                      value={affirmations.accentColor}
                      onChange={(e) =>
                        setAffirmations((current) => ({
                          ...current,
                          accentColor: e.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </>
          )}
          {section === "new-arrivals" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  New Arrivals Carousel
                </h2>
                <p className="text-xs text-secondary-500 mt-1">
                  Products appear here when they are marked as New Arrival in
                  Products.
                </p>
              </div>
              <div>
                <label className="label-text">Section Label</label>
                <input
                  value={newArrivals.eyebrow}
                  onChange={(e) =>
                    setNewArrivals((current) => ({
                      ...current,
                      eyebrow: e.target.value,
                    }))
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Drop Label</label>
                <input
                  value={newArrivals.dropLabel}
                  onChange={(e) =>
                    setNewArrivals((current) => ({
                      ...current,
                      dropLabel: e.target.value,
                    }))
                  }
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Shop Button Label</label>
                  <input
                    value={newArrivals.shopButtonLabel}
                    onChange={(e) =>
                      setNewArrivals((current) => ({
                        ...current,
                        shopButtonLabel: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-text">View All Label</label>
                  <input
                    value={newArrivals.viewAllLabel}
                    onChange={(e) =>
                      setNewArrivals((current) => ({
                        ...current,
                        viewAllLabel: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="label-text">
                  Background
                  <input
                    type="color"
                    value={newArrivals.backgroundColor}
                    onChange={(e) =>
                      setNewArrivals((current) => ({
                        ...current,
                        backgroundColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
                <label className="label-text">
                  Text color
                  <input
                    type="color"
                    value={newArrivals.textColor}
                    onChange={(e) =>
                      setNewArrivals((current) => ({
                        ...current,
                        textColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
                <label className="label-text">
                  Accent color
                  <input
                    type="color"
                    value={newArrivals.accentColor}
                    onChange={(e) =>
                      setNewArrivals((current) => ({
                        ...current,
                        accentColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newArrivals.showAccent}
                  onChange={(e) =>
                    setNewArrivals((current) => ({
                      ...current,
                      showAccent: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-secondary-700">
                  Show accent bar beside drop indicator
                </span>
              </label>
            </>
          )}
          {section === "brand-values" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  Brand Values Band
                </h2>
                <p className="text-xs text-secondary-500 mt-1">
                  Customize the three value blocks shown after New Arrivals.
                </p>
              </div>
              {brandValues.values.map((value, index) => (
                <div
                  key={index}
                  className="border border-secondary-100 rounded-lg p-4 space-y-3"
                >
                  <p className="text-sm font-semibold text-secondary-800">
                    Value {index + 1}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text">Stat</label>
                      <input
                        value={value.stat}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            values: current.values.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, stat: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label-text">Label</label>
                      <input
                        value={value.label}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            values: current.values.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, label: e.target.value }
                                : item,
                            ),
                          }))
                        }
                        className="input-field"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label-text">Supporting text</label>
                    <input
                      value={value.sub}
                      onChange={(e) =>
                        setBrandValues((current) => ({
                          ...current,
                          values: current.values.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, sub: e.target.value }
                              : item,
                          ),
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="label-text">
                  Background
                  <input
                    type="color"
                    value={brandValues.backgroundColor}
                    onChange={(e) =>
                      setBrandValues((current) => ({
                        ...current,
                        backgroundColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
                <label className="label-text">
                  Text color
                  <input
                    type="color"
                    value={brandValues.textColor}
                    onChange={(e) =>
                      setBrandValues((current) => ({
                        ...current,
                        textColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
                <label className="label-text">
                  Accent color
                  <input
                    type="color"
                    value={brandValues.accentColor}
                    onChange={(e) =>
                      setBrandValues((current) => ({
                        ...current,
                        accentColor: e.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full cursor-pointer"
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 cursor-pointer border-t border-secondary-100 pt-4">
                <input
                  type="checkbox"
                  checked={brandValues.advanced}
                  onChange={(e) =>
                    setBrandValues((current) => ({
                      ...current,
                      advanced: e.target.checked,
                    }))
                  }
                  className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-secondary-700">
                  Use advanced Brand Values controls
                </span>
              </label>
              {brandValues.advanced && (
                <div className="border-t border-secondary-100 pt-4 space-y-4">
                  <p className="text-sm text-secondary-500">
                    Advanced mode replaces the basic presentation only when
                    enabled. Turn it off to keep the current controls and
                    layout.
                  </p>
                  <ImageUpload
                    label="Background Image"
                    value={brandValues.backgroundImage}
                    onChange={(url) =>
                      setBrandValues((current) => ({
                        ...current,
                        backgroundImage: url,
                      }))
                    }
                    folder="settings/brand-values"
                    preview={false}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="label-text">
                      Columns
                      <select
                        value={brandValues.columns}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            columns: Number(e.target.value) as 1 | 2 | 3 | 4,
                          }))
                        }
                        className="input-field mt-1"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </label>
                    <label className="label-text">
                      Alignment
                      <select
                        value={brandValues.alignment}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            alignment: e.target.value as "left" | "center",
                          }))
                        }
                        className="input-field mt-1"
                      >
                        <option value="center">Center</option>
                        <option value="left">Left</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="label-text">
                      Divider
                      <select
                        value={brandValues.divider}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            divider: e.target.value as
                              "none" | "horizontal" | "vertical",
                          }))
                        }
                        className="input-field mt-1"
                      >
                        <option value="none">None</option>
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                      </select>
                    </label>
                    <label className="label-text">
                      Padding
                      <select
                        value={brandValues.padding}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            padding: e.target.value as
                              "compact" | "comfortable" | "spacious",
                          }))
                        }
                        className="input-field mt-1"
                      >
                        <option value="compact">Compact</option>
                        <option value="comfortable">Comfortable</option>
                        <option value="spacious">Spacious</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="label-text">
                      Card background
                      <input
                        type="text"
                        value={brandValues.cardBackgroundColor}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            cardBackgroundColor: e.target.value,
                          }))
                        }
                        className="input-field mt-1"
                      />
                    </label>
                    <label className="label-text">
                      Card border
                      <input
                        type="text"
                        value={brandValues.cardBorderColor}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            cardBorderColor: e.target.value,
                          }))
                        }
                        className="input-field mt-1"
                      />
                    </label>
                    <label className="label-text">
                      Divider color
                      <input
                        type="text"
                        value={brandValues.dividerColor}
                        onChange={(e) =>
                          setBrandValues((current) => ({
                            ...current,
                            dividerColor: e.target.value,
                          }))
                        }
                        className="input-field mt-1"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brandValues.animate}
                      onChange={(e) =>
                        setBrandValues((current) => ({
                          ...current,
                          animate: e.target.checked,
                        }))
                      }
                      className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-secondary-700">
                      Animate value cards on reveal
                    </span>
                  </label>
                  {brandValues.values.map((value, index) => (
                    <div
                      key={`advanced-${index}`}
                      className="border border-secondary-100 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-secondary-800">
                          Advanced Value {index + 1}
                        </p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              setBrandValues((current) => {
                                const values = [...current.values];
                                [values[index - 1], values[index]] = [
                                  values[index],
                                  values[index - 1],
                                ];
                                return { ...current, values };
                              })
                            }
                            className="px-2 py-1 text-xs border rounded disabled:opacity-30"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={index === brandValues.values.length - 1}
                            onClick={() =>
                              setBrandValues((current) => {
                                const values = [...current.values];
                                [values[index], values[index + 1]] = [
                                  values[index + 1],
                                  values[index],
                                ];
                                return { ...current, values };
                              })
                            }
                            className="px-2 py-1 text-xs border rounded disabled:opacity-30"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBrandValues((current) => ({
                                ...current,
                                values: current.values.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              }))
                            }
                            className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="label-text">
                          Icon/emoji
                          <input
                            value={value.icon || ""}
                            onChange={(e) =>
                              setBrandValues((current) => ({
                                ...current,
                                values: current.values.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, icon: e.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="input-field mt-1"
                          />
                        </label>
                        <label className="label-text">
                          Stat
                          <input
                            value={value.stat}
                            onChange={(e) =>
                              setBrandValues((current) => ({
                                ...current,
                                values: current.values.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, stat: e.target.value }
                                    : item,
                                ),
                              }))
                            }
                            className="input-field mt-1"
                          />
                        </label>
                        <label className="label-text">
                          Enabled
                          <input
                            type="checkbox"
                            checked={value.enabled !== false}
                            onChange={(e) =>
                              setBrandValues((current) => ({
                                ...current,
                                values: current.values.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, enabled: e.target.checked }
                                    : item,
                                ),
                              }))
                            }
                            className="mt-3 ml-2 w-5 h-5"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setBrandValues((current) => ({
                        ...current,
                        values: [
                          ...current.values,
                          {
                            stat: "New",
                            label: "New Value",
                            sub: "Describe this value",
                            icon: "✨",
                            enabled: true,
                          },
                        ],
                      }))
                    }
                    className="btn-outline py-2 text-sm"
                  >
                    Add Value
                  </button>
                </div>
              )}
            </>
          )}
          {section === "our-why" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  Our Why Section
                </h2>
                <p className="text-xs text-secondary-500 mt-1">
                  Customize the split story section shown after Featured Picks.
                </p>
              </div>
              {text("Label", "our_why_label", "Our Why")}
              {text(
                "Quote",
                "our_why_quote",
                "We do not just sell clothes. We help you show up as yourself.",
              )}
              <div>
                <label className="label-text">Body Text</label>
                <textarea
                  value={form.our_why_body || ""}
                  onChange={(e) => set("our_why_body", e.target.value)}
                  className="input-field min-h-[120px]"
                />
              </div>
              <ImageUpload
                label="Our Why Image"
                value={form.our_why_image_url || ""}
                onChange={(url) => set("our_why_image_url", url)}
                folder="settings/our-why"
                preview={false}
              />
              <button
                type="button"
                onClick={() => setShowOurWhyPicker(true)}
                className="btn-outline py-2 text-sm"
              >
                📷 Pick from Product Library
              </button>
              {showOurWhyPicker && (
                <ProductImagePicker
                  onSelect={(url) => {
                    set("our_why_image_url", url);
                    setShowOurWhyPicker(false);
                  }}
                  onClose={() => setShowOurWhyPicker(false)}
                />
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs w-24">Fit</span>
                {["cover", "contain"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("our_why_image_fit", value)}
                    className={`text-xs px-2 py-1 rounded border capitalize ${(form.our_why_image_fit || "cover") === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    set("our_why_image_flip", !form.our_why_image_flip)
                  }
                  className={`text-xs px-2 py-1 rounded border ${form.our_why_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                >
                  ⇄ Flip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    set("our_why_object_position", "0px 0px");
                    set("our_why_image_scale", 100);
                    set("our_why_image_flip", false);
                    set("our_why_gradient_opacity", 70);
                    set("our_why_gradient_dir", "left");
                    set("our_why_image_fit", "cover");
                    setOurWhyPreviewH(400);
                  }}
                  className="btn-outline py-1 text-xs"
                >
                  Reset
                </button>
              </div>
              {(() => {
                const position = (form.our_why_object_position || "0px 0px")
                  .replace(/px/g, "")
                  .split(" ");
                const x = parseInt(position[0]) || 0;
                const y = parseInt(position[1]) || 0;
                const setPosition = (nextX: number, nextY: number) =>
                  set("our_why_object_position", `${nextX}px ${nextY}px`);
                const opacity = (form.our_why_gradient_opacity ?? 70) / 100;
                const direction = form.our_why_gradient_dir || "left";
                const gradients: Record<string, string> = {
                  left: `linear-gradient(to right, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity * 0.6}) 50%, transparent 100%)`,
                  right: `linear-gradient(to left, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity * 0.6}) 50%, transparent 100%)`,
                  center: `linear-gradient(to bottom, rgba(17,17,17,${opacity * 0.6}) 0%, rgba(17,17,17,${opacity}) 50%, rgba(17,17,17,${opacity * 0.6}) 100%)`,
                  top: `linear-gradient(to bottom, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  bottom: `linear-gradient(to top, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  full: `rgba(17,17,17,${opacity})`,
                  none: "transparent",
                };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-secondary-500 w-16">
                        X: {x}px
                      </span>
                      <input
                        type="range"
                        min={-1000}
                        max={1000}
                        value={x}
                        onChange={(e) => setPosition(Number(e.target.value), y)}
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    {form.our_why_image_url && (
                      <div className="flex gap-2 items-stretch">
                        <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                          <span className="text-[10px]">▲</span>
                          <input
                            type="range"
                            min={200}
                            max={800}
                            value={ourWhyPreviewH}
                            onChange={(e) =>
                              setOurWhyPreviewH(Number(e.target.value))
                            }
                            className="flex-1 accent-gold-500"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              width: 28,
                              cursor: "ns-resize",
                            }}
                          />
                          <span className="text-[10px]">▼</span>
                          <span className="text-[10px] text-secondary-500">
                            {ourWhyPreviewH}px
                          </span>
                        </div>
                        <div
                          className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden"
                          style={{ height: ourWhyPreviewH / 2 }}
                        >
                          <img
                            src={form.our_why_image_url}
                            alt="Our Why preview"
                            className={`absolute inset-0 w-full h-full ${form.our_why_image_fit === "contain" ? "object-contain" : (form.our_why_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`}
                            style={{
                              objectPosition:
                                form.our_why_object_position || "center",
                              transform: form.our_why_image_flip
                                ? "scaleX(-1)"
                                : undefined,
                              scale: `${form.our_why_image_scale ?? 100}%`,
                            }}
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: gradients[direction] }}
                          />
                          <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                            Live preview
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 w-10 flex-shrink-0">
                          <span className="text-[10px]">▲</span>
                          <input
                            type="range"
                            min={-1000}
                            max={1000}
                            value={y}
                            onChange={(e) =>
                              setPosition(x, Number(e.target.value))
                            }
                            className="flex-1 accent-gold-500"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              width: 28,
                              cursor: "ns-resize",
                            }}
                          />
                          <span className="text-[10px]">▼</span>
                          <span className="text-[10px] text-secondary-500">
                            {y}px
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-24">
                        Zoom: {form.our_why_image_scale ?? 100}%
                      </span>
                      <input
                        type="range"
                        min={10}
                        max={100}
                        value={form.our_why_image_scale ?? 100}
                        onChange={(e) =>
                          set("our_why_image_scale", Number(e.target.value))
                        }
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-24">
                        Overlay: {form.our_why_gradient_opacity ?? 70}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.our_why_gradient_opacity ?? 70}
                        onChange={(e) =>
                          set(
                            "our_why_gradient_opacity",
                            Number(e.target.value),
                          )
                        }
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs w-24">Gradient</span>
                      {[
                        "left",
                        "right",
                        "center",
                        "top",
                        "bottom",
                        "full",
                        "none",
                      ].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set("our_why_gradient_dir", value)}
                          className={`text-xs px-2 py-1 rounded border capitalize ${direction === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">Fit</span>
                      {["cover", "contain"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set("our_why_image_fit", value)}
                          className={`text-xs px-2 py-1 rounded border capitalize ${(form.our_why_image_fit || "cover") === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                        >
                          {value}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          set("our_why_image_flip", !form.our_why_image_flip)
                        }
                        className={`text-xs px-2 py-1 rounded border ${form.our_why_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                      >
                        Flip
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set("our_why_object_position", "0px 0px");
                          set("our_why_image_scale", 100);
                          set("our_why_image_flip", false);
                          set("our_why_gradient_opacity", 70);
                          set("our_why_gradient_dir", "left");
                          set("our_why_image_fit", "cover");
                          setOurWhyPreviewH(400);
                        }}
                        className="btn-outline py-1 text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          {section === "wear-your-story" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  Wear Your Story Section
                </h2>
                <p className="text-xs text-secondary-500 mt-1">
                  Customize the image panel shown in the Wear Your Story
                  section.
                </p>
              </div>
              <ImageUpload
                label="Background Image URL"
                value={form.story_image_url || ""}
                onChange={(url) => set("story_image_url", url)}
                folder="settings/story"
                preview={false}
              />
              <button
                type="button"
                onClick={() => setShowOurWhyPicker(true)}
                className="btn-outline py-2 text-sm"
              >
                📷 Pick from Product Library
              </button>
              {showOurWhyPicker && (
                <ProductImagePicker
                  onSelect={(url) => {
                    set("story_image_url", url);
                    setShowOurWhyPicker(false);
                  }}
                  onClose={() => setShowOurWhyPicker(false)}
                />
              )}
              {(() => {
                const position = (form.story_object_position || "0px 0px")
                  .replace(/px/g, "")
                  .split(" ");
                const x = parseInt(position[0]) || 0;
                const y = parseInt(position[1]) || 0;
                const setPosition = (nextX: number, nextY: number) =>
                  set("story_object_position", `${nextX}px ${nextY}px`);
                const opacity = (form.story_gradient_opacity ?? 40) / 100;
                const direction = form.story_gradient_dir || "full";
                const gradients: Record<string, string> = {
                  left: `linear-gradient(to right, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  right: `linear-gradient(to left, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  center: `linear-gradient(to bottom, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  top: `linear-gradient(to bottom, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  bottom: `linear-gradient(to top, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                  full: `rgba(17,17,17,${opacity})`,
                  none: "transparent",
                };
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-16">X: {x}px</span>
                      <input
                        type="range"
                        min={-1000}
                        max={1000}
                        value={x}
                        onChange={(e) => setPosition(Number(e.target.value), y)}
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div className="flex gap-2 items-stretch">
                      <div className="flex flex-col items-center gap-1 w-10">
                        <span>▲</span>
                        <input
                          type="range"
                          min={10}
                          max={200}
                          value={form.story_image_scale ?? 100}
                          onChange={(e) =>
                            set("story_image_scale", Number(e.target.value))
                          }
                          className="flex-1 accent-gold-500"
                          style={{
                            writingMode: "vertical-lr",
                            direction: "rtl",
                            width: 28,
                          }}
                        />
                        <span>▼</span>
                        <span className="text-[10px]">
                          {form.story_image_scale ?? 100}%
                        </span>
                      </div>
                      <div
                        className="flex-1 relative rounded-lg bg-secondary-900 overflow-hidden"
                        style={{ height: 200 }}
                      >
                        <img
                          src={form.story_image_url || ""}
                          alt="Story preview"
                          className={`absolute inset-0 w-full h-full ${form.story_image_fit === "contain" ? "object-contain" : "object-cover"}`}
                          style={{
                            objectPosition:
                              form.story_object_position || "center",
                            transform: form.story_image_flip
                              ? "scaleX(-1)"
                              : undefined,
                            scale: `${form.story_image_scale ?? 100}%`,
                          }}
                        />
                        <div
                          className="absolute inset-0"
                          style={{ background: gradients[direction] }}
                        />
                        <span className="absolute bottom-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded">
                          Live preview
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1 w-10">
                        <span>▲</span>
                        <input
                          type="range"
                          min={-1000}
                          max={1000}
                          value={y}
                          onChange={(e) =>
                            setPosition(x, Number(e.target.value))
                          }
                          className="flex-1 accent-gold-500"
                          style={{
                            writingMode: "vertical-lr",
                            direction: "rtl",
                            width: 28,
                          }}
                        />
                        <span>▼</span>
                        <span className="text-[10px]">{y}px</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs w-24">
                        Overlay: {form.story_gradient_opacity ?? 40}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.story_gradient_opacity ?? 40}
                        onChange={(e) =>
                          set("story_gradient_opacity", Number(e.target.value))
                        }
                        className="flex-1 accent-gold-500"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs w-24">Gradient</span>
                      {[
                        "left",
                        "right",
                        "center",
                        "top",
                        "bottom",
                        "full",
                        "none",
                      ].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set("story_gradient_dir", value)}
                          className={`text-xs px-2 py-1 rounded border capitalize ${direction === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-24">Fit</span>
                      {["cover", "contain"].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => set("story_image_fit", value)}
                          className={`text-xs px-2 py-1 rounded border capitalize ${(form.story_image_fit || "cover") === value ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          set("story_image_flip", !form.story_image_flip)
                        }
                        className={`text-xs px-2 py-1 rounded border ${form.story_image_flip ? "bg-gold-500 text-white border-gold-500" : "border-secondary-300"}`}
                      >
                        ⇄ Flip
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set("story_object_position", "0px 0px");
                          set("story_image_scale", 100);
                          set("story_image_flip", false);
                          set("story_gradient_opacity", 40);
                          set("story_gradient_dir", "full");
                          set("story_image_fit", "cover");
                        }}
                        className="btn-outline py-1 text-xs"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          {section === "customer-love" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  Customer Love
                </h2>
                <p className="text-xs text-secondary-500 mt-1">
                  Edit the three testimonials shown in the &ldquo;What the
                  Culture is Saying&rdquo; section.
                </p>
              </div>
              <div className="space-y-6">
                {(
                  (form.testimonials as Testimonial[] | undefined) ??
                  DEFAULT_TESTIMONIALS
                ).map((testimonial: Testimonial, index: number) => (
                  <div
                    key={index}
                    className="space-y-3 p-4 bg-secondary-50 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wide">
                        Review {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "testimonials",
                            (
                              (form.testimonials as
                                Testimonial[] | undefined) ??
                              DEFAULT_TESTIMONIALS
                            ).filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Remove review
                      </button>
                    </div>
                    <div>
                      <label className="label-text">Quote</label>
                      <textarea
                        value={testimonial.quote}
                        onChange={(e) =>
                          set(
                            "testimonials",
                            (
                              (form.testimonials as
                                Testimonial[] | undefined) ??
                              DEFAULT_TESTIMONIALS
                            ).map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, quote: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className="input-field min-h-[80px]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label-text">Name</label>
                        <input
                          value={testimonial.name}
                          onChange={(e) =>
                            set(
                              "testimonials",
                              (
                                (form.testimonials as
                                  Testimonial[] | undefined) ??
                                DEFAULT_TESTIMONIALS
                              ).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, name: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label-text">Location</label>
                        <input
                          value={testimonial.location}
                          onChange={(e) =>
                            set(
                              "testimonials",
                              (
                                (form.testimonials as
                                  Testimonial[] | undefined) ??
                                DEFAULT_TESTIMONIALS
                              ).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, location: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="label-text">Product</label>
                        <input
                          value={testimonial.product}
                          onChange={(e) =>
                            set(
                              "testimonials",
                              (
                                (form.testimonials as
                                  Testimonial[] | undefined) ??
                                DEFAULT_TESTIMONIALS
                              ).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, product: e.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    set("testimonials", [
                      ...((form.testimonials as Testimonial[] | undefined) ??
                        DEFAULT_TESTIMONIALS),
                      { quote: "", name: "", location: "", product: "" },
                    ])
                  }
                  className="btn-outline py-2 text-sm"
                >
                  Add Review
                </button>
              </div>
            </>
          )}
          {section === "about" && (
            <>
              <h2 className="font-semibold text-secondary-800">Hero</h2>
              {text("Eyebrow", "about_heroEyebrow")}
              <div>
                <label className="label-text">Title</label>
                <input
                  value={about.heroTitle}
                  onChange={(e) => setAbout("heroTitle", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Subtitle</label>
                <input
                  value={about.heroSubtitle}
                  onChange={(e) => setAbout("heroSubtitle", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Quote</label>
                <input
                  value={about.heroQuote}
                  onChange={(e) => setAbout("heroQuote", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Credit</label>
                <input
                  value={about.heroCredit}
                  onChange={(e) => setAbout("heroCredit", e.target.value)}
                  className="input-field"
                />
              </div>
              <ImageUpload
                label="Hero Image"
                value={about.heroImageUrl}
                onChange={(url) => setAbout("heroImageUrl", url)}
                folder="settings/about"
                preview={false}
              />
              <div className="grid grid-cols-2 gap-4">
                {color("Hero Background", "heroBackground")}
                {color("Hero Text", "heroTextColor")}
              </div>
              <h2 className="font-semibold text-secondary-800 pt-4">Mission</h2>
              <div>
                <label className="label-text">Eyebrow</label>
                <input
                  value={about.missionEyebrow}
                  onChange={(e) => setAbout("missionEyebrow", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Title</label>
                <input
                  value={about.missionTitle}
                  onChange={(e) => setAbout("missionTitle", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Body</label>
                <textarea
                  value={about.missionBody}
                  onChange={(e) => setAbout("missionBody", e.target.value)}
                  className="input-field min-h-[100px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {color("Mission Background", "missionBackground")}
                {color("Mission Text", "missionTextColor")}
              </div>
              <h2 className="font-semibold text-secondary-800 pt-4">Culture</h2>
              <div>
                <label className="label-text">Eyebrow</label>
                <input
                  value={about.cultureEyebrow}
                  onChange={(e) => setAbout("cultureEyebrow", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Title</label>
                <input
                  value={about.cultureTitle}
                  onChange={(e) => setAbout("cultureTitle", e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Body</label>
                <textarea
                  value={about.cultureBody}
                  onChange={(e) => setAbout("cultureBody", e.target.value)}
                  className="input-field min-h-[100px]"
                />
              </div>
              <div>
                <label className="label-text">Closing statement</label>
                <input
                  value={about.cultureCreed}
                  onChange={(e) => setAbout("cultureCreed", e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {color("Culture Background", "cultureBackground")}
                {color("Culture Text", "cultureTextColor")}
              </div>
            </>
          )}
          {section === "footer" && (
            <>
              <ImageUpload
                label="Footer Logo"
                value={form.footer_logo_url || ""}
                onChange={(url) => set("footer_logo_url", url)}
                folder="settings/footer-logo"
                preview={false}
              />
              <label className="label-text">
                Footer Logo Size: {form.footer_logo_size || 40}px
                <input
                  type="range"
                  min={20}
                  max={160}
                  value={form.footer_logo_size || 40}
                  onChange={(e) =>
                    set("footer_logo_size", Number(e.target.value))
                  }
                  className="w-full accent-gold-500"
                />
              </label>
              <div>
                <label className="label-text">Footer Text</label>
                <textarea
                  value={form.footer_text || ""}
                  onChange={(e) => set("footer_text", e.target.value)}
                  className="input-field min-h-[100px]"
                />
              </div>
              {text("Bottom Footer Message", "footer_bottom_message")}
            </>
          )}
          {section === "integrations" && (
            <>
              <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Printer
                    size={22}
                    className={
                      form.printify_connected
                        ? "text-success-500"
                        : "text-secondary-400"
                    }
                  />
                  <div>
                    <p className="font-medium text-secondary-900">Printify</p>
                    <p className="text-sm text-secondary-500">
                      Print-on-demand fulfillment
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${form.printify_connected ? "bg-success-50 text-success-600" : "bg-secondary-100 text-secondary-500"}`}
                >
                  {form.printify_connected ? "Connected" : "Not Connected"}
                </span>
              </div>
              <div>
                {text("Printify Shop ID", "printify_shop_id", "e.g. 12345678")}
                <p className="text-xs text-secondary-400 mt-1">
                  Find this in your Printify dashboard URL or via the API.
                </p>
              </div>
              <div className="border border-secondary-100 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-secondary-50">
                  <div className="flex items-center gap-3">
                    <CreditCard
                      size={22}
                      className={
                        stripeOk === "connected"
                          ? "text-success-500"
                          : stripeOk === "warning"
                            ? "text-warning-500"
                            : "text-secondary-400"
                      }
                    />
                    <div>
                      <p className="font-medium text-secondary-900">Stripe</p>
                      <p className="text-sm text-secondary-500">
                        Payment processing
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={stripeOk} />
                </div>
                <div className="p-4 space-y-3">
                  <label className="label-text">
                    Secret Key
                    <div className="relative">
                      <input
                        type={showStripeSecret ? "text" : "password"}
                        value={stripeSecret}
                        onChange={(e) => {
                          setStripeSecret(e.target.value);
                          setStripeResult(null);
                        }}
                        placeholder="sk_test_... or sk_live_..."
                        className="input-field pr-10"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowStripeSecret((visible) => !visible)
                        }
                        className="absolute right-3 top-2.5 text-secondary-400"
                      >
                        {showStripeSecret ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </label>
                  {stripeSecret && (
                    <p
                      className={`text-xs flex items-center gap-1 ${stripeSecret.startsWith("sk_live") ? "text-success-600" : stripeSecret.startsWith("sk_test") ? "text-amber-600" : "text-error-600"}`}
                    >
                      {stripeSecret.startsWith("sk_live")
                        ? "✓ Live key - real payments"
                        : stripeSecret.startsWith("sk_test")
                          ? "⚠ Test key - no real money"
                          : "✗ Invalid key format"}
                    </p>
                  )}
                  <p className="text-xs text-secondary-500">
                    Entering a key registers the webhook endpoint automatically.
                    The signing secret will be shown. Copy it and run:{" "}
                    <code className="bg-secondary-100 px-1 rounded">
                      npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
                      --project-ref SUPABASE_PROJECT_REF_REDACTED
                    </code>
                  </p>
                  {stripeResult && (
                    <div
                      className={`rounded-lg p-3 text-xs ${stripeResult.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}
                    >
                      {stripeResult.type === "success" && (
                        <p className="font-semibold mb-1">
                          ✓ Webhook registered successfully
                        </p>
                      )}
                      <p className="break-all">{stripeResult.msg}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={registerStripeWebhook}
                    disabled={
                      stripeSaving ||
                      (!stripeSecret.startsWith("sk_test") &&
                        !stripeSecret.startsWith("sk_live"))
                    }
                    className="btn-primary py-2 text-sm"
                  >
                    {stripeSaving ? (
                      <>
                        <Loader2 size={15} className="mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Save Key & Register Webhook"
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Send
                    size={22}
                    className={
                      mailerOk === "connected"
                        ? "text-success-500"
                        : mailerOk === "warning"
                          ? "text-warning-500"
                          : "text-secondary-400"
                    }
                  />
                  <div>
                    <p className="font-medium text-secondary-900">MailerLite</p>
                    <p className="text-sm text-secondary-500">
                      Email marketing
                    </p>
                  </div>
                </div>
                <StatusBadge status={mailerOk} />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Mail
                    size={22}
                    className={
                      resendOk === "connected"
                        ? "text-success-500"
                        : resendOk === "warning"
                          ? "text-warning-500"
                          : "text-secondary-400"
                    }
                  />
                  <div>
                    <p className="font-medium text-secondary-900">Resend</p>
                    <p className="text-sm text-secondary-500">
                      Transactional email
                    </p>
                  </div>
                </div>
                <StatusBadge status={resendOk} />
              </div>
              <div className="rounded-lg border border-secondary-100 bg-secondary-50 p-4 space-y-3 text-xs text-secondary-600">
                <p className="font-semibold text-secondary-700 text-sm">
                  Connection Status Guide
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <span>
                    <strong className="text-success-600">Connected</strong> -
                    API key is valid and active.
                  </span>
                  <span>
                    <strong className="text-warning-600">Account Issue</strong>{" "}
                    - Key found but access denied (suspended or missing
                    permissions).
                  </span>
                  <span>
                    <strong className="text-error-600">Not Connected</strong> -
                    API key is missing or invalid.
                  </span>
                  <span>
                    <strong className="text-secondary-500">Checking...</strong>{" "}
                    - Status is being verified on page load.
                  </span>
                </div>
                <div className="border-t border-secondary-200 pt-3 space-y-1">
                  <p className="font-semibold text-secondary-700">
                    Where to manage keys
                  </p>
                  <ul className="space-y-1 list-none">
                    <li>
                      <strong>Stripe</strong> - Set{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        STRIPE_SECRET_KEY
                      </code>{" "}
                      in{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        .env.local
                      </code>{" "}
                      and as a Supabase secret via{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        supabase secrets set
                      </code>
                      . Manage at{" "}
                      <a
                        href="https://dashboard.stripe.com/apikeys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 underline"
                      >
                        dashboard.stripe.com/apikeys
                      </a>
                      .
                    </li>
                    <li>
                      <strong>MailerLite</strong> - Set{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        MAILER_LITE_API_KEY
                      </code>{" "}
                      in{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        .env.local
                      </code>
                      . Generate at{" "}
                      <a
                        href="https://dashboard.mailerlite.com/integrations/api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 underline"
                      >
                        dashboard.mailerlite.com/integrations/api
                      </a>
                      .
                    </li>
                    <li>
                      <strong>Resend</strong> - Set{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        RESEND_API_KEY
                      </code>{" "}
                      in{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        .env.local
                      </code>
                      . Manage at{" "}
                      <a
                        href="https://resend.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 underline"
                      >
                        resend.com/api-keys
                      </a>
                      . Sending domain must be verified.
                    </li>
                    <li>
                      <strong>Printify</strong> - Status is read from the
                      database. Update{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        PRINTIFY_API_TOKEN
                      </code>{" "}
                      in{" "}
                      <code className="bg-secondary-100 px-1 rounded">
                        .env.local
                      </code>{" "}
                      and set the Shop ID above.
                    </li>
                  </ul>
                </div>
              </div>
            </>
          )}
          {section === "social" && (
            <>
              <div>
                <h2 className="font-semibold text-secondary-800">
                  Social Media
                </h2>
                <p className="text-sm text-secondary-500 mt-1">
                  Toggle and update the social links shown in the footer.
                  Disabled icons are hidden from visitors.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  [
                    "instagram",
                    "Instagram",
                    "https://instagram.com/yourhandle",
                  ],
                  ["tiktok", "TikTok", "https://tiktok.com/@yourhandle"],
                  ["facebook", "Facebook", "https://facebook.com/yourpage"],
                  ["youtube", "YouTube", "https://youtube.com/@yourchannel"],
                  [
                    "pinterest",
                    "Pinterest",
                    "https://pinterest.com/yourprofile",
                  ],
                  [
                    "snapchat",
                    "Snapchat",
                    "https://snapchat.com/add/yourhandle",
                  ],
                  ["threads", "Threads", "https://threads.net/@yourhandle"],
                  ["email", "Email", "mailto:hello@yourdomain.com"],
                ].map(([key, label, placeholder]) => {
                  const value = form.social_links?.[key] || {
                    url: "",
                    enabled: false,
                  };
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-3 p-3 bg-secondary-50 rounded-lg">
                        <button
                          type="button"
                          onClick={() =>
                            set("social_links", {
                              ...form.social_links,
                              [key]: { ...value, enabled: !value.enabled },
                            })
                          }
                          className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${value.enabled ? "bg-primary-500" : "bg-secondary-200"}`}
                          aria-label={`Toggle ${label}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value.enabled ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                        <span
                          className={`text-sm font-medium w-20 flex-shrink-0 ${value.enabled ? "text-secondary-900" : "text-secondary-400"}`}
                        >
                          {label}
                        </span>
                        <input
                          value={value.url || ""}
                          onChange={(e) =>
                            set("social_links", {
                              ...form.social_links,
                              [key]: { ...value, url: e.target.value },
                            })
                          }
                          placeholder={placeholder}
                          disabled={!value.enabled}
                          className="input-field flex-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        {value.url && value.enabled && (
                          <a
                            href={value.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-secondary-400 hover:text-primary-500 transition-colors flex-shrink-0"
                            title="Preview link"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                      </div>
                      {key === "email" && (
                        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-secondary-700 space-y-1.5">
                          <p className="font-semibold text-secondary-900">
                            📧 Domain email required
                          </p>
                          <p>
                            This address and any email used for sending must
                            come from a <strong>verified custom domain</strong>{" "}
                            - e.g.{" "}
                            <code className="bg-white px-1 rounded text-xs">
                              orders@yourdomain.com
                            </code>
                            .
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-secondary-600 pl-1">
                            <li>
                              MailerLite requires a verified sending domain.
                            </li>
                            <li>
                              Resend requires a verified sending domain for
                              transactional email.
                            </li>
                            <li>
                              Printify shipment notifications use your store
                              address.
                            </li>
                          </ul>
                          <p className="text-xs text-secondary-500">
                            Verify your domain in MailerLite and Resend before
                            sending.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-secondary-100">
            {error && <span className="text-sm text-red-600">{error}</span>}
            <button onClick={save} className="btn-primary">
              {saved ? (
                <>
                  <Check size={18} className="mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </ProtectedAdmin>
  );
}
