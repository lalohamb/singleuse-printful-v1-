"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Menu, X, Search } from "lucide-react";
import { useCart } from "@/lib/cart";
import { supabase } from "@/lib/supabase";
import type { StoreSettings, Category } from "@/types";

export default function Header() {
  const { itemCount, toggleCart } = useCart();
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => { if (data) setSettings(data as StoreSettings); });
    supabase.from("categories").select("*").order("name").then(({ data }) => { if (data) setCategories(data as Category[]); });
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {settings?.announcement_active && settings?.announcement && (
        <div className="bg-secondary-900 text-white text-center py-2 px-4 text-sm font-medium">{settings.announcement}</div>
      )}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "bg-white shadow-md" : "bg-white/95 backdrop-blur-sm"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-4">
              <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 text-secondary-700 hover:text-secondary-900" aria-label="Open menu">
                <Menu size={24} />
              </button>
              <Link href="/" className="flex items-center gap-2">
                {settings?.logo_url ? (
                  <img src={settings.logo_url} alt={settings.store_name || "Body & Sleeves"} style={{ height: `${settings.logo_size ?? 40}px`, width: "auto" }} />
                ) : (
                  <img src="/logo.png" alt="Body & Sleeves" style={{ height: `${settings?.logo_size ?? 40}px`, width: "auto" }} />
                )}
              </Link>
            </div>
            <nav className="hidden lg:flex items-center gap-8">
              <Link href="/shop" className="text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors">All Products</Link>
              {categories.slice(0, 5).map((cat) => (
                <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors">{cat.name}</Link>
              ))}
              <Link href="/about" className="text-sm font-medium text-secondary-700 hover:text-secondary-900 transition-colors">About</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={() => router.push("/shop")} className="p-2 text-secondary-700 hover:text-secondary-900 transition-colors" aria-label="Search products"><Search size={22} /></button>
              <button onClick={toggleCart} className="relative p-2 text-secondary-700 hover:text-secondary-900 transition-colors" aria-label="Open cart">
                <ShoppingBag size={22} />
                {itemCount > 0 && <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-fade-in">{itemCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </header>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-secondary-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl animate-slide-in-right p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <span className="font-display text-xl font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2"><X size={24} /></button>
            </div>
            <nav className="flex flex-col gap-4">
              <Link href="/shop" onClick={() => setMobileOpen(false)} className="text-base font-medium text-secondary-700 hover:text-secondary-900 py-2">All Products</Link>
              {categories.map((cat) => (
                <Link key={cat.id} href={`/shop?category=${cat.slug}`} onClick={() => setMobileOpen(false)} className="text-base font-medium text-secondary-700 hover:text-secondary-900 py-2">{cat.name}</Link>
              ))}
              <Link href="/about" onClick={() => setMobileOpen(false)} className="text-base font-medium text-secondary-700 hover:text-secondary-900 py-2">About</Link>
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="text-base font-medium text-secondary-700 hover:text-secondary-900 py-2">Admin</Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
