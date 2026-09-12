import Link from "next/link";
import { Mail } from "lucide-react";
import NewsletterSignup from "@/components/NewsletterSignup";
import { createClient } from "@supabase/supabase-js";
import type { StoreSettings } from "@/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
function TikTokIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}
function FacebookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function YouTubeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" />
    </svg>
  );
}
function PinterestIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.65 7.86 6.39 9.29-.09-.78-.17-1.98.04-2.83.18-.77 1.22-5.17 1.22-5.17s-.31-.63-.31-1.56c0-1.46.85-2.55 1.9-2.55.9 0 1.33.67 1.33 1.48 0 .9-.58 2.26-.87 3.51-.25 1.05.52 1.9 1.54 1.9 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.34-4.23-2.96 0-4.69 2.22-4.69 4.51 0 .89.34 1.85.77 2.37.08.1.09.19.07.29-.08.32-.25 1.05-.28 1.19-.04.19-.14.23-.32.14-1.25-.58-2.03-2.42-2.03-3.89 0-3.15 2.29-6.05 6.61-6.05 3.47 0 6.16 2.47 6.16 5.77 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.97-.53-2.3-1.15l-.62 2.33c-.23.87-.84 1.96-1.25 2.62.94.29 1.94.45 2.97.45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  );
}
function SnapchatIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.02 2c-2.93 0-5.95 1.58-5.95 5.72v.64c-.42.19-.87.27-1.32.22-.1.36-.15.74-.13 1.1.37.1.76.13 1.14.08-.1.28-.15.57-.15.87 0 1.67 1.37 2.46 2.78 2.74-.17.28-.44.48-.76.55-.32.07-.65.02-.94-.14-.04.01-.08.02-.12.04.28.9 1.06 1.56 2.01 1.68.01 0 .02 0 .03.01-.44.34-.96.57-1.52.66-.18.03-.36.04-.54.04l-.06.01c-.02.01-.03.03-.02.05.27.44 1.27.76 2.68.88.07.1.1.22.08.34-.02.12-.08.22-.18.29-.34.22-.72.37-1.12.44-.15.03-.3.04-.45.04-.1 0-.19.06-.22.16-.03.1 0 .2.08.27.63.52 2.06.88 3.69.88s3.06-.36 3.69-.88c.08-.07.11-.17.08-.27-.03-.1-.12-.16-.22-.16-.15 0-.3-.01-.45-.04-.4-.07-.78-.22-1.12-.44-.1-.07-.16-.17-.18-.29-.02-.12.01-.24.08-.34 1.41-.12 2.41-.44 2.68-.88.01-.02 0-.04-.02-.05l-.06-.01c-.18 0-.36-.01-.54-.04-.56-.09-1.08-.32-1.52-.66.01 0 .02 0 .03-.01.95-.12 1.73-.78 2.01-1.68-.04-.02-.08-.03-.12-.04-.29.16-.62.21-.94.14-.32-.07-.59-.27-.76-.55 1.41-.28 2.78-1.07 2.78-2.74 0-.3-.05-.59-.15-.87.38.05.77.02 1.14-.08.02-.36-.03-.74-.13-1.1-.45.05-.9-.03-1.32-.22v-.64C17.97 3.58 14.95 2 12.02 2z" />
    </svg>
  );
}
function ThreadsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.474 12.01v-.017c.027-3.579.876-6.43 2.523-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.594 12c.022 3.086.713 5.496 2.051 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 9.13c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.005.215.012.321.02 1.144.075 2.169.42 2.962 1.002 1.005.731 1.659 1.853 1.934 3.255.55 2.794-.257 5.617-2.12 7.394C18.773 23.222 16.405 24 12.186 24z" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  youtube: YouTubeIcon,
  pinterest: PinterestIcon,
  snapchat: SnapchatIcon,
  threads: ThreadsIcon,
};

