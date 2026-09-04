"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Truck, Shield, Sparkles, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, StoreSettings, Category } from "@/types";
import ProductCard from "@/components/ProductCard";
import Reveal from "@/components/Reveal";
import { formatPrice } from "@/lib/supabase";

const AFFIRMATIONS = ["Empower Yourself", "Empower the Culture", "Wear Your Heritage", "Faith · Family · Culture", "Black-Owned & Made to Order"];

export default function HomeClient({ settings, featured, newArrivals, trending, categories, categoryImages }: {
  settings: StoreSettings | null;
  featured: Product[];
  newArrivals: Product[];
  trending: Product[];
  categories: Category[];
  categoryImages: Record<string, string>;
}) {
  const [slide, setSlide] = useState(0);
  const slideCount = newArrivals.length;
  const goSlide = (dir: number) => setSlide((s) => (s + dir + slideCount) % slideCount);

  return (
    <div>
      <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {/* LINE BELOW TO SET HERO IMAGE BACKGROUND TO FULL PIC>> :style={{ objectPosition: "100% " }} <<;END 09-04-2026*/}
          {/* https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-position*/ } 
          <img src={settings?.hero_image_url || "https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"} alt="Body and Sleeves apparel" className="w-full h-full object-cover" style={{ objectPosition: settings?.hero_object_position || "250px 25px" }} />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary-900/85 via-secondary-900/55 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-2xl animate-slide-up">
            <p className="text-gold-400 font-medium text-sm tracking-wider uppercase mb-4">{settings?.tagline || "Black-Owned. Made to Order."}</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">{settings?.hero_title || "Empower Yourself. Empower the Culture."}</h1>
            <p className="text-lg text-white/80 mt-6 max-w-lg">{settings?.hero_subtitle || "Apparel celebrating Black culture, faith, and family. Every design made with intention, printed on demand, shipped to your door."}</p>
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
            { icon: Heart, title: "Black-Owned", desc: "Built with love & purpose" },
            { icon: Shield, title: "Size Inclusive", desc: "Empowerment has no size limit" },
            { icon: Sparkles, title: "Culture First", desc: "Designed with intention" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3">
              <f.icon size={28} className="text-gold-400 flex-shrink-0" />
              <div><p className="font-semibold text-sm">{f.title}</p><p className="text-xs text-secondary-400">{f.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden className="bg-secondary-900 bg-weave text-white py-4 overflow-hidden border-y border-white/10">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center shrink-0">
              {AFFIRMATIONS.map((t, i) => (
                <span key={i} className="flex items-center">
                  <span className="mx-6 text-lg sm:text-2xl font-display font-semibold tracking-wide whitespace-nowrap">{t}</span>
                  <span className="text-gold-400 text-xl">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {slideCount > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">New Arrivals</h2>
              <p className="text-secondary-500 mt-2">Fresh designs just dropped</p>
            </div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <div className="relative overflow-hidden rounded-2xl bg-secondary-50">
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${slide * 100}%)` }}>
              {newArrivals.map((p) => (
                <div key={p.id} className="relative w-full flex-shrink-0">
                  <div className="h-[440px] sm:h-[640px] flex items-center justify-center p-2 sm:p-4">
                    <img src={p.image_url || ""} alt={p.title} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex justify-center pb-6">
                    <Link href={`/product/${p.id}`} className="btn-gold shadow-lg">View full product details <ArrowRight size={18} className="ml-2" /></Link>
                  </div>
                </div>
              ))}
            </div>
            {slideCount > 1 && (
              <>
                <button onClick={() => goSlide(-1)} aria-label="Previous new arrival" className="absolute left-3 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/90 shadow hover:bg-white text-secondary-900 transition-colors"><ChevronLeft size={22} /></button>
                <button onClick={() => goSlide(1)} aria-label="Next new arrival" className="absolute right-3 top-1/2 -translate-y-1/2 p-2 sm:p-3 rounded-full bg-white/90 shadow hover:bg-white text-secondary-900 transition-colors"><ChevronRight size={22} /></button>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {newArrivals.map((_, i) => (
                    <button key={i} onClick={() => setSlide(i)} aria-label={`Go to slide ${i + 1}`} className={`w-2.5 h-2.5 rounded-full transition-colors ${i === slide ? "bg-secondary-900" : "bg-secondary-300 hover:bg-secondary-400"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Shop by Category</h2>
          <p className="text-secondary-500 mt-3">Find your style across our curated collections</p>
        </div>
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="group relative aspect-square rounded-xl overflow-hidden bg-secondary-900 hover:shadow-xl hover:shadow-gold-500/10 transition-all">
                {categoryImages[cat.id] && (
                  <img src={categoryImages[cat.id]} alt={cat.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-secondary-900 via-secondary-900/30 to-transparent" />
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

      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Featured Picks</h2><p className="text-secondary-500 mt-2">Our most loved pieces this season</p></div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {featured.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </Reveal>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-2xl overflow-hidden bg-secondary-900 px-8 py-16 text-center">
          <div className="absolute inset-0 opacity-20">
            <img src={settings?.story_image_url || "https://images.pexels.com/photos/29646005/pexels-photo-29646005.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"} alt="" className="w-full h-full object-cover" />
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
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary-800">
                      <img src={p.image_url || ""} alt={p.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
