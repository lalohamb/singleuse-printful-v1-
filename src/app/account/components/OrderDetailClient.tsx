"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Package, Truck } from "lucide-react";
import { AccountShell, AuthRequired } from "@/app/account/components/AccountShell";
import AppImage from "@/components/AppImage";
import { getOrderStage, ORDER_STEPS } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { formatPrice, supabase } from "@/lib/supabase";
import type { Order } from "@/types";

export function OrderDetailClient({ orderId }: { orderId: string }) {
  const { user, loading } = useCustomerAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    supabase.from("orders").select("*").eq("id", orderId).eq("email", user.email).maybeSingle().then(({ data }) => {
      if (data) setOrder(data as Order);
      else setNotFound(true);
    });
  }, [orderId, user?.email]);

  if (loading) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading order...</div></AccountShell>;
  if (!user) return <AccountShell><AuthRequired title="Sign in to track this order" /></AccountShell>;
  if (notFound) {
    return (
      <AccountShell>
        <div className="bg-white border border-secondary-100 rounded-lg shadow-sm p-8 text-center">
          <Package size={42} className="mx-auto text-secondary-200 mb-3" />
          <h1 className="text-2xl font-bold text-secondary-900">Order not found</h1>
          <p className="text-secondary-500 mt-2">This order is not linked to {user.email}.</p>
          <Link href="/account/orders" className="btn-primary mt-6">Back to orders</Link>
        </div>
      </AccountShell>
    );
  }
  if (!order) return <AccountShell><div className="bg-white rounded-lg border border-secondary-100 p-8 text-secondary-500">Loading order...</div></AccountShell>;

  const stage = getOrderStage(order);
  const address = order.shipping_address;

  return (
    <AccountShell>
      <div className="space-y-6">
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-900">
          <ArrowLeft size={16} />
          Back to orders
        </Link>

        <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-secondary-500">Order #{order.id.slice(-8).toUpperCase()}</p>
              <h1 className="text-3xl font-bold text-secondary-900 mt-1">{order.status.replace(/-/g, " ")}</h1>
              <p className="text-secondary-500 mt-2">{new Date(order.created_at).toLocaleString()}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-secondary-500">Order total</p>
              <p className="text-2xl font-bold text-secondary-900">{formatPrice(order.total)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-6">
            {ORDER_STEPS.map((step, index) => (
              <div key={step} className={`rounded-lg border px-3 py-2 text-xs ${index <= stage ? "border-success-200 bg-success-50 text-success-700" : "border-secondary-100 bg-secondary-50 text-secondary-400"}`}>
                {step}
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-secondary-100 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-secondary-100">
              <h2 className="text-xl font-bold text-secondary-900">Items</h2>
            </div>
            <div className="divide-y divide-secondary-100">
              {order.items.map((item) => (
                <div key={`${item.product_id}-${item.variant_id}`} className="flex gap-4 p-5">
                  <AppImage src={item.image_url || "/product-placeholder.svg"} alt={item.title} width={72} height={72} className="w-20 h-20 rounded-lg object-cover bg-secondary-100 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary-900">{item.title}</p>
                    <p className="text-sm text-secondary-500">{item.variant_label} · Qty {item.quantity}</p>
                    {item.personalization_text && <p className="text-sm text-primary-600 mt-1">{item.personalization_text}</p>}
                  </div>
                  <p className="font-semibold text-secondary-900">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck size={20} className="text-primary-500" />
                <h2 className="font-bold text-secondary-900">Tracking</h2>
              </div>
              {order.tracking_number ? (
                <div className="space-y-2">
                  <p className="text-sm text-secondary-500">Tracking number</p>
                  <p className="font-medium text-secondary-900 break-all">{order.tracking_number}</p>
                  {order.tracking_url && (
                    <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="btn-outline w-full mt-3 text-sm">
                      Open tracking <ExternalLink size={15} className="ml-2" />
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-secondary-500">Tracking will appear here once the order ships.</p>
              )}
            </section>

            <section className="bg-white border border-secondary-100 rounded-lg shadow-sm p-5">
              <h2 className="font-bold text-secondary-900 mb-3">Ship to</h2>
              <p className="font-medium text-secondary-900">{order.shipping_name}</p>
              <p className="text-sm text-secondary-500 mt-1">{address.line1}</p>
              {address.line2 && <p className="text-sm text-secondary-500">{address.line2}</p>}
              <p className="text-sm text-secondary-500">{address.city}, {address.state} {address.zip}</p>
              <p className="text-sm text-secondary-500">{address.country}</p>
            </section>

            <section className="bg-secondary-900 text-white rounded-lg p-5">
              <h2 className="font-bold">Need help?</h2>
              <p className="text-sm text-white/70 mt-2">Contact support with your order number for returns, size questions, or delivery issues.</p>
              <Link href="/refund-policy" className="btn-gold w-full mt-4 text-sm">View policy</Link>
            </section>
          </aside>
        </div>
      </div>
    </AccountShell>
  );
}
