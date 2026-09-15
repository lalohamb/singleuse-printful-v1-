import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StorefrontClientShell from "@/components/StorefrontClientShell";
import { CustomerAuthProvider } from "@/lib/customer-auth";

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <CustomerAuthProvider>
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <StorefrontClientShell />
      </div>
    </CustomerAuthProvider>
  );
}
