"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, Plus, Minus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/supabase";

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQuantity, removeFromCart, subtotal, itemCount } = useCart();
  const pathname = usePathname();
  const router = useRouter();

  const handleContinueShopping = () => {
    if (pathname === "/checkout") {
      router.push("/shop");
    }
    closeCart();
  };

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-secondary-900/50 backdrop-blur-sm animate-fade-in" onClick={closeCart} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-secondary-100">
          <div className="flex items-center gap-2">
            <ShoppingBag size={24} className="text-secondary-900" />
            <h2 className="text-lg font-bold text-secondary-900">Cart {itemCount > 0 && `(${itemCount})`}</h2>
          </div>
          <button onClick={closeCart} className="p-2 text-secondary-500 hover:text-secondary-900 transition-colors"><X size={24} /></button>
        </div>
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 rounded-full bg-secondary-50 flex items-center justify-center mb-4"><ShoppingBag size={36} className="text-secondary-300" /></div>
            <p className="text-secondary-500 text-lg font-medium">Your cart is empty</p>
            <p className="text-secondary-400 text-sm mt-1 text-center">Browse our collection and find something that speaks to you.</p>
            <Link href="/shop" onClick={closeCart} className="btn-primary mt-6">Start Shopping</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.map((item) => (
                <div key={`${item.product_id}-${item.variant_id}`} className="flex gap-4 pb-4 border-b border-secondary-100 last:border-0">
                  <img src={item.image_url} alt={item.title} className="w-20 h-20 object-cover rounded-lg bg-secondary-50 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-secondary-900 break-words">{item.title}</p>
                        <p className="text-sm text-secondary-500 break-words">{item.variant_label}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.product_id, item.variant_id)} className="text-secondary-400 hover:text-error-500 transition-colors p-1" aria-label="Remove item"><Trash2 size={18} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-secondary-200 rounded-lg">
                        <button onClick={() => updateQuantity(item.product_id, item.variant_id, item.quantity - 1)} className="p-1.5 text-secondary-600 hover:text-secondary-900" aria-label="Decrease quantity"><Minus size={16} /></button>
                        <span className="px-3 text-sm font-medium min-w-[2rem] text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product_id, item.variant_id, item.quantity + 1)} className="p-1.5 text-secondary-600 hover:text-secondary-900" aria-label="Increase quantity"><Plus size={16} /></button>
                      </div>
                      <span className="font-semibold text-secondary-900">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-secondary-100 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-secondary-600">Subtotal</span>
                <span className="text-xl font-bold text-secondary-900">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-sm text-secondary-500">Shipping and taxes calculated at checkout.</p>
              <Link href="/checkout" onClick={closeCart} className="btn-primary w-full">Proceed to Checkout</Link>
              <button onClick={handleContinueShopping} className="w-full text-center text-sm font-medium text-secondary-600 hover:text-secondary-900 transition-colors">Continue Shopping</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
