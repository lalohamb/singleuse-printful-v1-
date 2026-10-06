"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, X, Loader2, Package, CheckCircle, AlertTriangle,
  Edit2, Trash2, Eye, EyeOff, Archive, ChevronDown, RefreshCw,
} from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";
import AppImage from "@/components/AppImage";

// ── Types ─────────────────────────────────────────────────────────────────────

type CatalogProduct = {
  id: string;
  title: string;
  slug: string | null;
  status: "active" | "draft" | "archived";
  catalog_source: "catalog_builder" | "printful_sync" | "manual" | null;
  printful_id: string | null;
  printful_catalog_id: number | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  category_name: string | null;
  batch_id: string | null;
  recipe_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  variant_count: number;
  active_variant_count: number;
  image_count: number;
  design_count: number;
  has_order_history: boolean;
};

type DepsSummary = {
  product_id: string;
  title: string;
  catalog_source: string | null;
  variant_count: number;
  image_count: number;
  design_count: number;
  mockup_task_count: number;
  order_references: number;
  all_order_references: number;
  deletion_permitted: boolean;
  block_reason: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceLabel(source: CatalogProduct["catalog_source"]) {
  if (source === "catalog_builder") return "Catalog Builder";
  if (source === "printful_sync") return "Printful Sync";
  if (source === "manual") return "Manual";
  return "Unknown";
}

function sourceBadgeClass(source: CatalogProduct["catalog_source"]) {
  if (source === "catalog_builder") return "bg-primary-100 text-primary-700";
  if (source === "printful_sync") return "bg-amber-100 text-amber-700";
  return "bg-secondary-100 text-secondary-500";
}

function statusBadgeClass(status: CatalogProduct["status"]) {
  if (status === "active") return "bg-success-50 text-success-600";
  if (status === "draft") return "bg-warning-50 text-warning-600";
  return "bg-secondary-100 text-secondary-500";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({
  product,
  deps,
  onConfirm,
  onCancel,
  deleting,
}: {
  product: CatalogProduct;
  deps: DepsSummary | null;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  const permitted = deps?.deletion_permitted ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-secondary-900/60" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-error-50 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-error-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-secondary-900">Permanently delete this product?</h2>
            <p className="text-sm text-secondary-500 mt-0.5">
              This removes the CountyBuys catalog product and its product-owned records. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-secondary-50 rounded-lg p-3 space-y-1 text-sm">
          <p className="font-semibold text-secondary-800 truncate">{product.title}</p>
          <p className="text-secondary-500">Source: {sourceLabel(product.catalog_source)}</p>
          {deps ? (
            <>
              <p className="text-secondary-500">Variants: {deps.variant_count}</p>
              <p className="text-secondary-500">Product images: {deps.image_count}</p>
              <p className="text-secondary-500">Design mappings: {deps.design_count}</p>
              <p className="text-secondary-500">Mockup tasks: {deps.mockup_task_count}</p>
              <p className="text-secondary-500">
                Order references (paid/fulfilled): {deps.order_references}
              </p>
              <p className={`font-semibold mt-1 ${permitted ? "text-success-600" : "text-error-600"}`}>
                Deletion permitted: {permitted ? "YES" : "NO"}
              </p>
              {!permitted && deps.block_reason && (
                <p className="text-error-600 text-xs mt-1">{deps.block_reason}</p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-secondary-400">
              <Loader2 size={14} className="animate-spin" />
              Checking dependencies…
            </div>
          )}
        </div>

        {!permitted && deps && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-sm text-warning-800">
            <strong>Cannot delete.</strong> Archive or deactivate this product instead.
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="btn-outline flex-1 py-2">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!permitted || deleting || deps === null}
            className="flex-1 py-2 px-4 rounded-lg font-semibold text-sm bg-error-600 text-white hover:bg-error-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function CatalogManagement() {
  const router = useRouter();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "draft" | "archived">("");
  const [filterSource, setFilterSource] = useState<"" | "catalog_builder" | "printful_sync">("");

  // Actions
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<DepsSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/catalog");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load catalog");
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = products.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.id.includes(search)) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterSource && p.catalog_source !== filterSource) return false;
    return true;
  });

  // ── Status actions ─────────────────────────────────────────────────────────

  const patchStatus = async (id: string, status: "active" | "draft" | "archived") => {
    setActionBusy(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActionBusy(null);
    }
  };

  // ── Delete flow ────────────────────────────────────────────────────────────

  const openDelete = async (product: CatalogProduct) => {
    setDeleteTarget(product);
    setDeleteDeps(null);
    try {
      const res = await fetch(`/api/admin/catalog/${product.id}`);
      const data = await res.json();
      if (res.ok) setDeleteDeps(data);
    } catch {
      // deps will remain null — dialog shows loading state
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !deleteDeps?.deletion_permitted) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/catalog/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteDeps(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Delete failed");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-secondary-900">Product Catalog</h1>
          <p className="text-sm text-secondary-500 mt-0.5">
            Manage product lifecycle — activate, deactivate, archive, or delete.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-outline py-2 flex items-center gap-2">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {(error || actionError) && (
        <div className="bg-error-50 border border-error-100 text-error-700 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2"><AlertTriangle size={15} />{error || actionError}</span>
          <button onClick={() => { setError(null); setActionError(null); }}><X size={15} /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-2.5 text-secondary-400" />
          <input
            type="text"
            placeholder="Search by title or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 py-2 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-secondary-400 hover:text-secondary-700">
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          className="input-field py-2 text-sm max-w-[140px]"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as typeof filterSource)}
          className="input-field py-2 text-sm max-w-[160px]"
        >
          <option value="">All sources</option>
          <option value="catalog_builder">Catalog Builder</option>
          <option value="printful_sync">Printful Sync</option>
        </select>
      </div>

      {/* Summary counts */}
      <div className="flex flex-wrap gap-3 text-sm text-secondary-500">
        <span>{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
        {filterStatus === "" && (
          <>
            <span>·</span>
            <span className="text-success-600">{products.filter((p) => p.status === "active").length} active</span>
            <span>·</span>
            <span className="text-warning-600">{products.filter((p) => p.status === "draft").length} draft</span>
            <span>·</span>
            <span>{products.filter((p) => p.status === "archived").length} archived</span>
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-secondary-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-secondary-400">
          <Package size={40} className="mx-auto mb-3 text-secondary-200" />
          No products match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-secondary-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-secondary-50 border-b border-secondary-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide hidden md:table-cell">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide hidden lg:table-cell">Variants</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide hidden lg:table-cell">Updated</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-secondary-600 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {filtered.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    busy={actionBusy === p.id}
                    onEdit={() => router.push(`/admin/products/${p.id}`)}
                    onActivate={() => patchStatus(p.id, "active")}
                    onDraft={() => patchStatus(p.id, "draft")}
                    onArchive={() => patchStatus(p.id, "archived")}
                    onDelete={() => openDelete(p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteDialog
          product={deleteTarget}
          deps={deleteDeps}
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteDeps(null); }}
          deleting={deleting}
        />
      )}
    </div>
  );
}

