'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, BarChart3, Settings, Package, LogOut, TrendingUp, DollarSign, Eye } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const STATS = [
  { label: 'Total Revenue', value: '$0.00', icon: DollarSign, color: 'text-accent' },
  { label: 'Orders', value: '0', icon: ShoppingBag, color: 'text-brand' },
  { label: 'Products', value: '—', icon: Package, color: 'text-yellow-400' },
  { label: 'Store Views', value: '0', icon: Eye, color: 'text-blue-400' },
];

const QUICK_LINKS = [
  { href: '#', icon: Package, label: 'Manage Products', desc: 'Feature, hide, or reorder your catalog' },
  { href: '#', icon: ShoppingBag, label: 'View Orders', desc: 'Track fulfillment and order status' },
  { href: '#', icon: Settings, label: 'Brand Settings', desc: 'Logo, colors, SEO, social links' },
  { href: '#', icon: BarChart3, label: 'Analytics', desc: 'Traffic, conversions, revenue' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const db = getSupabase();
    if (!db) { router.replace('/login'); return; }
    db.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return; }
      setEmail(session.user.email ?? '');
      setChecking(false);
    });
  }, [router]);

  const handleSignOut = async () => {
    await getSupabase()?.auth.signOut();
    router.replace('/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-secondary">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen">
      {/* Dashboard header */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="font-black text-lg">
              <span className="text-white">Printify</span><span className="text-brand">Platform</span>
            </Link>
            <span className="text-text-secondary text-sm ml-3">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-sm hidden sm:block">{email}</span>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-text-secondary hover:text-white transition-colors text-sm">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-1">Welcome back 👋</h1>
          <p className="text-text-secondary">Your store is live. Here&apos;s what&apos;s happening.</p>
        </div>

        {/* Store live banner */}
        <div className="bg-accent/10 border border-accent/30 rounded-2xl px-6 py-4 flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
            <span className="font-semibold text-accent">Your store is live</span>
            <span className="font-mono text-sm text-text-secondary">yourshop.printifyplatform.com</span>
          </div>
          <a href="#" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline flex items-center gap-1">
            <Eye size={14} /> View Store
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {STATS.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-surface border border-border rounded-2xl p-5">
              <Icon size={18} className={`${color} mb-3`} />
              <div className="text-2xl font-black mb-0.5">{value}</div>
              <div className="text-text-secondary text-xs">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick links */}
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link key={label} href={href} className="bg-surface border border-border rounded-2xl p-6 flex items-start gap-4 hover:border-brand/50 transition-colors group">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0">
                <Icon size={18} className="text-brand" />
              </div>
              <div>
                <div className="font-semibold group-hover:text-brand transition-colors">{label}</div>
                <div className="text-text-secondary text-sm mt-0.5">{desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Upgrade nudge */}
        <div className="mt-10 bg-brand/5 border border-brand/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-brand" />
              <span className="font-semibold">You&apos;re on the free trial</span>
            </div>
            <p className="text-text-secondary text-sm">12 days remaining. Upgrade to keep your store live.</p>
          </div>
          <Link href="/pricing" className="bg-brand-gradient px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap">
            Upgrade Now
          </Link>
        </div>
      </div>
    </div>
  );
}
