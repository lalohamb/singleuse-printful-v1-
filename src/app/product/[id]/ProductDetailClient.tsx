"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, ShoppingBag, Check, Truck, RefreshCw, Pencil } from "lucide-react";
import { formatPrice } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import type { Product, ProductVariant } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function ProductDetailClient({ product, related }: { product: Product; related: Product[] }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const images = Array.isArray(product.images) && product.images.length > 0 ? product.images : [product.image_url || ""];

  // Unique colors in variant order, and a color -> image lookup (populated by
  // the Printify sync). Hide the color picker when there's no real choice.
  const colors = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of variants) { if (v.color && !seen.has(v.color)) { seen.add(v.color); out.push(v.color); } }
    return out;
  }, [variants]);
  const colorImage = (c: string) => variants.find((v) => v.color === c && v.image_url)?.image_url || null;
  const hasColorChoice = colors.length > 1 || (colors.length === 1 && colors[0] !== "Default");

  const [selectedColor, setSelectedColor] = useState<string>(variants[0]?.color || "");
  // Sizes/styles available for the currently selected color.
  const SIZE_ORDER = ["XS","S","M","L","XL","2XL","3XL","4XL","5XL"];
  const sizes = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const v of variants) {
      if (v.color !== selectedColor) continue;
      const label = v.size || v.label;
      if (!seen.has(label)) { seen.add(label); out.push({ id: v.id, label }); }
    }
    return out.sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a.label.toUpperCase());
      const bi = SIZE_ORDER.indexOf(b.label.toUpperCase());
      if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [variants, selectedColor]);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(variants[0] || null);
  const [mainImage, setMainImage] = useState<string>(colorImage(variants[0]?.color || "") || images[0] || product.image_url || "");
  const [quantity, setQuantity] = useState(1);
  const [personalizationText, setPersonalizationText] = useState("");
  const [added, setAdded] = useState(false);

  const pickColor = (c: string) => {
    setSelectedColor(c);
    const img = colorImage(c);
    if (img) setMainImage(img);
    setSelectedVariant(variants.find((v) => v.color === c) || null);
  };
  const pickSize = (label: string) => {
    const v = variants.find((x) => x.color === selectedColor && (x.size || x.label) === label);
    if (v) setSelectedVariant(v);
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    if (product.is_personalizable && !personalizationText.trim()) return;
    addToCart(product, selectedVariant, quantity, personalizationText.trim() || undefined);
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
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-secondary-50 mb-4 relative">
            <Image src={mainImage || product.image_url || "/product-placeholder.svg"} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition-opacity duration-300" priority />
            {product.is_personalizable && personalizationText.trim() && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 text-white text-xl font-bold px-5 py-3 rounded-xl tracking-wide text-center max-w-[80%] break-words backdrop-blur-sm">
                  {personalizationText}
                </span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3 flex-wrap">
              {images.map((img, i) => (
                <button key={i} onClick={() => setMainImage(img)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all relative ${mainImage === img ? "border-secondary-900" : "border-transparent opacity-60 hover:opacity-100"}`}>
                  <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:py-4">
          {product.featured && <span className="inline-block bg-gold-500 text-secondary-900 text-xs font-bold px-3 py-1 rounded-full mb-4">Featured</span>}
          <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900">{product.title}</h1>
          <p className="text-2xl font-bold text-secondary-900 mt-4">{formatPrice(product.price)}</p>
          <p className="text-secondary-600 mt-6 leading-relaxed whitespace-pre-wrap">{product.description}</p>
          {hasColorChoice && (
            <div className="mt-8">
              <label className="label-text">Color: <span className="font-normal text-secondary-500">{selectedColor}</span></label>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const img = colorImage(c);
                  const active = selectedColor === c;
                  return (
                    <button key={c} onClick={() => pickColor(c)} title={c} aria-label={c} className={`relative rounded-lg border-2 transition-all ${active ? "border-secondary-900" : "border-secondary-200 hover:border-secondary-400"} ${img ? "w-14 h-14 overflow-hidden" : "px-3 py-2 text-sm font-medium"}`}>
                    {img ? <Image src={img} alt={c} fill sizes="56px" className="object-cover" /> : c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {sizes.length > 0 && (
            <div className="mt-6">
              <label className="label-text">{hasColorChoice ? "Size" : "Select Size / Style"}</label>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const active = (selectedVariant?.size || selectedVariant?.label) === s.label;
                  return (
                    <button key={s.id + s.label} onClick={() => pickSize(s.label)} className={`px-4 py-2.5 border rounded-lg font-medium text-sm transition-all ${active ? "border-secondary-900 bg-secondary-900 text-white" : "border-secondary-200 text-secondary-700 hover:border-secondary-400"}`}>{s.label}</button>
                  );
                })}
              </div>
            </div>
          )}
          {product.is_personalizable && (
            <div className="mt-6">
              <label className="label-text flex items-center gap-1.5"><Pencil size={14} />{product.personalization_label || "Personalization"} <span className="text-error-500">*</span></label>
              <input
                type="text"
                value={personalizationText}
                onChange={(e) => setPersonalizationText(e.target.value)}
                placeholder="Enter your custom text..."
                maxLength={100}
                className="input-field mt-1"
              />
              <p className="text-xs text-secondary-400 mt-1">{personalizationText.length}/100 characters</p>
            </div>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <div className="flex items-center border border-secondary-200 rounded-lg">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 text-secondary-600 hover:text-secondary-900" aria-label="Decrease quantity"><Minus size={18} /></button>
              <span className="px-4 font-medium min-w-[3rem] text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="p-3 text-secondary-600 hover:text-secondary-900" aria-label="Increase quantity"><Plus size={18} /></button>
            </div>
            <button onClick={handleAddToCart} disabled={!selectedVariant || (product.is_personalizable && !personalizationText.trim())} className="btn-primary flex-1">
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
