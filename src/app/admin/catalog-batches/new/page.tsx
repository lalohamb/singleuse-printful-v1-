"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check, Loader2, AlertCircle, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import ProtectedAdmin from "@/components/ProtectedAdmin";

type WizardStage = "setup" | "designs" | "recipes" | "matrix" | "preview" | "approve";

const STAGES: WizardStage[] = ["setup", "designs", "recipes", "matrix", "preview", "approve"];
const STAGE_LABELS: Record<WizardStage, string> = {
  setup: "Batch Setup",
  designs: "Select Designs",
  recipes: "Select Recipes",
  matrix: "Product Matrix",
  preview: "Preview",
  approve: "Approve",
};

type Design = { id: string; name: string; artwork_url: string; file_hash: string | null; width: number | null; height: number | null; status: string };
type Recipe = { id: string; name: string; slug: string; status: string; printful_catalog_id: number; technique: string; placement: string; pricing_rules: Record<string, unknown> };
type MatrixSummary = { total: number; pass: number; warning: number; fail: number; batch_status: string };
type BatchItem = { id: string; design_id: string; recipe_id: string; status: string; validation_class: string; error_message: string | null; resolved_specification: Record<string, unknown> | null; validation_result: { warnings: string[] } | null };

function NewBatchWizard() {
  const router = useRouter();
  const [stage, setStage] = useState<WizardStage>("setup");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchName, setBatchName] = useState("");
  const [designs, setDesigns] = useState<Design[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedDesigns, setSelectedDesigns] = useState<Design[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);
  const [matrixSummary, setMatrixSummary] = useState<MatrixSummary | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);

  const go = (s: WizardStage) => { setError(null); setStage(s); };
  const stageIdx = STAGES.indexOf(stage);

  // ── Stage: setup ──────────────────────────────────────────────────────────
  async function handleCreateBatch() {
    if (!batchName.trim()) { setError("Batch name is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/batches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: batchName }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBatchId(data.batch.id);
      // Load designs and recipes
      const [dr, rr] = await Promise.all([
        fetch("/api/designs?status=active").then((r) => r.json()),
        fetch("/api/recipes?status=active").then((r) => r.json()),
      ]);
      setDesigns(dr.designs ?? []);
      setRecipes(rr.recipes ?? []);
      go("designs");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create batch");
    } finally {
      setLoading(false);
    }
  }

  // ── Stage: matrix — resolve ───────────────────────────────────────────────
  async function handleResolve() {
    if (!batchId) return;
    setLoading(true); setError(null);
    try {
      // Build commercial inputs map with auto-generated titles/slugs
      const commercial_inputs_map: Record<string, { title: string; slug: string }> = {};
      for (const d of selectedDesigns) {
        for (const r of selectedRecipes) {
          const key = `${d.id}:${r.id}`;
          const title = `${d.name} — ${r.name}`;
          const slug = `${d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${r.slug}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
          commercial_inputs_map[key] = { title, slug };
        }
      }

      const res = await fetch(`/api/batches/${batchId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designs: selectedDesigns,
          // Send recipe objects only — server fetches Printful variants authoritatively
          recipes: selectedRecipes.map((r) => ({ recipe: r })),
          commercial_inputs_map,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMatrixSummary(data.summary);

      // Load items for preview
      const itemsRes = await fetch(`/api/batches/${batchId}/items`);
      const itemsData = await itemsRes.json();
      setBatchItems(itemsData.items ?? []);
      go("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve matrix");
    } finally {
      setLoading(false);
    }
  }

  // ── Stage: approve ────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!batchId) return;
    setApproving(true); setError(null);
    try {
      const res = await fetch(`/api/batches/${batchId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledged_warnings: acknowledgeWarnings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/admin/catalog-batches/${batchId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  const passItems = batchItems.filter((i) => i.validation_class === "PASS");
  const warnItems = batchItems.filter((i) => i.validation_class === "WARNING");
  const failItems = batchItems.filter((i) => i.validation_class === "FAIL");
  const canApprove = failItems.length === 0 && (warnItems.length === 0 || acknowledgeWarnings);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              i < stageIdx ? "bg-green-100 text-green-700" :
              i === stageIdx ? "bg-secondary-900 text-white" :
              "bg-secondary-100 text-secondary-400"
            }`}>
              {i < stageIdx ? <Check size={10} /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGES.length - 1 && <ChevronRight size={12} className="text-secondary-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3 text-sm">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Stage: setup */}
      {stage === "setup" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Batch Setup</h2>
          <div>
            <label className="block text-xs font-medium text-secondary-700 mb-1">Batch Name *</label>
            <input value={batchName} onChange={(e) => setBatchName(e.target.value)} className="input-field" placeholder="e.g. CountyBuys Fall 2026 Launch" />
          </div>
          <button disabled={!batchName.trim() || loading} onClick={handleCreateBatch}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
            {loading && <Loader2 size={14} className="animate-spin" />}
            Continue
          </button>
        </section>
      )}

      {/* Stage: designs */}
      {stage === "designs" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Select Designs ({selectedDesigns.length} selected)</h2>
          <p className="text-xs text-secondary-500">Only active designs are shown. Archived designs are excluded.</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {designs.map((d) => {
              const sel = selectedDesigns.some((s) => s.id === d.id);
              return (
                <button key={d.id} onClick={() => setSelectedDesigns(sel ? selectedDesigns.filter((s) => s.id !== d.id) : [...selectedDesigns, d])}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${sel ? "border-secondary-900 bg-secondary-50" : "border-secondary-200 hover:border-secondary-300"}`}>
                  {d.artwork_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.artwork_url} alt={d.name} className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900 truncate">{d.name}</p>
                    <p className="text-xs text-secondary-400">{d.width && d.height ? `${d.width}×${d.height}px` : "Dimensions unknown"}</p>
                  </div>
                  {sel && <Check size={16} className="text-secondary-900 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => go("setup")} className="text-sm text-secondary-400 underline">← Back</button>
            <button disabled={selectedDesigns.length === 0} onClick={() => go("recipes")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              Continue ({selectedDesigns.length} selected)
            </button>
          </div>
        </section>
      )}

      {/* Stage: recipes */}
      {stage === "recipes" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Select Recipes ({selectedRecipes.length} selected)</h2>
          <p className="text-xs text-secondary-500">Only active recipes are eligible for batch generation. Draft recipes must be activated first.</p>
          <div className="space-y-2">
            {recipes.map((r) => {
              const sel = selectedRecipes.some((s) => s.id === r.id);
              return (
                <button key={r.id} onClick={() => setSelectedRecipes(sel ? selectedRecipes.filter((s) => s.id !== r.id) : [...selectedRecipes, r])}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${sel ? "border-secondary-900 bg-secondary-50" : "border-secondary-200 hover:border-secondary-300"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-900">{r.name}</p>
                    <p className="text-xs text-secondary-400">Catalog {r.printful_catalog_id} · {r.technique} · {r.placement}</p>
                  </div>
                  {sel && <Check size={16} className="text-secondary-900 flex-shrink-0" />}
                </button>
              );
            })}
            {recipes.length === 0 && (
              <div className="text-center py-8 text-secondary-400 text-sm">
                No active recipes. <a href="/admin/product-recipes" className="underline text-primary-600">Activate a recipe</a> first.
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => go("designs")} className="text-sm text-secondary-400 underline">← Back</button>
            <button disabled={selectedRecipes.length === 0} onClick={() => go("matrix")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              Continue ({selectedRecipes.length} selected)
            </button>
          </div>
        </section>
      )}

      {/* Stage: matrix */}
      {stage === "matrix" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Product Matrix</h2>
          <div className="bg-secondary-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-secondary-500">Designs selected</span><span className="font-medium">{selectedDesigns.length}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">Recipes selected</span><span className="font-medium">{selectedRecipes.length}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">Candidate products</span><span className="font-bold text-secondary-900">{selectedDesigns.length * selectedRecipes.length}</span></div>
          </div>
          <div className="space-y-2">
            {selectedDesigns.map((d) => selectedRecipes.map((r) => (
              <div key={`${d.id}:${r.id}`} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-secondary-100 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-secondary-900 truncate">{d.name}</p>
                  <p className="text-xs text-secondary-400">× {r.name}</p>
                </div>
              </div>
            )))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => go("recipes")} className="text-sm text-secondary-400 underline">← Back</button>
            <button disabled={loading} onClick={handleResolve}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Resolving…" : "Resolve & Validate"}
            </button>
          </div>
        </section>
      )}

      {/* Stage: preview */}
      {stage === "preview" && matrixSummary && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Batch Preview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-success-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-success-700">{matrixSummary.pass}</p><p className="text-xs text-success-600">PASS</p></div>
            <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-amber-700">{matrixSummary.warning}</p><p className="text-xs text-amber-600">WARNING</p></div>
            <div className="bg-red-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-red-700">{matrixSummary.fail}</p><p className="text-xs text-red-600">FAIL</p></div>
            <div className="bg-secondary-50 rounded-lg p-3 text-center"><p className="text-2xl font-bold text-secondary-700">{matrixSummary.total}</p><p className="text-xs text-secondary-500">Total</p></div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {batchItems.map((item) => (
              <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                item.validation_class === "PASS" ? "border-success-200 bg-success-50" :
                item.validation_class === "WARNING" ? "border-amber-200 bg-amber-50" :
                "border-red-200 bg-red-50"
              }`}>
                {item.validation_class === "PASS" && <CheckCircle size={16} className="text-success-600 mt-0.5 flex-shrink-0" />}
                {item.validation_class === "WARNING" && <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />}
                {item.validation_class === "FAIL" && <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{(item.resolved_specification as Record<string, unknown> | null)?.title as string ?? item.id.slice(-8)}</p>
                  {item.error_message && <p className="text-xs text-red-600 mt-0.5">{item.error_message}</p>}
                  {item.validation_result?.warnings?.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 mt-0.5">{w}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {failItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {failItems.length} item(s) have FAIL validation and cannot be approved. Resolve issues or exclude these items.
            </div>
          )}

          {warnItems.length > 0 && failItems.length === 0 && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={acknowledgeWarnings} onChange={(e) => setAcknowledgeWarnings(e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-amber-700">I acknowledge {warnItems.length} warning(s) and want to proceed</span>
            </label>
          )}

          <div className="flex justify-between pt-2">
            <button onClick={() => go("matrix")} className="text-sm text-secondary-400 underline">← Back</button>
            <button disabled={!canApprove || approving} onClick={() => go("approve")}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-40">
              Review & Approve →
            </button>
          </div>
        </section>
      )}

      {/* Stage: approve */}
      {stage === "approve" && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Approve for Draft Generation</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">⚠ Review before approving</p>
            <p>Approving will allow generation of <strong>{passItems.length + warnItems.length}</strong> draft products.</p>
            <p>Products are created as <strong>DRAFT</strong> — they will not be visible to customers until you publish them.</p>
            <p>No Stripe charges. No Printful fulfillment orders. No PRINTFUL_AUTO_CONFIRM.</p>
          </div>
          <div className="bg-secondary-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-secondary-500">PASS items</span><span className="font-medium text-success-700">{passItems.length}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">WARNING items</span><span className="font-medium text-amber-700">{warnItems.length}</span></div>
            <div className="flex justify-between"><span className="text-secondary-500">FAIL items (blocked)</span><span className="font-medium text-red-700">{failItems.length}</span></div>
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => go("preview")} className="text-sm text-secondary-400 underline">← Back</button>
            <button disabled={!canApprove || approving} onClick={handleApprove}
              className="btn-primary px-6 py-2 text-sm disabled:opacity-40 flex items-center gap-2">
              {approving && <Loader2 size={14} className="animate-spin" />}
              {approving ? "Approving…" : `Approve ${passItems.length + warnItems.length} Products for Draft Generation`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function NewBatchPage() {
  return <ProtectedAdmin><NewBatchWizard /></ProtectedAdmin>;
}
