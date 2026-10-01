"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import { useCustomerAuth } from "@/lib/customer-auth";
import { formatPrice, supabase } from "@/lib/supabase";
import type { Order } from "@/types";

export function OrdersClient() {
  const { user, loading } = useCustomerAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setOrdersLoading(true);
    supabase.from("orders").select("*").eq("email", user.email).order("created_at", { ascending: false }).then(({ data }) => {
      setOrders((data || []) as Order[]);
      setOrdersLoading(false);
    });
  }, [user?.email]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading orders...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired title="Sign in to view your orders" /></AccountShell>;

  return (
    <AccountShell>
      <section className="bg-white border border-secondary-100 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-secondary-100">
          <h1 className="text-2xl font-bold text-secondary-900">Order History</h1>
          <p className="text-secondary-500 mt-1">Orders linked to {user.email}</p>
        </div>
        {ordersLoading ? (
          <p className="p-6 text-secondary-500">Loading orders...</p>
        ) : orders.length ? (
          <div className="divide-y divide-secondary-100">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center justify-between gap-4 p-5 hover:bg-secondary-50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                    <Package size={22} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-secondary-900">#{order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-sm text-secondary-500 truncate">{new Date(order.created_at).toLocaleDateString()} · {order.items.length} {order.items.length === 1 ? "item" : "items"} · <span className={order.status === "cancelled" ? "text-error-600" : order.status === "shipped" || order.status === "delivered" ? "text-success-600" : "text-secondary-500"}>{order.fulfillment_status === "in-production" ? "In production" : order.tracking_number ? "Shipped" : order.status === "paid" && !order.printful_order_id ? "Awaiting approval" : order.status}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-secondary-900">{formatPrice(order.total)}</p>
                  <ChevronRight size={18} className="text-secondary-300" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <Package size={42} className="mx-auto text-secondary-200 mb-3" />
            <p className="font-semibold text-secondary-900">No orders found yet</p>
            <p className="text-sm text-secondary-500 mt-2">When you place an order with this email, it will appear here.</p>
            <Link href="/shop" className="btn-primary mt-6">Start shopping</Link>
          </div>
        )}
      </section>
    </AccountShell>
  );
}

