"use client";
import { AdminAuthProvider } from "@/lib/admin-auth";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
