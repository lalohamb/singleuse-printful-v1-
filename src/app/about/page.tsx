import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Sparkles, Users, Globe, Mail, Quote } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_ABOUT_SETTINGS, DEFAULT_MISSION_CARDS, DEFAULT_CULTURE_CARDS, type AboutSettings } from "@/lib/about-settings";
import AppImage from "@/components/AppImage";

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
import StorefrontLayout from "@/components/StorefrontLayout";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Story",
  description: "Learn about Your Store, a made-to-order clothing brand designed for every body, every style, and every day.",
};

export default async function AboutPage() {
  const { data } = await supabase.from("settings").select("about_settings").limit(1).maybeSingle();
  const about = { ...DEFAULT_ABOUT_SETTINGS, ...Object.fromEntries(
    Object.entries((data?.about_settings || {}) as Partial<AboutSettings>).filter(([, v]) => v !== "" && v !== null && v !== undefined)
  ) };

  return (
    <StorefrontLayout>
      <div>
        <section className="min-h-[70vh] flex flex-col lg:flex-row">
          <div className="flex-1 flex items-center px-8 sm:px-12 lg:px-16 py-16" style={{ backgroundColor: about.heroBackground, color: about.heroTextColor }}>
            <div>
              <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-4">{about.heroEyebrow}</p>
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight">{about.heroTitle}</h1>
              <p className="text-lg opacity-70 mt-6 max-w-md leading-relaxed">{about.heroSubtitle}</p>
              <div className="mt-8 border-l-4 border-gold-500 pl-5">
                <p className="opacity-80 italic">&ldquo;{about.heroQuote}&rdquo;</p>
                <p className="text-secondary-400 text-sm mt-2">— {about.heroCredit}</p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-[45%] h-72 lg:h-auto relative overflow-hidden">
            {(() => {
              const opacity = (about.heroGradientOpacity ?? 40) / 100;
              const dir = about.heroGradientDir || "right";
              const gradients: Record<string, string> = {
                left:   `linear-gradient(to right, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity*0.6}) 50%, transparent 100%)`,
                right:  `linear-gradient(to left, rgba(17,17,17,${opacity}) 0%, rgba(17,17,17,${opacity*0.6}) 50%, transparent 100%)`,
                center: `linear-gradient(to bottom, rgba(17,17,17,${opacity*0.6}) 0%, rgba(17,17,17,${opacity}) 50%, rgba(17,17,17,${opacity*0.6}) 100%)`,
                top:    `linear-gradient(to bottom, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                bottom: `linear-gradient(to top, rgba(17,17,17,${opacity}) 0%, transparent 100%)`,
                full:   `rgba(17,17,17,${opacity})`,
                none:   "transparent",
              };
              return (
                <>
                  <AppImage
                    fill
                    src={about.heroImageUrl}
                    alt={about.storyImageAlt}
                    className={`w-full h-full ${about.heroImageFit === "contain" ? "object-contain" : "object-cover"}`}
                    style={{
                      objectPosition: about.heroObjectPosition || "50% 20%",
                      transform: about.heroImageFlip ? "scaleX(-1)" : undefined,
                      scale: `${about.heroImageScale ?? 100}%`,
                    }}
                  />
                  <div className="absolute inset-0" style={{ background: gradients[dir] }} />
                </>
              );
            })()}
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div className="space-y-6 text-secondary-700 leading-relaxed text-lg order-2 lg:order-1">
              <p>{about.storyParagraph1}</p>
              <p>{about.storyParagraph2}</p>
              <p>{about.storyParagraph3}</p>
              <div className="mt-8 border-l-4 border-gold-500 pl-6 py-2">
                <Quote className="text-gold-500 mb-3" size={24} />
                <p className="text-xl font-display italic text-secondary-900">{about.storyQuote}</p>
                <p className="text-secondary-500 mt-3 text-sm">— {about.storyQuoteCredit}</p>
              </div>
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-24">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <AppImage
                  src={about.storyImageUrl}
                  alt={about.storyImageAlt}
                  width={900}
                  height={600}
                  className={`w-full ${about.storyImageFit === "contain" ? "object-contain" : "object-cover"}`}
                  style={{
                    maxHeight: "600px",
                    objectPosition: about.storyObjectPosition || "50% 20%",
                    transform: about.storyImageFlip ? "scaleX(-1)" : undefined,
                    scale: `${about.storyImageScale ?? 100}%`,
                  }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary-900/70 to-transparent p-6">
                  <p className="text-white font-semibold text-lg">{about.storyImageCaption}</p>
                  <p className="text-white/70 text-sm">{about.storyImageSubcaption}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="mission" className="py-16" style={{ backgroundColor: about.missionBackground, color: about.missionTextColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-2">{about.missionEyebrow}</p>
              <h2 className="text-3xl lg:text-4xl font-bold">{about.missionTitle}</h2>
              <p className="opacity-70 mt-4 max-w-2xl mx-auto text-lg">{about.missionBody}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {(about.missionCards?.length ? about.missionCards : DEFAULT_MISSION_CARDS).map((v, i) => (
                <div key={i} className="text-center bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                    {v.icon === "Heart" ? <Heart size={24} className="text-primary-500" /> :
                     v.icon === "Users" ? <Users size={24} className="text-primary-500" /> :
                     v.icon === "Globe" ? <Globe size={24} className="text-primary-500" /> :
                     <Sparkles size={24} className="text-primary-500" />}
                  </div>
                  <h3 className="font-semibold text-secondary-900">{v.title}</h3>
                  <p className="text-secondary-500 text-sm mt-2">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="culture" className="py-20" style={{ backgroundColor: about.cultureBackground, color: about.cultureTextColor }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-2">{about.cultureEyebrow}</p>
              <h2 className="text-3xl lg:text-4xl font-bold">{about.cultureTitle}</h2>
              <p className="opacity-70 mt-4 max-w-2xl mx-auto text-lg">{about.cultureBody}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {(about.cultureCards?.length ? about.cultureCards : DEFAULT_CULTURE_CARDS).map((c, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                  <div className="text-5xl mb-4">{c.emoji}</div>
                  <h3 className="text-white font-bold text-xl mb-3">{c.title}</h3>
                  <p className="text-white/60 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-14 border-t border-white/10 pt-12 text-center">
              <p className="text-2xl lg:text-3xl font-display italic text-gold-400 max-w-3xl mx-auto">&ldquo;{about.cultureCreed}&rdquo;</p>
              <p className="opacity-50 mt-4 text-sm">— {about.heroCredit}</p>
            </div>
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-secondary-900 mb-4">Connect With Us</h2>
          <p className="text-secondary-500 mb-8">Have a question, a custom design idea, or just want to say hello?</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="mailto:hello@your-store.example" className="btn-outline"><Mail size={20} className="mr-2" />hello@your-store.example</a>
            <a href="https://@yourstore" target="_blank" rel="noopener noreferrer" className="btn-outline"><InstagramIcon size={20} /><span className="ml-2">@yourstore</span></a>
          </div>
          <Link href="/shop" className="btn-gold mt-8 inline-flex">Shop the Collection</Link>
        </section>
      </div>
    </StorefrontLayout>
  );
}
