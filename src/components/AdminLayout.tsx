"use client";
import { type ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, LogOut, Menu, FolderTree, ExternalLink, Mail, CreditCard, Send, Search, Truck, Image, FileText, AlertTriangle, Palette, Home, Users, PanelBottom, Plug, Share2, Megaphone, Store, Sparkles, BarChart3, Heart, BookOpen, MessageCircle, Link2, DollarSign } from "lucide-react";
import { useAdminAuth } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import { resolveStorageUrl } from "@/lib/storage";
import AppImage from "@/components/AppImage";

const navItems = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/categories", label: "Categories", icon: FolderTree },
  { path: "/admin/orders", label: "Orders - Printify", icon: ShoppingBag },
  { path: "/admin/customers", label: "Customers", icon: Users },
  { path: "/admin/affiliates", label: "Affiliates", icon: Link2 },
  { path: "/admin/affiliates/payouts", label: "Affiliate Payouts", icon: DollarSign },
  { path: "/admin/email", label: "Email - Resend", icon: Mail },
  { path: "/admin/stripe", label: "Stripe - Payments", icon: CreditCard },
  { path: "/admin/mailerlite", label: "MailerLite", icon: Send },
  { path: "/admin/seo", label: "SEO", icon: Search },
  { path: "/admin/shipping", label: "Shipping", icon: Truck },
  { path: "/admin/media", label: "Media", icon: Image },
  { path: "/admin/policies", label: "Policies", icon: FileText },
];

