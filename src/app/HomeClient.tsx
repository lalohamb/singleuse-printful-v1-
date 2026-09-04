"use client";
import Link from "next/link";
import { ArrowRight, Truck, Shield, Sparkles, Heart } from "lucide-react";
import type { Product, StoreSettings, Category } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function HomeClient({ settings, featured, newArrivals, trending, categories }: {
  settings: StoreSettings | null;
  featured: Product[];
  newArrivals: Product[];
  trending: Product[];
  categories: Category[];
}) {

  return (
    <div>
      <section className="relative h-[70vh] min-h-[500px] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.pexels.com/photos/858117/pexels-photo-858117.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" alt="Body and Sleeves apparel" className="w-full h-full object-cover" style={{ objectPosition: "70% top" }} />
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Shop by Category</h2>
          <p className="text-secondary-500 mt-3">Find your style across our curated collections</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="group relative aspect-square rounded-xl overflow-hidden bg-secondary-100 hover:shadow-lg transition-shadow">
              <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-semibold text-lg group-hover:text-gold-400 transition-colors">{cat.name}</h3>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Featured Picks</h2><p className="text-secondary-500 mt-2">Our most loved pieces this season</p></div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="bg-secondary-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div><h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">New Arrivals</h2><p className="text-secondary-500 mt-2">Fresh designs just dropped</p></div>
              <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {newArrivals.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-8">
            <div><h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">Trending Now</h2><p className="text-secondary-500 mt-2">What everyone's wearing</p></div>
            <Link href="/shop" className="hidden sm:flex items-center gap-2 text-secondary-700 hover:text-primary-600 font-medium transition-colors">View All <ArrowRight size={18} /></Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {trending.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="relative rounded-2xl overflow-hidden bg-secondary-900 px-8 py-16 text-center">
          <div className="absolute inset-0 opacity-20">
            <img src="https://images.pexels.com/photos/29646005/pexels-photo-29646005.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative">
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">Wear Your Story</h2>
            <p className="text-white/70 text-lg max-w-xl mx-auto mb-8">Every piece is a celebration. Every design tells a story. Empower yourself. Empower the Culture.</p>
            <Link href="/shop" className="btn-gold">Explore Full Collection <ArrowRight size={20} className="ml-2" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
