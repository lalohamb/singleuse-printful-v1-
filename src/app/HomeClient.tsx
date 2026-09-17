"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Truck, Shield, Sparkles, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, StoreSettings, Category } from "@/types";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import NewsletterSignup from "@/components/NewsletterSignup";
import PromoBanner from "@/components/PromoBanner";
import AppImage from "@/components/AppImage";
import { formatPrice } from "@/lib/supabase";
import { DEFAULT_AFFIRMATIONS_SETTINGS, type AffirmationsSettings } from "@/lib/affirmations-settings";
import { DEFAULT_NEW_ARRIVALS_SETTINGS, type NewArrivalsSettings } from "@/lib/new-arrivals-settings";
import { DEFAULT_BRAND_VALUES_SETTINGS, type BrandValuesSettings } from "@/lib/brand-values-settings";

export default function HomeClient({ settings, featured, newArrivals, trending, categories, categoryImages }: {
  settings: StoreSettings | null;
  featured: Product[];
  newArrivals: Product[];
  trending: Product[];
  categories: Category[];
  categoryImages: Record<string, string>;
}) {
  const [slide, setSlide] = useState(0);
  const affirmations = { ...DEFAULT_AFFIRMATIONS_SETTINGS, ...((settings?.affirmations_settings || {}) as Partial<AffirmationsSettings>) };
  const newArrivalsSettings = { ...DEFAULT_NEW_ARRIVALS_SETTINGS, ...((settings?.new_arrivals_settings || {}) as Partial<NewArrivalsSettings>) };
  const brandValues = { ...DEFAULT_BRAND_VALUES_SETTINGS, ...((settings?.brand_values_settings || {}) as Partial<BrandValuesSettings>) };
  const slideCount = newArrivals.length;
  const goSlide = (dir: number) => setSlide((s) => (s + dir + slideCount) % slideCount);

  return (
    <div>
      <PromoBanner settings={settings} />
      <section className="relative flex items-center overflow-hidden" style={{ height: `${settings?.hero_height_vh ?? 70}vh`, minHeight: 500 }}>
        <div className="absolute inset-0 bg-secondary-900">
          {/* LINE BELOW TO SET HERO IMAGE BACKGROUND TO FULL PIC>> :style={{ objectPosition: "100% " }} <<;END 09-04-2026*/}
          {/* https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-position*/ } 
          <AppImage fill src={settings?.hero_image_url || "/hero-placeholder.svg"} alt="Store hero image" className={`absolute inset-0 w-full h-full ${settings?.hero_image_fit === "contain" ? "object-contain" : (settings?.hero_image_scale ?? 100) === 100 ? "object-cover" : "object-contain"}`} style={{ objectPosition: settings?.hero_object_position || "center", transform: settings?.hero_image_flip ? "scaleX(-1)" : undefined, scale: `${settings?.hero_image_scale ?? 100}%` }} />
          {(() => {
            const op = (settings?.hero_gradient_opacity ?? 70) / 100;
            const dir = settings?.hero_gradient_dir ?? "left";
            if (dir === "none") return null;
            const gradMap: Record<string, string> = {
              left: `linear-gradient(to right, rgba(17,17,17,${op * 0.85}) 0%, rgba(17,17,17,${op * 0.55}) 50%, transparent 100%)`,
              right: `linear-gradient(to left, rgba(17,17,17,${op * 0.85}) 0%, rgba(17,17,17,${op * 0.55}) 50%, transparent 100%)`,
              center: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.5}) 0%, rgba(17,17,17,${op * 0.85}) 50%, rgba(17,17,17,${op * 0.5}) 100%)`,
              top: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.85}) 0%, transparent 100%)`,
              bottom: `linear-gradient(to top, rgba(17,17,17,${op * 0.85}) 0%, transparent 100%)`,
              full: `rgba(17,17,17,${op * 0.85})`,
            };
            return <div className="absolute inset-0" style={{ background: gradMap[dir] }} />;
          })()}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl animate-slide-up">
            <p className="text-gold-400 font-medium text-sm tracking-wider uppercase mb-4">{settings?.tagline || "Made for Every Body."}</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">{settings?.hero_title || "Wear What Feels Like You."}</h1>
            <p className="text-lg text-white/80 mt-6 max-w-lg">{settings?.hero_subtitle || "Thoughtful apparel designed for every body, every style, and every day. Made to order and shipped to your door."}</p>
            <div className="flex flex-wrap gap-4 mt-8">
              <Link href="/shop" className="btn-gold">Shop Collection <ArrowRight size={20} className="ml-2" /></Link>
              <Link href="/about" className="btn-outline border-white text-white hover:bg-white hover:text-secondary-900">Our Story</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Truck, title: "Made to Order", desc: "Printed fresh for you" },
            { icon: Heart, title: "Made With Intention", desc: "Built for real life" },
            { icon: Shield, title: "Size Inclusive", desc: "Empowerment has no size limit" },
            { icon: Sparkles, title: "Style Without Limits", desc: "Designed for self-expression" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <f.icon size={28} className="text-gold-400 flex-shrink-0" />
              <div><p className="font-semibold text-sm">{f.title}</p><p className="text-xs text-secondary-400">{f.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      {affirmations.active && affirmations.phrases.length > 0 && <section aria-hidden className="bg-weave text-white py-4 overflow-hidden border-y border-white/10" style={{ backgroundColor: affirmations.backgroundColor, color: affirmations.textColor }}>
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center shrink-0">
              {affirmations.phrases.map((t, i) => (
                <span key={i} className="flex items-center">
                  <span className="mx-6 text-lg sm:text-2xl font-display font-semibold tracking-wide whitespace-nowrap">{t}</span>
                  <span className="text-xl" style={{ color: affirmations.accentColor }}>✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>}

 <section className="w-full pt-0 pb-16 px-1">
        <div className="text-center mb-2">
          {/* <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Shop by Category</h2> */}
          <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Find your style across our curated collections</h2>
          {/* <p className="text-secondary-500 mt-3">Find your style across our curated collections</p> */}
        </div>
        <Reveal>
          <div className="flex overflow-x-auto scrollbar-hide gap-1">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="group relative flex-1 min-w-[140px] aspect-square overflow-hidden bg-secondary-900 hover:shadow-xl hover:shadow-gold-500/10 transition-all">
                {(cat.category_image_url || categoryImages[cat.id]) && (
                  <AppImage fill src={cat.category_image_url || categoryImages[cat.id]} alt={cat.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                )}
                {(() => {
                  const op = ((cat.gradient_opacity ?? 60) / 100);
                  const dir = cat.gradient_dir ?? "bottom";
                  const gradMap: Record<string, string> = {
                    bottom: `linear-gradient(to top, rgba(17,17,17,${op * 0.9}) 0%, rgba(17,17,17,${op * 0.3}) 60%, transparent 100%)`,
                    top:    `linear-gradient(to bottom, rgba(17,17,17,${op * 0.9}) 0%, transparent 100%)`,
                    full:   `rgba(17,17,17,${op * 0.85})`,
                    none:   `transparent`,
                  };
                  if (dir === "none") return null;
                  return <div className="absolute inset-0" style={{ background: gradMap[dir] }} />;
                })()}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-display font-bold text-lg leading-tight">{cat.name}</h3>
                  <span className="inline-block mt-1 text-gold-400 text-xs font-medium opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">Shop now →</span>
                </div>
                <div className="kente-bar absolute bottom-0 left-0 right-0 h-1" />
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {slideCount > 0 && (
        <section className="relative w-full overflow-hidden" style={{ minHeight: 600, backgroundColor: newArrivalsSettings.backgroundColor, color: newArrivalsSettings.textColor }}>
          {/* background image layer */}
          <div className="absolute inset-0 transition-opacity duration-700">
            <AppImage fill src={newArrivals[slide]?.image_url || ""} alt="" className="w-full h-full object-cover opacity-20 blur-sm scale-105" />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary-900 via-secondary-900/90 to-secondary-900/40" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-0 min-h-[600px]">
            {/* left — editorial text */}
            <div className="flex-1 py-16 lg:py-24 flex flex-col justify-center z-10">
              <div className="flex items-center gap-3 mb-6">
                {newArrivalsSettings.showAccent && <div className="kente-bar h-0.5 w-12 rounded-full" style={{ backgroundColor: newArrivalsSettings.accentColor }} />}
                <span className="text-xs font-medium tracking-[0.25em] uppercase" style={{ color: newArrivalsSettings.accentColor }}>{newArrivalsSettings.dropLabel} {String(slide + 1).padStart(2, "0")} / {String(slideCount).padStart(2, "0")}</span>
              </div>
              <p className="text-white/40 text-xs tracking-widest uppercase mb-3">{newArrivalsSettings.eyebrow}</p>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-none mb-6">{newArrivals[slide]?.title}</h2>
              <p className="text-2xl font-semibold mb-8" style={{ color: newArrivalsSettings.accentColor }}>{formatPrice(newArrivals[slide]?.price)}</p>
              <div className="flex items-center gap-4">
                <Link href={`/product/${newArrivals[slide]?.id}`} className="btn-gold">{newArrivalsSettings.shopButtonLabel} <ArrowRight size={18} className="ml-2" /></Link>
                <Link href="/shop" className="text-white/60 hover:text-white text-sm font-medium transition-colors">{newArrivalsSettings.viewAllLabel} →</Link>
              </div>
              {slideCount > 1 && (
                <div className="flex items-center gap-6 mt-12">
                  <button onClick={() => goSlide(-1)} aria-label="Previous" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group">
                    <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs tracking-widest uppercase">Prev</span>
                  </button>
                  <div className="flex gap-2">
                    {newArrivals.map((_, i) => (
                      <button key={i} onClick={() => setSlide(i)} className={`transition-all duration-300 rounded-full ${i === slide ? "w-8 h-1.5 bg-gold-400" : "w-1.5 h-1.5 bg-white/30 hover:bg-white/60"}`} />
                    ))}
                  </div>
                  <button onClick={() => goSlide(1)} aria-label="Next" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors group">
                    <span className="text-xs tracking-widest uppercase">Next</span>
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>

            {/* right — product image */}
            <div className="relative w-full lg:w-[480px] flex-shrink-0 flex items-end justify-center pt-8 lg:pt-0" style={{ minHeight: 500 }}>
              <AppImage
                key={slide}
                src={newArrivals[slide]?.image_url || ""}
                alt={newArrivals[slide]?.title}
                width={520}
                height={520}
                className="relative z-10 max-h-[520px] w-auto object-contain drop-shadow-2xl animate-slide-up"
              />
            </div>
          </div>
        </section>
      )}

     

      {/* D — Brand Values Band */}
      <Reveal>
        <section className={`bg-weave text-white ${brandValues.advanced ? brandValues.padding === "compact" ? "py-8" : brandValues.padding === "comfortable" ? "py-12" : "py-16" : "py-16"}`} style={{ backgroundColor: brandValues.backgroundColor, color: brandValues.textColor, backgroundImage: brandValues.advanced && brandValues.backgroundImage ? `linear-gradient(rgba(17,17,17,0.55), rgba(17,17,17,0.55)), url(${brandValues.backgroundImage})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`grid grid-cols-1 ${brandValues.advanced && brandValues.columns === 4 ? "md:grid-cols-4" : brandValues.advanced && brandValues.columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} gap-0 ${brandValues.advanced && brandValues.divider === "vertical" ? "md:divide-x" : brandValues.advanced && brandValues.divider === "horizontal" ? "divide-y" : ""}`} style={{ ...(brandValues.advanced ? { borderColor: brandValues.dividerColor } : {}) }}>
              {brandValues.values.filter((v) => !brandValues.advanced || v.enabled !== false).map((v, index) => (
                <div key={`${v.stat}-${index}`} className={`flex flex-col px-8 py-10 ${brandValues.advanced && brandValues.alignment === "left" ? "items-start text-left" : "items-center text-center"} ${brandValues.advanced && brandValues.animate ? "animate-slide-up" : ""}`} style={{ backgroundColor: brandValues.advanced ? brandValues.cardBackgroundColor : undefined, borderColor: brandValues.advanced ? brandValues.cardBorderColor : undefined }}>
                  {brandValues.advanced && v.icon && <span className="text-3xl mb-3" aria-hidden>{v.icon}</span>}
                  <span className="text-5xl lg:text-6xl font-display font-bold mb-3" style={{ color: brandValues.accentColor }}>{v.stat}</span>
                  <p className="font-semibold text-lg text-white mb-1">{v.label}</p>
                  <p className="text-secondary-400 text-sm max-w-xs">{v.sub}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="kente-bar h-1 mt-8" />
        </section>
      </Reveal>

      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Featured Picks</h2><p className="text-secondary-500 mt-2">Our most loved pieces this season</p></div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <Reveal>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </Reveal>
        </section>
      )}

      {/* A — Our Why Split Panel */}
      <Reveal>
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-secondary-900 px-10 py-16 flex flex-col justify-center">
              <div className="kente-bar h-1 w-24 mb-8 rounded-full" />
              <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-4">{settings?.our_why_label || "Our Why"}</p>
              <h2 className="text-3xl lg:text-5xl font-bold text-white leading-tight mb-6">&ldquo;{settings?.our_why_quote || "We don\u2019t just sell clothes. We tell stories."}&rdquo;</h2>
              <p className="text-white/60 text-lg leading-relaxed mb-8">{settings?.our_why_body || "Your store was created for people who want clothing that feels personal, expressive, and easy to live in. Every design is made with intention and every piece is printed to order."}</p>
              <Link href="/about" className="btn-gold self-start">Read Our Story <ArrowRight size={18} className="ml-2" /></Link>
            </div>
            <div className="relative min-h-[400px] bg-secondary-800" style={{ minHeight: settings?.our_why_height_vh ? `${settings.our_why_height_vh}px` : 400 }}>
              {(() => {
                const hasOwn = !!settings?.our_why_image_url;
                const src = hasOwn ? settings!.our_why_image_url! : (settings?.hero_image_url || "https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940");
                const scale = hasOwn ? (settings?.our_why_image_scale ?? 100) : 100;
                const pos = hasOwn ? (settings?.our_why_object_position || "center") : "center";
                const flip = hasOwn ? !!settings?.our_why_image_flip : false;
                const fit = hasOwn ? (settings?.our_why_image_fit ?? "cover") : "cover";
                return <AppImage fill src={src} alt="Our story" className={`absolute inset-0 w-full h-full ${fit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: pos, transform: flip ? "scaleX(-1)" : undefined, scale: `${scale}%` }} />;
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/60 to-transparent" />
            </div>
          </div>
        </section>
      </Reveal>

      {/* B — Social Proof / Reviews */}
      <Reveal>
        <section className="bg-secondary-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <p className="text-gold-500 text-sm font-medium tracking-widest uppercase mb-2">Customer Love</p>
              <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">What the Culture is Saying</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(settings?.testimonials ?? [
                { quote: "I wore my shirt to a family reunion and got so many compliments. This brand truly gets us.", name: "Jasmine T.", location: "Atlanta, GA", product: "Culture First Tee" },
                { quote: "The quality is unmatched. Soft, true to size, and the design is everything. Will be ordering again.", name: "Marcus W.", location: "Houston, TX", product: "Faith Over Fear Hoodie" },
                { quote: "Finally a brand that celebrates who we are. Every piece feels intentional and powerful.", name: "Aaliyah R.", location: "Chicago, IL", product: "Heritage Collection" },
              ]).map((r) => (
                <div key={r.name} className="bg-white rounded-2xl p-8 shadow-sm border border-secondary-100 flex flex-col">
                  <div className="flex gap-1 mb-4">{[...Array(5)].map((_, i) => <span key={i} className="text-gold-400 text-lg">★</span>)}</div>
                  <p className="text-secondary-700 leading-relaxed flex-1 mb-6">&ldquo;{r.quote}&rdquo;</p>
                  <div className="border-t border-secondary-100 pt-4">
                    <p className="font-semibold text-secondary-900">{r.name}</p>
                    <p className="text-xs text-secondary-400">{r.location} &middot; {r.product}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <NewsletterSignup />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-2xl overflow-hidden bg-secondary-900 px-8 py-16 text-center">
          <div className="absolute inset-0">
            {(() => {
              const src = settings?.story_image_url || "https://images.pexels.com/photos/29646005/pexels-photo-29646005.jpeg?auto=compress&cs=tinysrgb&h=650&w=940";
              const op = (settings?.story_gradient_opacity ?? 40) / 100;
              const dir = settings?.story_gradient_dir ?? "full";
              const gradMap: Record<string, string> = {
                left:   `linear-gradient(to right, rgba(17,17,17,${op * 0.85}) 0%, rgba(17,17,17,${op * 0.55}) 50%, transparent 100%)`,
                right:  `linear-gradient(to left, rgba(17,17,17,${op * 0.85}) 0%, rgba(17,17,17,${op * 0.55}) 50%, transparent 100%)`,
                center: `linear-gradient(to bottom, rgba(17,17,17,${op * 0.5}) 0%, rgba(17,17,17,${op * 0.85}) 50%, rgba(17,17,17,${op * 0.5}) 100%)`,
                top:    `linear-gradient(to bottom, rgba(17,17,17,${op * 0.85}) 0%, transparent 100%)`,
                bottom: `linear-gradient(to top, rgba(17,17,17,${op * 0.85}) 0%, transparent 100%)`,
                full:   `rgba(17,17,17,${op * 0.85})`,
                none:   `transparent`,
              };
              return (
                <>
                  <AppImage fill src={src} alt="" className={`w-full h-full ${settings?.story_image_fit === "contain" ? "object-contain" : "object-cover"}`} style={{ objectPosition: settings?.story_object_position || "center", transform: settings?.story_image_flip ? "scaleX(-1)" : undefined, scale: `${settings?.story_image_scale ?? 100}%` }} />
                  {dir !== "none" && <div className="absolute inset-0" style={{ background: gradMap[dir] }} />}
                </>
              );
            })()}
          </div>
          <div className="relative">
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">Wear Your Story</h2>
            <p className="text-white/70 text-lg max-w-xl mx-auto mb-8">Every piece is a celebration. Every design tells a story. Empower yourself. Empower the Culture.</p>
            <Link href="/shop" className="btn-gold">Explore Full Collection <ArrowRight size={20} className="ml-2" /></Link>
          </div>
        </div>
      </section>

      {trending.length > 0 && (
        <section className="bg-secondary-900 bg-weave text-white py-14 overflow-hidden -mb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 flex items-center justify-between">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white">Trending Now</h2>
              <p className="text-secondary-400 mt-2">What everyone&apos;s wearing</p>
            </div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-gold-400 hover:text-gold-300 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <div className="flex gap-8 w-max animate-marquee pause-hover pl-8">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex gap-8 shrink-0">
                {trending.map((p, i) => (
                  <Link key={`${dup}-${p.id}`} href={`/product/${p.id}`} className="group relative w-56 sm:w-64 shrink-0">
                    <span className="absolute -top-6 -left-3 z-10 text-7xl font-display font-bold text-transparent [-webkit-text-stroke:2px_#d4af37] select-none pointer-events-none">{i + 1}</span>
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary-800">
                      <AppImage fill src={p.image_url || ""} alt={p.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <p className="mt-3 font-medium text-white truncate">{p.title}</p>
                    <p className="text-gold-400 text-sm">{formatPrice(p.price)}</p>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
