"use client";
import { useState } from "react";
import { Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ProductWorkspaceData } from "../page";

type Gate = { label: string; pass: boolean; warning?: boolean; detail?: string };

export function PublicationTab({
  data,
  onReload,
  onNavigate,
}: {
  data: ProductWorkspaceData;
  onReload: () => Promise<void>;
  onNavigate: (tab: string) => void;
}) {
  const { product, variants, product_designs, images } = data;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isCatalogBuilder = product.catalog_source === "catalog_builder";
  const primaryDesign = product_designs.find((pd) => pd.is_primary);
  const activeVariants = variants.filter((v) => v.available);

  // Publication gates (catalog_builder only)
  const gates: Gate[] = isCatalogBuilder ? [
    {
      label: "Active variants",
      pass: activeVariants.length > 0,
      detail: `${activeVariants.length} of ${variants.length} variants available`,
    },
    {
      label: "Retail price",
      pass: product.price > 0,
      detail: `$${product.price.toFixed(2)}`,
    },
    {
      label: "Primary design attached",
      pass: !!primaryDesign,
      detail: primaryDesign ? primaryDesign.placement + " / " + (primaryDesign.technique ?? "—") : "No design",
    },
    {
      label: "Design artwork",
      pass: !!(primaryDesign?.designs as { artwork_url?: string } | null)?.artwork_url,
      detail: (primaryDesign?.designs as { artwork_url?: string } | null)?.artwork_url ? "Present" : "Missing",
    },
    {
      label: "Printful catalog mapping",
      pass: !!product.printful_catalog_id,
      detail: product.printful_catalog_id ? `Catalog ${product.printful_catalog_id}` : "Missing",
    },
    {
      label: "Product images",
      pass: images.length > 0,
      warning: images.length === 0,
      detail: `${images.length} image${images.length !== 1 ? "s" : ""}`,
    },
  ] : [];

  const hardBlocked = isCatalogBuilder && gates.some((g) => !g.pass && !g.warning);

  const setStatus = async (status: "active" | "draft" | "archived") => {
    if (status === "archived" && !confirm("Archive this product? It will be hidden from the storefront.")) return;
    setSaving(true); setMsg(null);
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg({ type: "error", text: d.error }); return; }
    setMsg({ type: "success", text: `Product set to ${status}.` });
    await onReload();
  };

  return (
    <div className="space-y-6 max-w-xl">
      {/* Current status */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-secondary-900">Current Status</h3>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
            product.status === "active" ? "bg-success-50 text-success-700"
            : product.status === "draft" ? "bg-warning-50 text-warning-700"
            : "bg-secondary-100 text-secondary-500"
          }`}>{product.status.toUpperCase()}</span>
          {product.published_at && (
            <span className="text-xs text-secondary-400">
              Published {new Date(product.published_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Publication gates */}
      {isCatalogBuilder && (
        <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-secondary-900">Publication Checklist</h3>
          <div className="space-y-2">
            {gates.map((g) => (
              <div key={g.label} className="flex items-start gap-2 text-sm">
                {g.pass
                  ? <CheckCircle size={15} className="text-success-500 flex-shrink-0 mt-0.5" />
                  : g.warning
                    ? <AlertTriangle size={15} className="text-warning-500 flex-shrink-0 mt-0.5" />
                    : <XCircle size={15} className="text-error-500 flex-shrink-0 mt-0.5" />}
                <div>
                  <span className={g.pass ? "text-secondary-700" : g.warning ? "text-warning-700" : "text-error-700"}>
                    {g.label}
                  </span>
                  {g.detail && <span className="text-secondary-400 ml-1 text-xs">— {g.detail}</span>}
                </div>
              </div>
            ))}
          </div>
          {hardBlocked && (
            <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm flex items-start gap-2">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              Resolve the issues above before publishing.
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl border border-secondary-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-secondary-900">Change Status</h3>
        <div className="flex flex-wrap gap-2">
          {product.status !== "active" && (
            <button
              onClick={() => setStatus("active")}
              disabled={saving || hardBlocked}
              className="btn-primary py-2 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Publish (Active)
            </button>
          )}
          {product.status !== "draft" && (
            <button onClick={() => setStatus("draft")} disabled={saving} className="btn-outline py-2 text-sm">
              Set Draft
            </button>
          )}
          {product.status !== "archived" && (
            <button onClick={() => setStatus("archived")} disabled={saving} className="btn-outline py-2 text-sm text-error-600 border-error-200 hover:bg-error-50">
              Archive
            </button>
          )}
        </div>
        <p className="text-xs text-secondary-400">
          Archiving hides the product from the storefront. Existing orders are not affected.
        </p>
      </div>

      {msg && (
        <div className={`rounded-lg p-3 text-sm ${msg.type === "success" ? "bg-success-50 border border-success-200 text-success-800" : "bg-error-50 border border-error-100 text-error-700"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
