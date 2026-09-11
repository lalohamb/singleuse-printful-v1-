'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Store, CreditCard, Download, HelpCircle, LogOut } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { href: '/dashboard/store', icon: Store, label: 'Store' },
  { href: '/dashboard/billing', icon: CreditCard, label: 'Billing' },
  { href: '/dashboard/download', icon: Download, label: 'Downloads' },
  { href: '/dashboard/support', icon: HelpCircle, label: 'Support' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const db = getSupabase();
    if (!db) { router.replace('/login'); return; }
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      setEmail(session.user.email ?? '');
      setChecking(false);
    });
  }, [router]);

  const signOut = async () => {
    await getSupabase()?.auth.signOut();
    router.replace('/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-surface flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <Link href="/" className="font-black text-base">
            <span className="text-white">Printify</span><span className="text-brand">Platform</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-text-secondary truncate px-3 mb-2">{email}</div>
          <button onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors w-full">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
