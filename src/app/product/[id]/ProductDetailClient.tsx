"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus, ShoppingBag, Check, Truck, RefreshCw, Pencil, X, ZoomIn } from "lucide-react";
import { formatPrice } from "@/lib/supabase";
import { useCart } from "@/lib/cart";
import type { Product, ProductVariant } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function ProductDetailClient({ product, related, freeShippingThreshold = 75, productBadges }: {
  product: Product;
  related: Product[];
  freeShippingThreshold?: number;
  productBadges?: { text: string; active: boolean }[];
}) {
  const defaultBadges = [
    { text: `Free shipping on orders over $${freeShippingThreshold}`, active: true },
    { text: "Print on demand - made fresh for you", active: true },
    { text: "Premium quality guarantee", active: true },
  ];
  const badges = productBadges ?? defaultBadges;
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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const openLightbox = (img: string) => { setLightboxImg(img); setLightboxOpen(true); setZoom(1); setPan({ x: 0, y: 0 }); };
  const closeLightbox = () => { setLightboxOpen(false); setZoom(1); setPan({ x: 0, y: 0 }); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.001)));
  };
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const onMouseUp = () => setDragging(false);

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
      <button onClick={() => router.back()} className="flex items-center gap-1 text-secondary-500 hover:text-secondary-900 mb-6 transition-colors text-sm">
        <ChevronLeft size={18} /> Back
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        <div>
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-secondary-900 mb-3 relative cursor-zoom-in shadow-2xl" onClick={() => openLightbox(mainImage || product.image_url || "")}>
            <Image src={mainImage || product.image_url || "/product-placeholder.svg"} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover transition-opacity duration-300" priority />
            <div className="absolute top-3 right-3 bg-black/50 rounded-full p-1.5 text-white pointer-events-none">
              <ZoomIn size={16} />
            </div>
            <div className="kente-bar absolute bottom-0 left-0 right-0 h-1" />
            {product.is_personalizable && personalizationText.trim() && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="bg-black/50 text-white text-xl font-bold px-5 py-3 rounded-xl tracking-wide text-center max-w-[80%] break-words backdrop-blur-sm">
                  {personalizationText}
                </span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <button key={i} onClick={() => setMainImage(img)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all relative ${mainImage === img ? "border-gold-500" : "border-secondary-200 opacity-60 hover:opacity-100"}`}>
                  <Image src={img} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="lg:py-4">
          {product.featured && <span className="inline-block bg-gold-500 text-secondary-900 text-xs font-bold px-3 py-1 rounded-full mb-4 tracking-wide uppercase">Featured</span>}
          <p className="text-gold-500 text-xs font-medium tracking-[0.2em] uppercase mb-2">Body &amp; Sleeves</p>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-secondary-900 leading-tight">{product.title}</h1>
          <p className="text-2xl font-bold text-gold-500 mt-3">{formatPrice(selectedVariant?.price ?? product.price)}</p>
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
                  const v = variants.find((x) => x.color === selectedColor && (x.size || x.label) === s.label);
                  const active = (selectedVariant?.size || selectedVariant?.label) === s.label;
                  const basePrice = variants.find((x) => x.color === selectedColor)?.price;
                  const vPrice = v?.price ?? 0;
                  const showPrice = v?.price !== undefined && v.price !== basePrice;
                  return (
                    <button key={s.id + s.label} onClick={() => pickSize(s.label)} className={`px-4 py-2.5 border rounded-lg font-medium text-sm transition-all ${active ? "border-secondary-900 bg-secondary-900 text-white" : "border-secondary-200 text-secondary-700 hover:border-secondary-400"}`}>
                      {s.label}{showPrice && <span className="ml-1.5 opacity-75 text-xs">{formatPrice(vPrice)}</span>}
                    </button>
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
            <button onClick={handleAddToCart} disabled={!selectedVariant || (product.is_personalizable && !personalizationText.trim())} className="btn-gold flex-1">
              {added ? <><Check size={20} className="mr-2" />Added to Cart</> : <><ShoppingBag size={20} className="mr-2" />Add to Cart</>}
            </button>
          </div>
          <div className="mt-6 space-y-3 pt-6">
            <div className="kente-bar h-0.5 w-16 rounded-full mb-4" />
            {badges.filter((b) => b.active).map((b, i) => (
              <div key={i} className="flex items-center gap-3 text-secondary-600">
                {i === 0 ? <Truck size={20} className="text-primary-500 shrink-0" /> : i === 1 ? <RefreshCw size={20} className="text-primary-500 shrink-0" /> : <Check size={20} className="text-primary-500 shrink-0" />}
                <span className="text-sm">{b.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-secondary-100 pt-6">
            <p className="text-secondary-500 text-xs font-medium tracking-widest uppercase mb-3">About this piece</p>
            <p className="text-secondary-600 leading-relaxed whitespace-pre-wrap">{product.description}</p>
          </div>
        </div>
      </div>
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={closeLightbox}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10" onClick={closeLightbox}><X size={28} /></button>
          {zoom > 1 && (
            <button className="absolute top-4 left-4 text-white/70 hover:text-white p-2 z-10 text-sm" onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset</button>
          )}
          <div
            className="relative w-full h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
          >
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center", transition: dragging ? "none" : "transform 0.1s ease", width: "100%", height: "100%", position: "relative" }}>
              <Image src={lightboxImg} alt={product.title} fill sizes="100vw" className="object-contain" draggable={false} />
            </div>
          </div>
        </div>
      )}
      {related.length > 0 && (
        <section className="mt-20 -mx-4 sm:-mx-6 lg:-mx-8 bg-secondary-900 bg-weave text-white py-14 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
              <div className="kente-bar h-0.5 w-12 rounded-full" />
              <h2 className="text-2xl lg:text-3xl font-display font-bold text-white">You May Also Like</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
