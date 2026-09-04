"use client";
import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import type { Product, Category } from "@/types";
import ProductCard from "@/components/ProductCard";

export default function ShopClient({ products, categories }: { products: Product[]; categories: Category[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [flagFilter, setFlagFilter] = useState<"" | "is_new_arrival" | "is_trending">("");
  const activeCategory = searchParams.get("category") || "";

  const setCategory = (slug: string) => {
    router.push(slug ? `/shop?category=${slug}` : "/shop");
  };

  const filtered = useMemo(() => {
    let list = [...products];
    if (activeCategory) {
      const cat = categories.find((c) => c.slug === activeCategory);
      if (cat) list = list.filter((p) => p.category_id === cat.id);
    }
    if (flagFilter) list = list.filter((p) => (p as unknown as Record<string, boolean>)[flagFilter]);
    if (sortBy === "price-low") list.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-high") list.sort((a, b) => b.price - a.price);
    else if (sortBy === "newest") list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortBy === "new") list.sort((a, b) => (b.is_new_arrival ? 1 : 0) - (a.is_new_arrival ? 1 : 0));
    else if (sortBy === "trending") list.sort((a, b) => (b.is_trending ? 1 : 0) - (a.is_trending ? 1 : 0));
    else list.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    return list;
  }, [products, categories, activeCategory, sortBy, flagFilter]);

  const activeCatName = categories.find((c) => c.slug === activeCategory)?.name || "All Products";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-secondary-900">{activeCatName}</h1>
        <p className="text-secondary-500 mt-2">{filtered.length} {filtered.length === 1 ? "product" : "products"}</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 flex-shrink-0">
          <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden flex items-center gap-2 mb-4 px-4 py-2 border border-secondary-200 rounded-lg w-full justify-center">
            <SlidersHorizontal size={18} /> Filters
          </button>
          <div className={`${showFilters ? "block" : "hidden"} lg:block`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-secondary-900">Categories</h2>
              <button onClick={() => setShowFilters(false)} className="lg:hidden p-1"><X size={18} /></button>
            </div>
            <div className="space-y-1">
              <button onClick={() => setCategory("")} className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${!activeCategory ? "bg-secondary-900 text-white font-medium" : "text-secondary-700 hover:bg-secondary-50"}`}>All Products</button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setCategory(cat.slug)} className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${activeCategory === cat.slug ? "bg-secondary-900 text-white font-medium" : "text-secondary-700 hover:bg-secondary-50"}`}>{cat.name}</button>
              ))}
            </div>
            <h2 className="font-semibold text-secondary-900 mt-6 mb-4">Collections</h2>
            <div className="space-y-1">
              {([["is_new_arrival", "New Arrivals"], ["is_trending", "Trending"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setFlagFilter((f) => f === key ? "" : key)} className={`block w-full text-left px-3 py-2 rounded-lg transition-colors ${flagFilter === key ? "bg-secondary-900 text-white font-medium" : "text-secondary-700 hover:bg-secondary-50"}`}>{label}</button>
              ))}
            </div>
          </div>
        </aside>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-secondary-600">Sort by:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-sm border border-secondary-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="featured">Featured</option>
                <option value="new">New Arrivals</option>
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-20"><p className="text-secondary-500 text-lg">No products found in this category.</p></div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
