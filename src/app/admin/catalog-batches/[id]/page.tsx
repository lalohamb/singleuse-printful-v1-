"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertTriangle, XCircle, Play, BookOpen, Ban, RefreshCw, Camera, Tag } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type Batch = { id: string; name: string; status: string; approved_at: string | null; generation_started_at: string | null; generation_completed_at: string | null };
type BatchItem = {
  id: string; design_id: string; recipe_id: string; status: string; validation_class: string;
  error_message: string | null; generated_product_id: string | null;
  resolved_specification: { title?: string; slug?: string; price?: number; variants?: unknown[] } | null;
  validation_result: { warnings: string[] } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-secondary-100 text-secondary-600",
  planning: "bg-amber-50 text-amber-700",
  validated: "bg-blue-50 text-blue-700",
  ready: "bg-primary-50 text-primary-700",
  generating: "bg-purple-50 text-purple-700",
  processing: "bg-purple-50 text-purple-700",
  review: "bg-amber-50 text-amber-700",
  completed: "bg-success-50 text-success-700",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-secondary-100 text-secondary-400",
};

function BatchDetail({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedForPublish, setSelectedForPublish] = useState<Set<string>>(new Set());

  const [processingMockups, setProcessingMockups] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [showBulkCategory, setShowBulkCategory] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/batches/${batchId}`);
    const data = await res.json();
    setBatch(data.batch);
    setItems(data.items ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [batchId]);

  const generatedItems = items.filter((i) => i.generated_product_id);
  const failedItems = items.filter((i) => i.status === "fail");
  const approvedItems = items.filter((i) => i.status === "approved");

  async function handleProcessMockups(retryFailed = false) {
    setProcessingMockups(true); setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/mockups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry_failed: retryFailed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mockup processing failed");
    } finally {
      setProcessingMockups(false);
    }
  }

  async function handleBulkCategory() {
    if (!bulkCategoryId.trim() || selectedForPublish.size === 0) return;
    setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/bulk-update`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selectedForPublish], operation: "set_category", category_id: bulkCategoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowBulkCategory(false); setBulkCategoryId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk category failed");
    }
  }

  async function handleGenerate(retryFailed = false) {
    setGenerating(true); setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry_failed: retryFailed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCancel() {
    setCancelling(true); setError(null);
    try {
      await fetch(`/api/batches/${batchId}/cancel`, { method: "POST" });
      await load();
    } finally {
      setCancelling(false);
    }
  }

  async function handleBulkPublish() {
    if (selectedForPublish.size === 0) return;
    setPublishing(true); setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/publish`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...selectedForPublish] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedForPublish(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-secondary-300" /></div>;
  if (!batch) return <div className="text-center py-20 text-secondary-400">Batch not found</div>;

  const publishableItems = generatedItems.filter((i) => i.generated_product_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push("/admin/catalog-batches")} className="text-xs text-secondary-400 underline mb-1">← All Batches</button>
          <h1 className="text-xl font-bold text-secondary-900">{batch.name}</h1>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[batch.status] ?? "bg-secondary-100 text-secondary-500"}`}>
          {batch.status}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
          <XCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Progress summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-secondary-100 p-3 text-center">
          <p className="text-2xl font-bold text-secondary-900">{items.length}</p>
          <p className="text-xs text-secondary-500">Total Items</p>
        </div>
        <div className="bg-success-50 rounded-lg border border-success-100 p-3 text-center">
          <p className="text-2xl font-bold text-success-700">{generatedItems.length}</p>
          <p className="text-xs text-success-600">Generated</p>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-100 p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{approvedItems.length}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-100 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{failedItems.length}</p>
          <p className="text-xs text-red-600">Failed</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {generatedItems.length > 0 && (
          <button disabled={processingMockups} onClick={() => handleProcessMockups(false)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            {processingMockups ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            {processingMockups ? "Processing Mockups…" : `Process Mockups (${generatedItems.length})`}
          </button>
        )}
        {selectedForPublish.size > 0 && (
          <button onClick={() => setShowBulkCategory(!showBulkCategory)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm">
            <Tag size={14} /> Set Category
          </button>
        )}
        {batch.status === "ready" && approvedItems.length > 0 && (
          <button disabled={generating} onClick={() => handleGenerate(false)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {generating ? "Generating…" : `Generate ${approvedItems.length} Draft Products`}
          </button>
        )}
        {failedItems.length > 0 && (
          <button disabled={generating} onClick={() => handleGenerate(true)}
            className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            <RefreshCw size={14} /> Retry Failed ({failedItems.length})
          </button>
        )}
        {publishableItems.length > 0 && selectedForPublish.size > 0 && (
          <button disabled={publishing} onClick={handleBulkPublish}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-40">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
            {publishing ? "Publishing…" : `Publish ${selectedForPublish.size} Products`}
          </button>
        )}
        {!["cancelled", "completed"].includes(batch.status) && (
          <button disabled={cancelling} onClick={handleCancel}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40">
            <Ban size={14} /> Cancel Remaining
          </button>
        )}
      </div>

      {showBulkCategory && (
        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-secondary-700 mb-1">Category ID</label>
            <input value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}
              className="input-field" placeholder="category-uuid" />
          </div>
          <button onClick={handleBulkCategory} disabled={!bulkCategoryId.trim()}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
            Apply to {selectedForPublish.size} products
          </button>
          <button onClick={() => setShowBulkCategory(false)} className="text-sm text-secondary-400 underline">Cancel</button>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-secondary-700">Batch Items</h2>
          {publishableItems.length > 0 && (
            <button onClick={() => setSelectedForPublish(new Set(publishableItems.map((i) => i.generated_product_id!)))}
              className="text-xs text-primary-600 underline">Select all generated</button>
          )}
        </div>
        {items.map((item) => {
          const spec = item.resolved_specification;
          const isGenerated = !!item.generated_product_id;
          const isSelected = item.generated_product_id ? selectedForPublish.has(item.generated_product_id) : false;
          return (
            <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors ${
              isSelected ? "border-secondary-900 bg-secondary-50" :
              item.status === "fail" ? "border-red-200 bg-red-50" :
              isGenerated ? "border-success-200 bg-success-50" :
              "border-secondary-200 bg-white"
            }`}>
              {item.validation_class === "PASS" && <CheckCircle size={16} className="text-success-600 mt-0.5 flex-shrink-0" />}
              {item.validation_class === "WARNING" && <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />}
              {item.validation_class === "FAIL" && <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{spec?.title ?? item.id.slice(-8)}</p>
                <p className="text-xs text-secondary-400">
                  {spec?.variants ? `${(spec.variants as unknown[]).length} variants` : ""}{spec?.price ? ` · $${spec.price}` : ""}
                </p>
                {item.error_message && <p className="text-xs text-red-600 mt-0.5">{item.error_message}</p>}
                {item.validation_result?.warnings?.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 mt-0.5">{w}</p>
                ))}
                <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[item.status] ?? "bg-secondary-100 text-secondary-500"}`}>
                  {item.status}
                </span>
              </div>
              {isGenerated && item.generated_product_id && (
                <div className="flex items-center gap-2">
                  <a href={`/admin/products/${item.generated_product_id}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary-600 underline">View</a>
                  <input type="checkbox" checked={isSelected}
                    onChange={(e) => {
                      const next = new Set(selectedForPublish);
                      if (e.target.checked) next.add(item.generated_product_id!);
                      else next.delete(item.generated_product_id!);
                      setSelectedForPublish(next);
                    }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProtectedAdmin><BatchDetail batchId={id} /></ProtectedAdmin>;
}
