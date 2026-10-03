"use client";
import AppImage from "@/components/AppImage";
import type { ProductWorkspaceData } from "../page";

export function OverviewTab({ data }: { data: ProductWorkspaceData }) {
  const { product, variants, product_designs, images } = data;
  const isCatalogBuilder = product.catalog_source === "catalog_builder";
  const primaryDesign = product_designs.find((pd) => pd.is_primary) ?? product_designs[0];
  const primaryImage = images.find((i) => i.is_primary) ?? images[0];
  const activeVariants = variants.filter((v) => v.available);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: image + identity */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-secondary-100 overflow-hidden">
          <div className="aspect-square bg-secondary-50 relative">
            {primaryImage ? (
              <AppImage src={primaryImage.image_url} alt={product.title} fill className="object-contain p-4" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-secondary-300 text-sm">No image</div>
            )}
          </div>
          <div className="p-3 border-t border-secondary-100">
            <p className="text-xs text-secondary-400">{images.length} image{images.length !== 1 ? "s" : ""} · {activeVariants.length} active variant{activeVariants.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Right: details */}
      <div className="lg:col-span-2 space-y-4">
        {/* Product identity */}
        <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-secondary-900">Product Identity</h3>
          <Row label="UUID" value={product.id} mono />
          <Row label="Slug" value={product.slug ?? "—"} mono />
          <Row label="Status" value={product.status} />
          <Row label="Source" value={isCatalogBuilder ? "Store-Owned (Catalog Builder)" : "Legacy Printful Sync"} />
          <Row label="Created" value={new Date(product.created_at).toLocaleDateString()} />
          <Row label="Updated" value={new Date(product.updated_at).toLocaleDateString()} />
        </div>

        {/* Provider mapping */}
        <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-secondary-900">Provider Mapping</h3>
          {isCatalogBuilder ? (
            <>
              <Row label="Provider" value="Printful" />
              <Row label="Catalog Product ID" value={product.printful_catalog_id ? String(product.printful_catalog_id) : "—"} mono />
              <Row label="Sync Product ID" value="None (store-owned)" />
              <Row label="Fulfillment" value="DIRECT_CATALOG_ORDER" />
            </>
          ) : (
            <>
              <Row label="Provider" value="Printful" />
              <Row label="Sync Product ID" value={product.printful_id ?? "—"} mono />
              <Row label="Catalog Product ID" value={product.printful_catalog_id ? String(product.printful_catalog_id) : "—"} mono />
              <Row label="Fulfillment" value="SYNC_VARIANT" />
            </>
          )}
        </div>

        {/* Design & production */}
        {primaryDesign && (
          <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-secondary-900">Design & Production</h3>
            <Row label="Design" value={primaryDesign.designs?.name ?? primaryDesign.design_id} />
            <Row label="Design UUID" value={primaryDesign.design_id} mono />
            <Row label="Technique" value={primaryDesign.technique ?? "—"} />
            <Row label="Placement" value={primaryDesign.placement} />
            {primaryDesign.designs?.width && primaryDesign.designs?.height && (
              <Row label="Artwork size" value={`${primaryDesign.designs.width} × ${primaryDesign.designs.height} px`} />
            )}
          </div>
        )}

        {/* Pricing */}
        <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-secondary-900">Pricing</h3>
          <Row label="Base retail price" value={`$${product.price.toFixed(2)}`} />
          {product.compare_at_price && (
            <Row label="Compare-at price" value={`$${product.compare_at_price.toFixed(2)}`} />
          )}
          {variants.length > 0 && (
            <Row
              label="Variant price range"
              value={(() => {
                const prices = variants.map((v) => v.retail_price).filter(Boolean);
                if (!prices.length) return "—";
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
              })()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-secondary-500 flex-shrink-0">{label}</span>
      <span className={`text-secondary-900 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
