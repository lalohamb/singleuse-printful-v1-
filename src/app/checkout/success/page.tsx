"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Package, Mail } from "lucide-react";
import { supabase, formatPrice } from "@/lib/supabase";
import type { Order } from "@/types";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    let attempts = 0;
    const poll = async () => {
      const { data } = await supabase.from("orders").select("*").eq("stripe_session_id", sessionId).maybeSingle();
      if (data) { setOrder(data as Order); setLoading(false); return; }
      attempts++;
      if (attempts < 6) setTimeout(poll, 1500);
      else setLoading(false);
    };
    poll();
  }, [sessionId]);

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-6"><CheckCircle size={48} className="text-success-500" /></div>
      <h1 className="text-3xl font-bold text-secondary-900">Order Confirmed!</h1>
      <p className="text-secondary-600 mt-4 text-lg">Thank you for your purchase. Your order has been received and is being processed.</p>
      {order && (
        <div className="bg-secondary-50 rounded-2xl p-6 mt-8 text-left">
          <div className="flex items-center gap-3 mb-4"><Package size={24} className="text-primary-500" /><h2 className="text-lg font-semibold text-secondary-900">Order Details</h2></div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Order ID</span><span className="font-medium text-secondary-900">#{order.id.slice(-8).toUpperCase()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Total</span><span className="font-medium text-secondary-900">{formatPrice(order.total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Items</span><span className="font-medium text-secondary-900">{order.items.length} {order.items.length === 1 ? "item" : "items"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-secondary-600">Ship to</span><span className="font-medium text-secondary-900">{order.shipping_name}</span></div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-2 text-secondary-500 mt-6"><Mail size={18} /><span>A confirmation email has been sent to your inbox.</span></div>
      <div className="flex flex-wrap gap-4 justify-center mt-8">
        <Link href="/shop" className="btn-primary">Continue Shopping</Link>
        <Link href="/" className="btn-outline">Back to Home</Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-secondary-300 border-t-secondary-900" /></div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
