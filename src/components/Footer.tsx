import Link from "next/link";
import { Mail } from "lucide-react";

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="bg-secondary-900 text-secondary-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <span className="font-display text-3xl font-bold text-white">Body<span className="text-gold-500">&amp;</span>Sleeves</span>
            <p className="mt-4 text-secondary-400 max-w-md">A Black-owned, made-to-order apparel brand celebrating the richness of Black culture, faith, and family. Empower yourself. Empower the Culture.</p>
            <div className="flex items-center gap-4 mt-6">
              <a href="https://instagram.com/body_and_sleeves" target="_blank" rel="noopener noreferrer" className="text-secondary-400 hover:text-white transition-colors" aria-label="Instagram"><InstagramIcon size={22} /></a>
              <a href="mailto:Hello.BodyandSleeves@gmail.com" className="text-secondary-400 hover:text-white transition-colors" aria-label="Email"><Mail size={22} /></a>
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              <li><Link href="/shop" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link href="/shop?category=t-shirts" className="hover:text-white transition-colors">T-Shirts</Link></li>
              <li><Link href="/shop?category=hoodies" className="hover:text-white transition-colors">Hoodies</Link></li>
              <li><Link href="/shop?category=hats" className="hover:text-white transition-colors">Hats</Link></li>
              <li><Link href="/shop?category=sweatpants" className="hover:text-white transition-colors">Sweatpants</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="hover:text-white transition-colors">Our Story</Link></li>
              <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund &amp; Returns</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/admin" className="hover:text-white transition-colors">Admin Portal</Link></li>
              <li><a href="mailto:Hello.BodyandSleeves@gmail.com" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-secondary-700 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-secondary-500">&copy; {new Date().getFullYear()} Body &amp; Sleeves. All rights reserved.</p>
          <p className="text-sm text-secondary-500">Made to order. Made with love.</p>
        </div>
      </div>
    </footer>
  );
}
