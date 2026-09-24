"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Menu, X, Search, UserCircle } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useCustomerAuth } from "@/lib/customer-auth";
import { supabase } from "@/lib/supabase";
import { resolveStorageUrl } from "@/lib/storage";
import type { StoreSettings, Category } from "@/types";
import { DEFAULT_SITE_MENU_SETTINGS, type SiteMenuSettings } from "@/lib/site-menu-settings";
import AppImage from "@/components/AppImage";

export default function Header({ initialLogo }: { initialLogo?: { url: string | null; size: number } }) {
  const { itemCount, toggleCart } = useCart();
  const { user } = useCustomerAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Use server-supplied logo immediately, update when settings load client-side
  const logoUrl = settings?.logo_url ?? initialLogo?.url ?? null;
  const logoSize = settings?.logo_size ?? initialLogo?.size ?? 40;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearchOpen(false);
    setSearchQuery("");
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };
  const menuSettings: SiteMenuSettings = {
    ...DEFAULT_SITE_MENU_SETTINGS,
    ...((settings?.site_menu_settings as Partial<SiteMenuSettings> | null) || {}),
  };
  const menuCategories = menuSettings.categorySlugs.length ? categories.filter((category) => menuSettings.categorySlugs.includes(category.slug)) : categories;
  const menuTypography = {
    fontFamily: menuSettings.fontFamily === "display" ? "var(--font-display, Georgia, serif)" : "var(--font-sans, Inter, sans-serif)",
    fontSize: menuSettings.fontSize === "small" ? "14px" : menuSettings.fontSize === "large" ? "18px" : "16px",
    fontWeight: menuSettings.fontWeight === "semibold" ? 600 : menuSettings.fontWeight === "normal" ? 400 : 500,
    letterSpacing: menuSettings.letterSpacing === "wide" ? "0.08em" : menuSettings.letterSpacing === "relaxed" ? "0.025em" : "0",
  } as const;

  useEffect(() => {
    const fetchSettings = () =>
      supabase.from("settings").select("*").limit(1).maybeSingle().then(({ data }) => { if (data) setSettings(data as StoreSettings); });

    fetchSettings();
    supabase.from("categories").select("*").order("name").then(({ data }) => { if (data) setCategories(data as Category[]); });

    const channel = supabase
      .channel("header-settings")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, () => fetchSettings())
      .subscribe();

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      {settings?.announcement_active && settings?.announcement && (
        <div className="bg-secondary-900 text-white text-center py-2 px-4 text-sm font-medium">{settings.announcement}</div>
      )}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? "shadow-md" : "backdrop-blur-sm"}`} style={{ backgroundColor: menuSettings.backgroundColor, color: menuSettings.textColor }}>
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2" style={{ color: menuSettings.textColor }} aria-label="Open menu">
                <Menu size={24} />
              </button>
              <Link href="/" className="flex items-center gap-2">
                {logoUrl
                  ? <AppImage src={resolveStorageUrl(logoUrl)} alt={settings?.store_name || "Your Store"} width={240} height={80} style={{ height: `${logoSize}px`, width: "auto" }} />
                  : <AppImage src="/store-logo-placeholder.svg" alt="Your Store" width={240} height={80} style={{ height: `${logoSize}px`, width: "auto" }} />
                }
              </Link>
            </div>
              <nav className="hidden lg:flex items-center gap-8" style={menuTypography}>
              <Link href="/shop" className="transition-colors" style={{ color: menuSettings.textColor }}>All Products</Link>
              {menuCategories.slice(0, 5).map((cat) => (
                <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="transition-colors" style={{ color: menuSettings.textColor }}>{cat.name}</Link>
              ))}
              <Link href="/about" className="transition-colors" style={{ color: menuSettings.textColor }}>About</Link>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/account" className="hidden sm:flex items-center gap-1.5 text-sm font-medium transition-colors" style={{ color: menuSettings.textColor }}>
                <UserCircle size={20} />
                {user ? "My Account" : "Account"}
              </Link>
              {searchOpen ? (
                <form onSubmit={submitSearch} className="flex items-center gap-1">
                  <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="border border-secondary-300 rounded-lg px-3 py-1.5 text-sm text-secondary-900 w-40 sm:w-56 focus:outline-none focus:ring-2 focus:ring-gold-500" />
                  <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="p-2" style={{ color: menuSettings.textColor }}><X size={18} /></button>
                </form>
              ) : (
                <button onClick={() => setSearchOpen(true)} className="p-2 transition-colors" style={{ color: menuSettings.textColor }} aria-label="Search products"><Search size={22} /></button>
              )}
              <button onClick={toggleCart} className="relative p-2 transition-colors" style={{ color: menuSettings.textColor }} aria-label="Open cart">
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
          <div className="absolute left-0 top-0 bottom-0 w-72 shadow-xl animate-slide-in-right p-6 overflow-y-auto" style={{ backgroundColor: menuSettings.backgroundColor, color: menuSettings.textColor }}>
            <div className="flex items-center justify-between mb-8">
              <span className="font-display text-xl font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="p-2" style={{ color: menuSettings.textColor }}><X size={24} /></button>
            </div>
            <nav className="flex flex-col gap-4" style={menuTypography}>
              <Link href="/shop" onClick={() => setMobileOpen(false)} className="py-2" style={{ color: menuSettings.textColor }}>All Products</Link>
              {menuCategories.map((cat) => (
                <Link key={cat.id} href={`/shop?category=${cat.slug}`} onClick={() => setMobileOpen(false)} className="py-2" style={{ color: menuSettings.textColor }}>{cat.name}</Link>
              ))}
              <Link href="/about" onClick={() => setMobileOpen(false)} className="py-2" style={{ color: menuSettings.textColor }}>About</Link>
              <Link href="/account" onClick={() => setMobileOpen(false)} className="py-2" style={{ color: menuSettings.textColor }}>{user ? "My Account" : "Account"}</Link>
              <Link href="/admin" onClick={() => setMobileOpen(false)} className="py-2" style={{ color: menuSettings.textColor }}>Admin</Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
