import Link from "next/link";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/supabase";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/product/${product.id}`} className="group card overflow-hidden block">
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary-50">
        <img src={product.image_url || ""} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        {product.featured && <span className="absolute top-3 left-3 bg-gold-500 text-secondary-900 text-xs font-bold px-3 py-1 rounded-full">Featured</span>}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-secondary-900 group-hover:text-primary-600 transition-colors line-clamp-1">{product.title}</h3>
        <p className="text-sm text-secondary-500 mt-1 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-bold text-secondary-900">{formatPrice(product.price)}</span>
          <span className="text-sm text-secondary-500 group-hover:text-primary-600 transition-colors">View Details</span>
        </div>
      </div>
    </Link>
  );
}
