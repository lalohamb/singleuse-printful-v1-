"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, MapPin, Package, Settings, UserCircle } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth";
import { getCustomerProfile } from "@/lib/account-data";

const accountNav = [
  { href: "/account", label: "Dashboard", icon: Home },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/profile", label: "Profile", icon: UserCircle },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/preferences", label: "Preferences", icon: Settings },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, signOut } = useCustomerAuth();
  const profile = user ? getCustomerProfile(user) : null;
  const displayName = loading ? "Loading account" : profile?.fullName || "Guest account";
  const displayEmail = loading ? "Checking session" : profile?.email || "Sign in to continue";
  const avatarInitial = profile?.fullName.slice(0, 1).toUpperCase() || <UserCircle size={20} />;

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="bg-secondary-50 min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-72 flex-shrink-0">
            <div className="bg-white border border-secondary-100 rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-3 pb-5 border-b border-secondary-100">
                <div className="w-11 h-11 rounded-full bg-secondary-900 text-white flex items-center justify-center font-semibold">
                  {avatarInitial}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-secondary-900 truncate">{displayName}</p>
                  <p className="text-sm text-secondary-500 truncate">{displayEmail}</p>
                </div>
              </div>
              <nav className="py-3 space-y-1">
                {accountNav.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-secondary-900 text-white" : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
                      }`}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              {user && (
                <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-secondary-500 hover:bg-error-50 hover:text-error-600 transition-colors">
                  <LogOut size={18} />
                  Sign out
                </button>
              )}
            </div>
          </aside>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function AuthRequired({ title = "Sign in to view your account" }: { title?: string }) {
  return (
    <div className="bg-white border border-secondary-100 rounded-lg shadow-sm p-8 text-center">
      <UserCircle size={42} className="mx-auto text-secondary-300 mb-4" />
      <h1 className="text-2xl font-bold text-secondary-900">{title}</h1>
      <p className="text-secondary-500 mt-3 max-w-md mx-auto">
        Use your email to access order tracking, saved addresses, and account preferences.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/account/login" className="btn-primary">Sign in</Link>
        <Link href="/account/signup" className="btn-outline">Create account</Link>
      </div>
    </div>
  );
}
