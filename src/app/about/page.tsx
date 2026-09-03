import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Sparkles, Users, Globe, Mail, Quote } from "lucide-react";

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

export const metadata: Metadata = {
  title: "Our Story",
  description: "Learn about Body & Sleeves — a Black-owned, made-to-order apparel brand founded by Demetria, celebrating Black culture, faith, and family.",
};

export default function AboutPage() {
  return (
    <StorefrontLayout>
      <div>
        <section className="min-h-[70vh] flex flex-col lg:flex-row">
          <div className="flex-1 bg-secondary-900 flex items-center px-8 sm:px-12 lg:px-16 py-16">
            <div>
              <p className="text-gold-400 uppercase tracking-widest text-sm font-semibold mb-4">Black-Owned · Made to Order</p>
              <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight">Our Story</h1>
              <p className="text-lg text-white/70 mt-6 max-w-md leading-relaxed">Empower yourself. Empower the Culture.</p>
              <div className="mt-8 border-l-4 border-gold-500 pl-5">
                <p className="text-white/80 italic">&ldquo;Some things are meant to find you.&rdquo;</p>
                <p className="text-secondary-400 text-sm mt-2">— Demetria, Founder</p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-[45%] h-72 lg:h-auto relative overflow-hidden">
            <img src="/deeandlalo1.png" alt="Dee and Lalo" className="w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary-900/40 to-transparent" />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div className="space-y-6 text-secondary-700 leading-relaxed text-lg order-2 lg:order-1">
              <p>Body &amp; Sleeves started with a name my husband held onto for years, a domain he purchased with a vision he never quite got around to. When I retired and felt that familiar pull to create, that name was sitting there waiting for me. It felt like it had always been mine.</p>
              <p>My name is <strong className="text-secondary-900">Demetria</strong>, the heart and hands behind Body &amp; Sleeves. After decades of building a life rooted in faith, family, and community, retirement gave me something I had not expected: time to pour into something that was entirely my own.</p>
              <p>What drives me is simple. I believe what you wear can speak before you ever open your mouth. A statement piece carries weight. It can reflect who you are, what you stand for, where your faith lies, and what movement you belong to. Clothing is not just fabric. It is voice.</p>
              <p>At Body &amp; Sleeves, you will find empowerment tees, faith-inspired pieces, and bold statement apparel designed to make you feel something when you put them on. Every design is made with intention.</p>
              <div className="mt-8 border-l-4 border-gold-500 pl-6 py-2">
                <Quote className="text-gold-500 mb-3" size={24} />
                <p className="text-xl font-display italic text-secondary-900">Welcome to Body &amp; Sleeves. Empower yourself. Empower the Culture.</p>
                <p className="text-secondary-500 mt-3 text-sm">— Demetria, Founder</p>
              </div>
            </div>
            <div className="order-1 lg:order-2 lg:sticky lg:top-24">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img src="/deeandlalo1.png" alt="Dee and Lalo" className="w-full object-cover object-top" style={{ maxHeight: "600px" }} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-secondary-900/70 to-transparent p-6">
                  <p className="text-white font-semibold text-lg">Dee &amp; Lalo</p>
                  <p className="text-white/70 text-sm">Founders, Body &amp; Sleeves</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-secondary-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-secondary-900">What We Stand For</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { icon: Heart, title: "Black Culture", desc: "Celebrating who we are, where we come from, and where we're going." },
                { icon: Sparkles, title: "Faith", desc: "Designs rooted in scripture and spiritual conviction." },
                { icon: Users, title: "Family", desc: "The aunties, the uncles, the mothers, the community that carries us." },
                { icon: Globe, title: "Freedom", desc: "Honoring Juneteenth and the ongoing journey toward liberation." },
                { icon: Sparkles, title: "Excellence", desc: "Made-to-order quality, every single time." },
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

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl lg:text-3xl font-bold text-secondary-900 mb-4">Connect With Us</h2>
          <p className="text-secondary-500 mb-8">Have a question, a custom design idea, or just want to say hello?</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="mailto:Hello.BodyandSleeves@gmail.com" className="btn-outline"><Mail size={20} className="mr-2" />Hello.BodyandSleeves@gmail.com</a>
            <a href="https://instagram.com/body_and_sleeves" target="_blank" rel="noopener noreferrer" className="btn-outline"><InstagramIcon size={20} /><span className="ml-2">@body_and_sleeves</span></a>
          </div>
          <Link href="/shop" className="btn-gold mt-8 inline-flex">Shop the Collection</Link>
        </section>
      </div>
    </StorefrontLayout>
  );
}
