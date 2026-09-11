'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/demo', label: 'Demo' },
  { href: '/blog', label: 'Blog' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-black text-xl tracking-tight">
          <span className="text-white">Printify</span>
          <span className="text-brand">Platform</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-text-secondary">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-text-secondary hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold bg-brand-gradient px-5 py-2 rounded-full hover:opacity-90 transition-opacity animate-glow-pulse"
          >
            Launch My Store →
          </Link>
        </div>

        <button className="md:hidden p-2 text-text-secondary" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-bg px-6 py-4 flex flex-col gap-4 text-sm font-medium">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-text-secondary hover:text-white transition-colors">
              {l.label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="text-text-secondary hover:text-white transition-colors">Log in</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="bg-brand-gradient text-center py-2.5 rounded-full font-semibold">
            Launch My Store →
          </Link>
        </div>
      )}
    </header>
  );
}
