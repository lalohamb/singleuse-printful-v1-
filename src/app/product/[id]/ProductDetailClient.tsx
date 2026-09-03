"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, ShoppingBag, Check, Truck, RefreshCw } from "lucide-react";
import { formatPrice } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import type { Product, ProductVariant } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function ProductDetailClient({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image_url || ""];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(variants[0] || null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    addToCart(product, selectedVariant, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-secondary-600 hover:text-secondary-900 mb-6 transition-colors">
        <ChevronLeft size={20} /> Back
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <div>
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-secondary-50 mb-4">
            <img src={images[activeImage] || product.image_url || ""} alt={product.title} className="w-full h-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="flex gap-3">
              {images.map((img, i) => (
                <button key={i} onClick={() => setActiveImage(i)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${activeImage === i ? "border-secondary-900" : "border-transparent opacity-60 hover:opacity-100"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:py-4">
          {product.featured && <span className="inline-block bg-gold-500 text-secondary-900 text-xs font-bold px-3 py-1 rounded-full mb-4">Featured</span>}
          <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900">{product.title}</h1>
          <p className="text-2xl font-bold text-secondary-900 mt-4">{formatPrice(product.price)}</p>
          <p className="text-secondary-600 mt-6 leading-relaxed">{product.description}</p>
          {variants.length > 0 && (
            <div className="mt-8">
              <label className="label-text">Select Size / Style</label>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button key={v.id + v.label} onClick={() => setSelectedVariant(v)} className={`px-4 py-2.5 border rounded-lg font-medium text-sm transition-all ${selectedVariant?.id === v.id && selectedVariant?.label === v.label ? "border-secondary-900 bg-secondary-900 text-white" : "border-secondary-200 text-secondary-700 hover:border-secondary-400"}`}>{v.label}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <div className="flex items-center border border-secondary-200 rounded-lg">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-secondary-600 hover:text-secondary-900" aria-label="Decrease quantity"><Minus size={18} /></button>
              <span className="px-4 font-medium min-w-[3rem] text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-3 text-secondary-600 hover:text-secondary-900" aria-label="Increase quantity"><Plus size={18} /></button>
            </div>
            <button onClick={handleAddToCart} disabled={!selectedVariant} className="btn-primary flex-1">
              {added ? <><Check size={20} className="mr-2" />Added to Cart</> : <><ShoppingBag size={20} className="mr-2" />Add to Cart</>}
            </button>
          </div>
          <div className="mt-10 space-y-4 border-t border-secondary-100 pt-6">
            <div className="flex items-center gap-3 text-secondary-600"><Truck size={20} className="text-primary-500" /><span className="text-sm">Free shipping on orders over $75</span></div>
            <div className="flex items-center gap-3 text-secondary-600"><RefreshCw size={20} className="text-primary-500" /><span className="text-sm">Print on demand - made fresh for you</span></div>
            <div className="flex items-center gap-3 text-secondary-600"><Check size={20} className="text-primary-500" /><span className="text-sm">Premium quality guarantee</span></div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-secondary-900 mb-8">You May Also Like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
