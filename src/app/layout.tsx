import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";

export const metadata: Metadata = {
  title: { default: "Body & Sleeves", template: "%s | Body & Sleeves" },
  description: "A Black-owned, made-to-order apparel brand celebrating the richness of Black culture, faith, and family. Empower yourself. Empower the Culture.",
  openGraph: {
    siteName: "Body & Sleeves",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