const settingsItems = [
  { path: "/admin/settings/store-information", label: "Store Information", icon: Store },
  { path: "/admin/settings/announcements", label: "Announcements", icon: Megaphone },
  { path: "/admin/settings/newsletter-popup", label: "Newsletter Popup", icon: Mail },
  { path: "/admin/settings/branding", label: "Branding", icon: Palette },
  { path: "/admin/settings/admin-menu", label: "Menu Bar", icon: Menu },
  { path: "/admin/settings/homepage-hero", label: "Homepage Hero", icon: Home },
  { path: "/admin/settings/feature-strip", label: "Feature Strip", icon: Sparkles },
  { path: "/admin/settings/new-arrivals", label: "New Arrivals", icon: Sparkles },
  { path: "/admin/settings/brand-values", label: "Brand Values", icon: BarChart3 },
  { path: "/admin/settings/our-why", label: "Our Why", icon: Heart },
  { path: "/admin/settings/customer-love", label: "Customer Love", icon: MessageCircle },
  { path: "/admin/settings/wear-your-story", label: "Wear Your Story", icon: BookOpen },
  { path: "/admin/settings/about-hero",    label: "About — Hero",    icon: Users },
  { path: "/admin/settings/about-story",   label: "About — Story",   icon: Users },
  { path: "/admin/settings/about-mission", label: "About — Mission", icon: Users },
  { path: "/admin/settings/about-culture", label: "About — Culture", icon: Users },
  { path: "/admin/settings/footer", label: "Footer", icon: PanelBottom },
  { path: "/admin/settings/integrations", label: "Integrations", icon: Plug },
  { path: "/admin/settings/social", label: "Social Links", icon: Share2 },
  { path: "/admin/danger", label: "Danger Zone", icon: AlertTriangle },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stripeMode, setStripeMode] = useState<"live" | "test" | null>(null);
  const [ordersPaused, setOrdersPaused] = useState<boolean | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("settings").select("store_name, logo_url").limit(1).maybeSingle().then(({ data }) => {
      if (data?.store_name) setStoreName(data.store_name);
      // Only use logo_url if it's a real uploaded URL, not a default placeholder
      const url = data?.logo_url;
      if (url && !url.includes("store-logo-placeholder") && !url.includes("logo.png")) setLogoUrl(resolveStorageUrl(url));
    });
  }, []);

  useEffect(() => {
    const fetchStripeMode = () =>
      fetch("/api/stripe-mode", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((d) => {
        if (d?.active_mode) setStripeMode(d.active_mode);
      }).catch(() => {});

    fetchStripeMode();

    const onVisible = () => { if (document.visibilityState === "visible") fetchStripeMode(); };
    const onModeChanged = (e: Event) => setStripeMode((e as CustomEvent).detail);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("stripe-mode-changed", onModeChanged);
    const fetchPaused = () =>
      import("@/lib/supabase").then(({ supabase }) =>
        supabase.from("settings").select("orders_paused").limit(1).maybeSingle().then(({ data }) => {
          if (data) setOrdersPaused(!!data.orders_paused);
        })
      );

    fetchPaused();
    const interval = setInterval(fetchPaused, 3000);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("stripe-mode-changed", onModeChanged); };
  }, []);

  const handleSignOut = async () => { await signOut(); router.push("/admin"); };

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-secondary-900 text-white z-50 transition-transform flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-secondary-700 flex-shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            {logoUrl
              ? <AppImage src={logoUrl} alt={storeName || "Admin"} width={160} height={40} style={{ height: "28px", width: "auto" }} />
              : <span className="font-display text-xl font-bold">{storeName || "Admin"}</span>}
          </Link>
          <p className="text-secondary-400 text-xs mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 min-h-0 p-3 space-y-0.5 overflow-y-auto overscroll-contain scrollbar-hide">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                isActive ? "bg-secondary-800 text-white font-medium" : "text-secondary-400 hover:bg-secondary-800 hover:text-white"
              }`}>
                <item.icon size={20} />
                <span className="flex-1">{item.label}</span>
                {item.path === "/admin/stripe" && stripeMode && (
                  <span className={`text-[10px] font-semibold ${
                    stripeMode === "live" ? "text-green-400" : "text-amber-400"
                  }`}>{stripeMode === "live" ? "LIVE" : "TEST"}</span>
                )}
                {item.path === "/admin/dashboard" && ordersPaused !== null && (
                  <span className={`text-[10px] font-semibold ${
                    ordersPaused ? "text-red-400" : "text-green-400"
                  }`}>{ordersPaused ? "PAUSED" : "OPEN"}</span>
                )}
              </Link>
            );
          })}
          <div className="flex items-center gap-3 px-3 py-2 mt-2 text-sm font-semibold text-secondary-300"><span>Settings</span></div>
          <div className="ml-4 mb-2 border-l border-secondary-700 pl-2 space-y-0.5">
            {settingsItems.map((item) => {
              const active = pathname === item.path;
              const isDanger = item.path === "/admin/danger";
              if (isDanger) return (
                <div key={item.path} className="pt-3 mt-1 border-t border-secondary-700">
                  <Link href={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${active ? "bg-red-900/60 text-red-300" : "text-red-500 hover:text-red-300 hover:bg-red-900/40"}`}>
                    <item.icon size={14} /><span>{item.label}</span>
                  </Link>
                </div>
              );
              return <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${active ? "bg-secondary-800 text-white" : "text-secondary-500 hover:text-white hover:bg-secondary-800"}`}><item.icon size={14} /><span>{item.label}</span></Link>;
            })}
          </div>
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-400 hover:bg-secondary-800 hover:text-white transition-colors"><ExternalLink size={18} />View Store</a>
          <a href="https://bulk-pod-product-creator.com/?blog_post=how_to_create_POD_products_via_the_printify_API" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-secondary-400 hover:bg-secondary-800 hover:text-white transition-colors"><ExternalLink size={18} />Bulk Product</a>
        </nav>
        <div className="p-4 border-t border-secondary-700 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gold-500 flex items-center justify-center text-secondary-900 font-bold text-sm">{admin?.email?.[0]?.toUpperCase() || "A"}</div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{admin?.email || "Admin"}</p>
              <p className="text-xs text-secondary-500 capitalize">{admin?.role || "admin"}</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-secondary-400 hover:bg-secondary-800 hover:text-white transition-colors w-full"><LogOut size={20} />Sign Out</button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-secondary-900/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        <header className="bg-white border-b border-secondary-100 sticky top-0 z-30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-secondary-700"><Menu size={24} /></button>
            <h1 className={`text-lg font-semibold ${pathname === "/admin/danger" ? "text-red-600" : "text-secondary-900"}`}>{navItems.find((n) => pathname === n.path)?.label || settingsItems.find((n) => pathname === n.path)?.label || "Admin"}</h1>
            {pathname === "/admin/dashboard" && ordersPaused !== null && (
              <span className={`text-sm font-semibold ${ordersPaused ? "text-red-500" : "text-green-500"}`}>
                {ordersPaused ? "orders paused" : "orders open"}
              </span>
            )}
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
