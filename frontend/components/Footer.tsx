import Link from 'next/link';
import { Twitter, Instagram, Youtube } from 'lucide-react';

const LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/privacy', label: 'Documentation' },
  { href: '/demo', label: 'Demo' },
  { href: '/blog', label: 'Blog' },
  { href: '/login', label: 'Login' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface mt-24">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-xs">
            <div className="font-black text-xl mb-3">
              <span className="text-white">Printify</span>
              <span className="text-brand">Platform</span>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              The storefront layer for Printify sellers.
            </p>
            <div className="flex gap-4 mt-5 text-text-secondary">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Twitter size={18} /></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Instagram size={18} /></a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Youtube size={18} /></a>
            </div>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-text-secondary">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-border mt-12 pt-6 text-center text-xs text-text-secondary">
          © {new Date().getFullYear()} PrintifyPlatform. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
