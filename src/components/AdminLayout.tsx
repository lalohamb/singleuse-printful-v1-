"use client";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Package, ShoppingBag, Settings as SettingsIcon, LogOut, Menu, FolderTree, ExternalLink } from "lucide-react";
import { useAdminAuth } from "@/lib/admin-auth";

const navItems = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/products", label: "Products", icon: Package },
  { path: "/admin/categories", label: "Categories", icon: FolderTree },
  { path: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { path: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { admin, signOut } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); router.push("/admin"); };

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-secondary-900 text-white z-50 transition-transform flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 border-b border-secondary-700">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <span className="font-display text-xl font-bold">Body<span className="text-gold-500">&</span>Sleeves</span>
          </Link>
          <p className="text-secondary-400 text-xs mt-1">Admin Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-secondary-800 text-white font-medium" : "text-secondary-400 hover:bg-secondary-800 hover:text-white"}`}>
                <item.icon size={20} />{item.label}
              </Link>
            );
          })}
          <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-secondary-400 hover:bg-secondary-800 hover:text-white transition-colors"><ExternalLink size={20} />View Store</Link>
        </nav>
        <div className="p-4 border-t border-secondary-700">
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
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-secondary-100 sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-secondary-700"><Menu size={24} /></button>
            <h1 className="text-lg font-semibold text-secondary-900">{navItems.find((n) => pathname === n.path)?.label || "Admin"}</h1>
            <div className="w-8 lg:hidden" />
          </div>
        </header>
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
