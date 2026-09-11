import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'PrintifyPlatform — Launch Your Branded Printify Store',
  description: 'The fastest way for Printify sellers to launch a real, branded ecommerce store. Stripe checkout, live catalog sync, admin dashboard — no code required.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://printifyplatform.com'),
  openGraph: {
    siteName: 'PrintifyPlatform',
    type: 'website',
    images: [{ url: '/og-image.png' }],
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
