"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, Check, Loader2, Truck } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getCustomerProfile } from "@/lib/account-data";
import { useCustomerAuth } from "@/lib/customer-auth";
import { formatPrice, createStripeCheckout, getShippingQuote } from "@/lib/supabase";
import type { CartItem } from "@/types";
import AppImage from "@/components/AppImage";

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useCustomerAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", address1: "", address2: "", city: "", state: "", zip: "", country: "US" });

  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingFallback, setShippingFallback] = useState(6.99);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("settings").select("default_shipping_cost").limit(1).maybeSingle().then(({ data }) => {
        if (data?.default_shipping_cost) setShippingFallback(Number(data.default_shipping_cost));
      });
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const profile = getCustomerProfile(user);
    const [firstName = "", ...lastNameParts] = profile.fullName.split(" ");
    setForm((prev) => ({
      ...prev,
      email: prev.email || profile.email,
      firstName: prev.firstName || firstName,
      lastName: prev.lastName || lastNameParts.join(" "),
      address1: prev.address1 || profile.address.line1,
      address2: prev.address2 || profile.address.line2 || "",
      city: prev.city || profile.address.city,
      state: prev.state || profile.address.state,
      zip: prev.zip || profile.address.zip,
      country: prev.country || profile.address.country,
    }));
  }, [user]);

  // Fetch real shipping quote whenever country changes
  useEffect(() => {
    if (!items.length) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setShippingLoading(true);
      const cost = await getShippingQuote({
        country: form.country,
        items: items.map((i: CartItem) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
      });
      setShippingCost(cost);
      setShippingLoading(false);
    }, 400);
  }, [form.country, items]);

  const resolvedShipping = shippingCost ?? shippingFallback;
  const total = subtotal + resolvedShipping;
  const updateForm = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    setLoading(true); setError(null);
    try {
      const result = await createStripeCheckout({
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          variant_id: i.variant_id,
          personalization_text: i.personalization_text || undefined,
        })),
        shipping_address: { line1: form.address1, line2: form.address2 || undefined, city: form.city, state: form.state, zip: form.zip, country: form.country },
        shipping_name: `${form.firstName} ${form.lastName}`,
        email: form.email,
        shipping_cost: resolvedShipping,
      });
      clearCart();
      window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold text-secondary-900">Your cart is empty</h1>
        <p className="text-secondary-500 mt-4">Add some items before checking out.</p>
        <Link href="/shop" className="btn-primary mt-8 inline-flex">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/shop" className="flex items-center gap-1 text-secondary-600 hover:text-secondary-900 mb-6 transition-colors"><ChevronLeft size={20} />Continue Shopping</Link>
      <h1 className="text-3xl font-bold text-secondary-900 mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Contact Information</h2>
            <input type="email" required placeholder="Email address" value={form.email} onChange={(e) => updateForm("email", e.target.value)} className="input-field" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Shipping Address</h2>
            <div className="grid grid-cols-2 gap-4">
              <input required placeholder="First name" value={form.firstName} onChange={(e) => updateForm("firstName", e.target.value)} className="input-field" />
              <input required placeholder="Last name" value={form.lastName} onChange={(e) => updateForm("lastName", e.target.value)} className="input-field" />
            </div>
            <input required placeholder="Address line 1" value={form.address1} onChange={(e) => updateForm("address1", e.target.value)} className="input-field mt-4" />
            <input placeholder="Address line 2 (optional)" value={form.address2} onChange={(e) => updateForm("address2", e.target.value)} className="input-field mt-4" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              <input required placeholder="City" value={form.city} onChange={(e) => updateForm("city", e.target.value)} className="input-field" />
              <input required placeholder="State" value={form.state} onChange={(e) => updateForm("state", e.target.value)} className="input-field" />
              <input required placeholder="ZIP code" value={form.zip} onChange={(e) => updateForm("zip", e.target.value)} className="input-field" />
            </div>
            <select value={form.country} onChange={(e) => updateForm("country", e.target.value)} className="input-field mt-4">
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </div>
          {error && <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-4 text-sm">{error}</div>}
          <button type="submit" disabled={loading || shippingLoading} className="btn-primary w-full">
            {loading ? <><Loader2 size={20} className="mr-2 animate-spin" />Processing...</> : <><Lock size={20} className="mr-2" />Pay {shippingLoading ? "..." : formatPrice(total)} with Stripe</>}
          </button>
          <p className="text-xs text-secondary-500 text-center">You will be redirected to Stripe&apos;s secure checkout to complete your payment.</p>
        </form>
        <div className="lg:pl-8">
          <div className="bg-secondary-50 rounded-2xl p-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-semibold text-secondary-900 mb-4">Order Summary</h2>
            <div className="space-y-4 max-h-64 overflow-y-auto">
              {items.map((item) => (
                <div key={`${item.product_id}-${item.variant_id}`} className="flex gap-3">
                  <AppImage src={item.image_url} alt={item.title} width={64} height={64} className="w-16 h-16 object-cover rounded-lg bg-white flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-secondary-900 truncate">{item.title}</p>
                    <p className="text-xs text-secondary-500">{item.variant_label}</p>
                    {item.personalization_text && <p className="text-xs text-primary-600 font-medium">✏️ {item.personalization_text}</p>}
                    <p className="text-xs text-secondary-500">Qty: {item.quantity}</p>
                  </div>
                  <span className="font-semibold text-sm text-secondary-900">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-secondary-200 mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-secondary-600"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between text-secondary-600">
                <span className="flex items-center gap-1"><Truck size={14} />Shipping</span>
                <span>
                  {shippingLoading
                    ? <span className="flex items-center gap-1 text-secondary-400"><Loader2 size={13} className="animate-spin" />Calculating...</span>
                    : shippingCost === null ? <span className="text-secondary-400 text-xs">Pending</span>
                    : resolvedShipping === 0 ? "Free" : formatPrice(resolvedShipping)}
                </span>
              </div>
              {shippingCost === 0 && <p className="text-xs text-success-600 flex items-center gap-1"><Check size={14} />Free shipping applied!</p>}
              <div className="flex justify-between text-lg font-bold text-secondary-900 pt-2 border-t border-secondary-200">
                <span>Total</span>
                <span>{shippingLoading ? <Loader2 size={16} className="animate-spin inline" /> : formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
