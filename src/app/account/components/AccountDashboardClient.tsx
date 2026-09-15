"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, MapPin, Package, Phone, UserCircle } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import { formatAddress, getCustomerProfile, getOrderStage, ORDER_STEPS } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { formatPrice, supabase } from "@/lib/supabase";
import type { Order } from "@/types";

export function AccountDashboardClient() {
  const { user, loading } = useCustomerAuth();
  const profile = getCustomerProfile(user);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setOrdersLoading(true);
    supabase.from("orders").select("*").eq("email", user.email).order("created_at", { ascending: false }).limit(5).then(({ data }) => {
      setOrders((data || []) as Order[]);
      setOrdersLoading(false);
    });
  }, [user?.email]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading account...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired /></AccountShell>;

  const latestOrder = orders[0];
  const stage = latestOrder ? getOrderStage(latestOrder) : 0;

  return (
    <AccountShell>
      <div className="space-y-6">
        <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-gold-500 text-xs font-medium tracking-widest uppercase mb-2">My Account</p>
              <h1 className="text-3xl font-bold text-secondary-900">Welcome back, {profile.fullName.split(" ")[0]}</h1>
              <p className="text-secondary-500 mt-2">Track orders, manage contact details, and keep your preferences ready for checkout.</p>
            </div>
            <Link href="/shop" className="btn-gold">Shop new drops <ArrowRight size={18} className="ml-2" /></Link>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-secondary-100 rounded-lg p-5">
            <Package className="text-primary-500 mb-3" size={24} />
            <p className="text-2xl font-bold text-secondary-900">{orders.length}</p>
            <p className="text-sm text-secondary-500">Recent orders found</p>
          </div>
          <div className="bg-white border border-secondary-100 rounded-lg p-5">
            <Bell className="text-gold-500 mb-3" size={24} />
            <p className="text-2xl font-bold text-secondary-900">{profile.newsletterOptIn ? "On" : "Off"}</p>
            <p className="text-sm text-secondary-500">Newsletter updates</p>
          </div>
          <div className="bg-white border border-secondary-100 rounded-lg p-5">
            <Phone className="text-success-600 mb-3" size={24} />
            <p className="text-2xl font-bold text-secondary-900">{profile.preferences.preferredContact === "sms" ? "SMS" : "Email"}</p>
            <p className="text-sm text-secondary-500">Preferred contact</p>
          </div>
        </div>

        {latestOrder && (
          <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-secondary-900">Latest Order</h2>
                <p className="text-sm text-secondary-500">#{latestOrder.id.slice(-8).toUpperCase()} · {formatPrice(latestOrder.total)}</p>
              </div>
              <Link href={`/account/orders/${latestOrder.id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View details</Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {ORDER_STEPS.map((step, index) => (
                <div key={step} className={`rounded-lg border px-3 py-2 text-xs ${index <= stage ? "border-success-200 bg-success-50 text-success-700" : "border-secondary-100 bg-secondary-50 text-secondary-400"}`}>
                  {step}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-secondary-900">Recent Orders</h2>
              <Link href="/account/orders" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all</Link>
            </div>
            {ordersLoading ? (
              <p className="text-secondary-500">Loading orders...</p>
            ) : orders.length ? (
              <div className="space-y-3">
                {orders.slice(0, 3).map((order) => (
                  <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-secondary-100 p-3 hover:border-primary-200 hover:bg-primary-50/30 transition-colors">
                    <div>
                      <p className="font-medium text-secondary-900">#{order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-secondary-500">{new Date(order.created_at).toLocaleDateString()} · {order.status}</p>
                    </div>
                    <p className="font-semibold text-secondary-900">{formatPrice(order.total)}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-secondary-500">No orders are attached to {profile.email} yet.</p>
            )}
          </section>

          <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-secondary-900">Default Shipping</h2>
              <Link href="/account/addresses" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</Link>
            </div>
            <div className="flex gap-3">
              <MapPin size={22} className="text-primary-500 mt-0.5" />
              <div>
                <p className="font-medium text-secondary-900">{profile.address.name}</p>
                <p className="text-sm text-secondary-500">{formatAddress(profile.address)}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="bg-secondary-900 text-white rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <UserCircle size={24} className="text-gold-400" />
            <h2 className="text-xl font-bold">Account MVP note</h2>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            Profile, address, and preferences are stored in Supabase Auth metadata for this first pass. A future database migration can promote them into dedicated profile and address tables with row-level security.
          </p>
        </section>
      </div>
    </AccountShell>
  );
}

