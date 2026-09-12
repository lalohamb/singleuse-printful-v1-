import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/types";
import { formatPrice } from "@/lib/supabase";
import { ACTIVE_FLAGS } from "@/lib/productFlags";

export default function ProductCard({ product }: { product: Product }) {
  const badges = ACTIVE_FLAGS.filter((f) => (product as unknown as Record<string, boolean>)[f.key as string]).slice(0, 3);
  return (
    <Link href={`/product/${product.id}`} className="group card overflow-hidden block">
      <div className="relative aspect-[3/4] overflow-hidden bg-secondary-50">
        <Image src={product.image_url || "/genderapparel.png"} alt={product.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        {badges.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
            {badges.map((f) => <span key={f.key as string} className={`text-xs font-bold px-3 py-1 rounded-full ${f.badgeClass}`}>{f.badge}</span>)}
          </div>
        )}
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