// ── Product row ───────────────────────────────────────────────────────────────

function ProductRow({
  product: p,
  busy,
  onEdit,
  onActivate,
  onDraft,
  onArchive,
  onDelete,
}: {
  product: CatalogProduct;
  busy: boolean;
  onEdit: () => void;
  onActivate: () => void;
  onDraft: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isCatalogBuilder = p.catalog_source === "catalog_builder";
  const isPrintfulSync = p.catalog_source === "printful_sync";

  return (
    <tr className="hover:bg-secondary-50 transition-colors">
      {/* Product */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <AppImage
            src={p.image_url || ""}
            alt={p.title}
            width={44}
            height={44}
            className="w-11 h-11 rounded-lg object-cover bg-secondary-100 flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium text-secondary-900 truncate max-w-[220px]">{p.title}</p>
            <p className="text-xs text-secondary-400 font-mono truncate max-w-[220px]">{p.id}</p>
            {p.has_order_history && (
              <span className="inline-flex items-center gap-1 text-[10px] text-warning-600 font-medium mt-0.5">
                <AlertTriangle size={10} />has order history
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Source */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sourceBadgeClass(p.catalog_source)}`}>
          {sourceLabel(p.catalog_source)}
        </span>
        {p.printful_catalog_id && (
          <p className="text-[10px] text-secondary-400 mt-0.5">Catalog #{p.printful_catalog_id}</p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(p.status)}`}>
          {p.status}
        </span>
        {p.published_at && p.status === "active" && (
          <p className="text-[10px] text-secondary-400 mt-0.5">Published {formatDate(p.published_at)}</p>
        )}
      </td>

      {/* Variants */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-secondary-700">
          {p.active_variant_count}
          {p.variant_count !== p.active_variant_count && (
            <span className="text-secondary-400"> / {p.variant_count}</span>
          )}
        </span>
        {p.design_count > 0 && (
          <p className="text-[10px] text-secondary-400">{p.design_count} design{p.design_count !== 1 ? "s" : ""}</p>
        )}
      </td>

      {/* Updated */}
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-secondary-500">
        {formatDate(p.updated_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {/* Edit — always available */}
          <button
            onClick={onEdit}
            title="Edit product"
            className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
          >
            <Edit2 size={15} />
          </button>

          {/* Status toggle dropdown */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              title="Change status"
              className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-0.5"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-secondary-100 rounded-xl shadow-lg py-1 min-w-[160px]">
                  {p.status !== "active" && (
                    <button
                      onClick={() => { setMenuOpen(false); onActivate(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-success-700 hover:bg-success-50 transition-colors"
                    >
                      <CheckCircle size={14} />Activate
                    </button>
                  )}
                  {p.status !== "draft" && (
                    <button
                      onClick={() => { setMenuOpen(false); onDraft(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-warning-700 hover:bg-warning-50 transition-colors"
                    >
                      <EyeOff size={14} />Set Draft
                    </button>
                  )}
                  {p.status !== "archived" && (
                    <button
                      onClick={() => { setMenuOpen(false); onArchive(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-secondary-600 hover:bg-secondary-50 transition-colors"
                    >
                      <Archive size={14} />Archive
                    </button>
                  )}
                  <div className="border-t border-secondary-100 mt-1 pt-1">
                    {isPrintfulSync ? (
                      <div className="px-3 py-2 text-xs text-secondary-400 italic">
                        Legacy sync — delete disabled
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMenuOpen(false); onDelete(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-600 hover:bg-error-50 transition-colors"
                      >
                        <Trash2 size={14} />Delete…
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* View storefront */}
          {p.slug && p.status === "active" && (
            <a
              href={`/product/${p.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              title="View on storefront"
              className="p-2 text-secondary-500 hover:text-secondary-900 hover:bg-secondary-100 rounded-lg transition-colors"
            >
              <Eye size={15} />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
  return <ProtectedAdmin><CatalogManagement /></ProtectedAdmin>;
}