const DEFAULT_SOCIAL: StoreSettings["social_links"] = {
  instagram: { url: "https://instagram.com/genderapparel", enabled: true },
  tiktok:    { url: "https://tiktok.com/@genderapparel", enabled: true },
  facebook:  { url: "https://facebook.com/genderapparel", enabled: true },
  youtube:   { url: "https://youtube.com/@genderapparel", enabled: true },
  pinterest: { url: "https://pinterest.com/genderapparel", enabled: true },
  snapchat:  { url: "https://snapchat.com/add/genderapparel", enabled: true },
  threads:   { url: "https://threads.net/@genderapparel", enabled: true },
  email:     { url: "mailto:hello@genderapparel.example", enabled: true },
};

export default async function Footer() {
  const { data } = await supabase.from("settings").select("social_links, logo_url, logo_size, footer_logo_url, footer_logo_size, footer_text, footer_bottom_message").limit(1).maybeSingle();
  const social: StoreSettings["social_links"] = data?.social_links ?? DEFAULT_SOCIAL;
  const logoUrl = data?.footer_logo_url || data?.logo_url || "/genderapparel.png";
  const logoSize = data?.footer_logo_size ?? data?.logo_size ?? 40;
  const footerText = data?.footer_text || "Made-to-order apparel designed for every body, every style, and every day. Wear what feels like you.";
  const footerBottomMessage = data?.footer_bottom_message || "Made to order. Made with love.";

  return (
    <footer className="bg-secondary-900 text-secondary-300 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          <div className="col-span-1 md:col-span-2">
            <img src={logoUrl} alt="Gender Apparel" style={{ height: `${logoSize}px`, width: "auto" }} />
            <p className="mt-4 text-secondary-400 max-w-md">{footerText}</p>
            <div className="flex items-center gap-4 mt-6 flex-wrap">
              {(Object.keys(ICON_MAP) as Array<keyof typeof ICON_MAP>).map((key) => {
                const entry = social[key as keyof StoreSettings["social_links"]];
                if (!entry?.enabled || !entry.url) return null;
                const Icon = ICON_MAP[key];
                return (
                  <a key={key} href={entry.url} target={entry.url.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer" className="text-secondary-400 hover:text-white transition-colors" aria-label={key}>
                    <Icon size={22} />
                  </a>
                );
              })}
              {social.email?.enabled && social.email.url && (
                <a href={social.email.url} className="text-secondary-400 hover:text-white transition-colors" aria-label="Email">
                  <Mail size={22} />
                </a>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Shop</h4>
            <ul className="space-y-3">
              <li><Link href="/shop" className="hover:text-white transition-colors">All Products</Link></li>
              <li><Link href="/shop?category=t-shirts" className="hover:text-white transition-colors">T-Shirts</Link></li>
              <li><Link href="/shop?category=hoodies" className="hover:text-white transition-colors">Hoodies</Link></li>
              <li><Link href="/shop?category=hats" className="hover:text-white transition-colors">Hats</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Customer Care</h4>
            <ul className="space-y-3">
              <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund &amp; Returns</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><a href="mailto:hello@genderapparel.example" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Our Story</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/about#mission" className="hover:text-white transition-colors">Our Mission</Link></li>
              <li><Link href="/about#culture" className="hover:text-white transition-colors">The Culture</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-secondary-700 mt-12 pt-10">
          <NewsletterSignup variant="footer" />
        </div>
        <div className="border-t border-secondary-700 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-secondary-500">&copy; {new Date().getFullYear()} Gender Apparel. All rights reserved.</p>
          <p className="text-sm text-secondary-500">Powered by <a href="https://Atlascloudhosting.com" target="" rel="noopener noreferrer" className="hover:text-white transition-colors">Atlas Cloud Hosting</a>.</p>
          <p className="text-sm text-secondary-500">{footerBottomMessage}</p>
        </div>
      </div>
    </footer>
  );
}
