'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { BarChart3, Users, Server, Activity, Download, Settings, LogOut } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const NAV = [
  { href: '/platform-admin', icon: BarChart3, label: 'Overview' },
  { href: '/platform-admin/merchants', icon: Users, label: 'Merchants' },
  { href: '/platform-admin/instances', icon: Server, label: 'Instances' },
  { href: '/platform-admin/provisioning', icon: Activity, label: 'Provisioning' },
  { href: '/platform-admin/downloads', icon: Download, label: 'Downloads' },
];

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const db = getSupabase();
    if (!db) { router.replace('/login'); return; }
    db.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      // Check platform_admins table
      const { data } = await db.from('platform_admins').select('id').eq('auth_user_id', session.user.id).single();
      if (!data) { router.replace('/dashboard'); return; }
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen flex">
      <aside className="w-56 border-r border-border bg-surface flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="font-black text-base">
            <span className="text-white">Platform</span><span className="text-brand"> Admin</span>
          </div>
          <div className="text-xs text-text-secondary mt-0.5">Super Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === href || (href !== '/platform-admin' && pathname.startsWith(href))
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors">
            ← Merchant Dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
