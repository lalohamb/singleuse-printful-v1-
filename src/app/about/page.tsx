import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Sparkles, Users, Globe, Mail, Quote } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_ABOUT_SETTINGS, type AboutSettings } from "@/lib/about-settings";

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

export const metadata: Metadata = {
  title: "Our Story",
  description: "Learn about Gender Apparel, a made-to-order clothing brand designed for every body, every style, and every day.",
};

export default async function AboutPage() {
  const { data } = await supabase.from("settings").select("about_settings").limit(1).maybeSingle();
  const about = { ...DEFAULT_ABOUT_SETTINGS, ...((data?.about_settings || {}) as Partial<AboutSettings>) };

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
            <img src={about.heroImageUrl} alt={about.storyImageAlt} className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/40 to-transparent" />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div className="space-y-6 text-secondary-700 leading-relaxed text-lg order-2 lg:order-1">
              <p>Gender Apparel began with a simple idea: clothing should help you feel more like yourself, not less. We create considered pieces that make room for different bodies, different styles, and different ways of showing up.</p>
              <p>What drives us is simple. What you wear can speak before you ever open your mouth. A statement piece can reflect who you are, what you stand for, and how you want to move through the world. Clothing is not just fabric. It is voice.</p>
              <p>At Gender Apparel, you will find expressive everyday pieces designed to make you feel something when you put them on. Every design is made with intention and printed to order.</p>
              <div className="mt-8 border-l-4 border-gold-500 pl-6 py-2">
                <Quote className="text-gold-500 mb-3" size={24} />
                <p className="text-xl font-display italic text-secondary-900">Welcome to Gender Apparel. Wear what feels like you.</p>
                <p className="text-secondary-500 mt-3 text-sm">— The Gender Apparel Team</p>
              </div>
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-24">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img src={about.storyImageUrl} alt={about.storyImageAlt} className="w-full object-cover object-top" style={{ maxHeight: "600px" }} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary-900/70 to-transparent p-6">
                  <p className="text-white font-semibold text-lg">Dee &amp; Lalo</p>
                  <p className="text-white/70 text-sm">Gender Apparel</p>
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
              {[
                { icon: Heart, title: "Self-Expression", desc: "Clothing that gives your point of view room to speak." },
                { icon: Sparkles, title: "Thoughtful Design", desc: "Details created with intention, not noise." },
                { icon: Users, title: "Every Body", desc: "A more welcoming approach to fit and personal style." },
                { icon: Globe, title: "Less Waste", desc: "Made to order so every piece has a purpose." },
                { icon: Sparkles, title: "Everyday Quality", desc: "Comfort and character in every drop." },
              ].map((v) => (
                <div key={v.title} className="text-center bg-white rounded-xl p-6 shadow-sm">
                  <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4"><v.icon size={24} className="text-primary-500" /></div>
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
              {[
                { emoji: "✊🏾", title: "Black Excellence", desc: "Every design is a declaration. We wear our heritage with pride, not apology." },
                { emoji: "🙏🏾", title: "Faith-Driven", desc: "Rooted in scripture and spiritual conviction — because what you believe shapes what you wear." },
                { emoji: "🌍", title: "Community First", desc: "From the aunties to the block — we design for the people who show up for each other." },
              ].map((c) => (
                <div key={c.title} className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
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
            <a href="mailto:hello@genderapparel.example" className="btn-outline"><Mail size={20} className="mr-2" />hello@genderapparel.example</a>
            <a href="https://instagram.com/body_and_sleeves" target="_blank" rel="noopener noreferrer" className="btn-outline"><InstagramIcon size={20} /><span className="ml-2">@body_and_sleeves</span></a>
          </div>
          <Link href="/shop" className="btn-gold mt-8 inline-flex">Shop the Collection</Link>
        </section>
      </div>
    </StorefrontLayout>
  );
}
