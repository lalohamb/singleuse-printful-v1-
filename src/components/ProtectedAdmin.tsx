"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminAuth } from "@/lib/admin-auth";
import AdminLayout from "@/components/AdminLayout";

export default function ProtectedAdmin({ children }: { children: ReactNode }) {
  const { admin, loading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !admin && pathname !== "/admin/accept-invite") router.replace("/admin");
  }, [admin, loading, router, pathname]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-secondary-50">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" />
    </div>
  );

  if (!admin) return null;

  return <AdminLayout>{children}</AdminLayout>;
}
