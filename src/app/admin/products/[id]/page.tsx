"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import type { Product, ProductDesign, ProductImage, StoreVariant } from "@/types";
import { OverviewTab } from "./tabs/OverviewTab";
import { DesignTab } from "./tabs/DesignTab";
import { ImagesTab } from "./tabs/ImagesTab";
import { VariantsTab } from "./tabs/VariantsTab";
import { ContentTab } from "./tabs/ContentTab";
import { PublicationTab } from "./tabs/PublicationTab";

export type ProductWorkspaceData = {
  product: Product;
  variants: StoreVariant[];
  product_designs: (ProductDesign & { designs: { id: string; name: string; slug: string | null; artwork_url: string; storage_path: string; file_name: string | null; width: number | null; height: number | null; status: string; file_size: number | null } | null })[];
  images: ProductImage[];
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "design", label: "Design & Production" },
  { id: "images", label: "Images" },
  { id: "variants", label: "Variants" },
  { id: "content", label: "Content & SEO" },
  { id: "publication", label: "Publication" },
] as const;

type TabId = typeof TABS[number]["id"];

function ProductWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ProductWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/products/${id}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Failed to load product"); return; }
    setData(json);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 size={28} className="animate-spin text-secondary-300" />
    </div>
  );

  if (error || !data) return (
    <div className="space-y-4">
      <div className="bg-error-50 border border-error-100 text-error-700 rounded-xl p-4 flex items-center gap-2">
        <AlertTriangle size={16} />{error || "Product not found"}
      </div>
      <Link href="/admin/products" className="btn-outline py-2 inline-flex items-center gap-2">
        <ArrowLeft size={16} />Back to Products
      </Link>
    </div>
  );

  const { product } = data;
  const isCatalogBuilder = product.catalog_source === "catalog_builder";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin/products" className="p-2 text-secondary-400 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-secondary-900 truncate">{product.title}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                isCatalogBuilder
                  ? "bg-primary-100 text-primary-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {isCatalogBuilder ? "Store-Owned" : "Legacy Printful Sync"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                product.status === "active" ? "bg-success-50 text-success-600"
                : product.status === "draft" ? "bg-warning-50 text-warning-600"
                : "bg-secondary-100 text-secondary-500"
              }`}>{product.status}</span>
            </div>
            <p className="text-xs text-secondary-400 font-mono mt-0.5 truncate">{product.id}</p>
          </div>
        </div>
        <a
          href={`/product/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline py-1.5 text-sm flex-shrink-0"
        >
          View
        </a>
      </div>

      {/* Tabs */}
      <div className="border-b border-secondary-100 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-secondary-900 text-secondary-900"
                  : "border-transparent text-secondary-500 hover:text-secondary-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "overview"    && <OverviewTab data={data} />}
      {tab === "design"      && <DesignTab data={data} onReload={reload} />}
      {tab === "images"      && <ImagesTab data={data} onReload={reload} />}
      {tab === "variants"    && <VariantsTab data={data} onReload={reload} />}
      {tab === "content"     && <ContentTab data={data} onReload={reload} />}
      {tab === "publication" && <PublicationTab data={data} onReload={reload} onNavigate={(t) => setTab(t as TabId)} />}
    </div>
  );
}

export default function ProductWorkspacePage() {
  return <ProtectedAdmin><ProductWorkspace /></ProtectedAdmin>;
}
