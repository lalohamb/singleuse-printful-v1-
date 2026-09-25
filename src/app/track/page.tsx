"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Package, Truck, CheckCircle, Clock, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
import { formatPrice } from "@/lib/supabase";
import AppImage from "@/components/AppImage";
import { getOrderStage, ORDER_STEPS } from "@/lib/account-data";
import type { Order } from "@/types";

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orderId, setOrderId] = useState(searchParams.get("order") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-lookup if params are pre-filled (from checkout success link)
  useEffect(() => {
    if (searchParams.get("order") && searchParams.get("email")) lookup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lookup = async () => {
    const id = orderId.trim().replace(/^#/, "").toUpperCase();
    const em = email.trim().toLowerCase();
    if (!id || !em) { setError("Please enter both your order ID and email address."); return; }
    setLoading(true); setError(null); setOrder(null);
    const res = await fetch(`/api/orders/track?order=${encodeURIComponent(id)}&email=${encodeURIComponent(em)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Order not found."); return; }
    setOrder(data.order as Order);
    router.replace(`/track?order=${id}&email=${encodeURIComponent(em)}`, { scroll: false });
  };

  const stage = order ? getOrderStage(order) : -1;
  const isCancelled = order?.status === "cancelled";
  const address = order?.shipping_address;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-secondary-500 hover:text-secondary-900 mb-6">
          <ArrowLeft size={16} />Back to store
        </Link>
        <h1 className="text-3xl font-bold text-secondary-900">Track Your Order</h1>
        <p className="text-secondary-500 mt-2">Enter your order ID and the email address used at checkout.</p>
      </div>

      {/* Lookup form */}
      <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="label-text">Order ID</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="e.g. A4CC6433"
            className="input-field font-mono"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <p className="text-xs text-secondary-400 mt-1">Found in your confirmation email — the 8-character code after the #</p>
        </div>
        <div>
          <label className="label-text">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-field"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-error-700 bg-error-50 border border-error-100 rounded-lg px-4 py-3">
            <XCircle size={16} className="flex-shrink-0" />{error}
          </div>
        )}
        <button onClick={lookup} disabled={loading} className="btn-primary w-full">
          {loading
            ? <><span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2" />Looking up...</>
            : <><Search size={18} className="mr-2" />Track Order</>}
        </button>
      </div>

      {/* Order result */}
      {order && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-sm text-secondary-500">Order #{order.id.slice(-8).toUpperCase()}</p>
                <h2 className="text-2xl font-bold text-secondary-900 mt-0.5 capitalize">
                  {isCancelled ? "Cancelled" : order.fulfillment_status === "shipped" || order.tracking_number ? "Shipped" : order.fulfillment_status === "in-production" ? "In Production" : order.status === "paid" ? "Confirmed" : order.status}
                </h2>
                <p className="text-secondary-500 text-sm mt-1">{new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
              <p className="text-2xl font-bold text-secondary-900">{formatPrice(order.total)}</p>
            </div>

            {/* Progress steps */}
            {isCancelled ? (
              <div className="flex items-center gap-2 text-sm text-error-700 bg-error-50 border border-error-100 rounded-lg px-4 py-3">
                <XCircle size={16} />This order has been cancelled.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ORDER_STEPS.filter((_, i) => [1, 2, 4, 5].includes(i)).map((step, i) => {
                  const stepIndex = [1, 2, 4, 5][i];
                  const active = stage >= stepIndex;
                  return (
                    <div key={step} className={`rounded-lg border px-3 py-2 text-xs text-center font-medium ${
                      active ? "border-success-200 bg-success-50 text-success-700" : "border-secondary-100 bg-secondary-50 text-secondary-400"
                    }`}>
                      {step}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tracking */}
          {order.tracking_number && (
            <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={20} className="text-primary-500" />
                <h3 className="font-semibold text-secondary-900">Tracking</h3>
              </div>
              <p className="text-sm text-secondary-500 mb-1">Tracking number</p>
              <p className="font-mono font-medium text-secondary-900">{order.tracking_number}</p>
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 inline-flex items-center gap-2 text-sm">
                  Track with carrier <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-secondary-100">
              <h3 className="font-semibold text-secondary-900 flex items-center gap-2"><Package size={18} className="text-primary-500" />Items</h3>
            </div>
            <div className="divide-y divide-secondary-50">
              {order.items.map((item, i) => (
                <div key={i} className="flex gap-4 p-5">
                  <AppImage src={item.image_url || "/product-placeholder.svg"} alt={item.title} width={64} height={64} className="w-16 h-16 rounded-lg object-cover bg-secondary-100 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-secondary-900">{item.title}</p>
                    <p className="text-sm text-secondary-500">{item.variant_label} · Qty {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-secondary-900 text-sm">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-secondary-100 space-y-1 text-sm">
              <div className="flex justify-between text-secondary-600"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
              <div className="flex justify-between text-secondary-600"><span>Shipping</span><span>{order.shipping_cost === 0 ? "Free" : formatPrice(order.shipping_cost)}</span></div>
              <div className="flex justify-between font-bold text-secondary-900 pt-1 border-t border-secondary-100"><span>Total</span><span>{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Ship to */}
          {address && (
            <div className="bg-white rounded-xl border border-secondary-100 shadow-sm p-6">
              <h3 className="font-semibold text-secondary-900 mb-3">Ship to</h3>
              <p className="font-medium text-secondary-900">{order.shipping_name}</p>
              <p className="text-sm text-secondary-500 mt-1">{address.line1}</p>
              {address.line2 && <p className="text-sm text-secondary-500">{address.line2}</p>}
              <p className="text-sm text-secondary-500">{address.city}, {address.state} {address.zip}</p>
            </div>
          )}

          {/* Help */}
          <div className="bg-secondary-900 text-white rounded-xl p-6">
            <h3 className="font-bold mb-2">Need help with this order?</h3>
            <p className="text-sm text-white/70 mb-4">Contact us with your order ID and we'll get back to you as soon as possible.</p>
            <Link href="/refund-policy" className="btn-gold text-sm inline-flex">View Refund Policy</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>}>
      <TrackContent />
    </Suspense>
  );
}
