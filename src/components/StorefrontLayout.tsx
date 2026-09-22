import type { ReactNode } from "react";
import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StorefrontClientShell from "@/components/StorefrontClientShell";
import AffiliateTracker from "@/components/AffiliateTracker";
import { CustomerAuthProvider } from "@/lib/customer-auth";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <CustomerAuthProvider>
        <Suspense fallback={null}><AffiliateTracker /></Suspense>
        <Header />
        <main className="flex-1">{children}</main>
        <StorefrontClientShell />
      </CustomerAuthProvider>
      <Footer />
    </div>
  );
}
